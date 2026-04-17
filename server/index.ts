import express from "express";
import session from "express-session";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { storage, computeRankFromRevenue } from "./storage";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const UPLOADS_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.set("trust proxy", 1);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const { processStripeSession } = await import("./stripePayments");
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event: any;

      if (webhookSecret) {
        const sig = req.headers["stripe-signature"] as string;
        if (!sig) return res.status(400).json({ error: "Missing signature" });
        try {
          event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
        } catch (sigErr: any) {
          log(`Webhook signature verification failed: ${sigErr.message}`);
          return res.status(400).json({ error: `Webhook signature failed: ${sigErr.message}` });
        }
      } else {
        try {
          const body = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);
          event = JSON.parse(body);
        } catch {
          event = req.body;
        }
      }

      log(`Webhook received: ${event.type}`);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const result = await processStripeSession(session);
        log(`Webhook processStripeSession result: ${JSON.stringify(result)}`);
      }

      res.json({ received: true });
    } catch (e: any) {
      log(`Webhook error: ${e.message}`);
      res.status(400).json({ error: e.message });
    }
  }
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(UPLOADS_DIR));

const PgStore = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "fortune-telling-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: "lax" as const,
  },
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).substring(0, 80)}`;
      }
      log(logLine);
    }
  });

  next();
});

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

registerRoutes(app, (roomId, data) => broadcastToRoom(roomId, data), (advisorId, data) => broadcastToAdvisor(advisorId, data));

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

interface ChatClient {
  ws: WebSocket;
  userId: number;
  roomId: string | null;
  fortunetellerId: number | null;
}

const clients = new Set<ChatClient>();

function broadcastToRoom(roomId: string, data: any) {
  const msg = JSON.stringify(data);
  Array.from(clients).forEach((client) => {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  });
}

function broadcastToAdvisor(fortunetellerId: number, data: any) {
  const msg = JSON.stringify(data);
  Array.from(clients).forEach((client) => {
    if (client.fortunetellerId === fortunetellerId && !client.roomId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  });
}

wss.on("connection", async (ws, req) => {
  const sessionParser = new Promise<any>((resolve) => {
    const fakeRes = { end: () => {} } as any;
    sessionMiddleware(req as any, fakeRes, () => {
      resolve((req as any).session);
    });
  });

  const sess = await sessionParser;
  const userId = sess?.userId;

  if (!userId) {
    ws.close(1008, "Not authenticated");
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const params = url.searchParams;
  const roomIdParam = params.get("room_id");
  const fortunetellerIdParam = params.get("fortuneteller_id");

  const client: ChatClient = {
    ws,
    userId,
    roomId: roomIdParam,
    fortunetellerId: fortunetellerIdParam ? parseInt(fortunetellerIdParam) : null,
  };

  clients.add(client);

  if (roomIdParam) {
    try {
      const msgs = await storage.getMessagesByRoom(roomIdParam);
      ws.send(JSON.stringify({
        type: "history",
        room_id: roomIdParam,
        messages: msgs.map((m) => ({
          id: String(m.id),
          sender: m.sender,
          text: m.isLocked && (m.category === "treatment" || m.category === "length_paying") ? null : m.text,
          title: m.title || null,
          category: m.category || "free",
          cost_pt: m.costPt,
          is_locked: m.isLocked,
          created_at: m.createdAt.toISOString(),
          attachments: [],
          free: m.category === "free" && m.sender === "querent",
        })),
      }));
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }

  ws.on("message", async (raw) => {
    const SERVER_FREE_TEMPLATES = [
      "ご依頼よろしくお願いします",
      "鑑定お願いできますか？",
      "施術をお願いできますか？",
      "前回の続きからよろしくお願します",
      "はい",
      "相談ありがとうございました",
    ];
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "mark_read" && client.roomId) {
        const user = await storage.getUser(userId);
        if (user) {
          const role: "querent" | "fortuneteller" = user.role === "2" ? "fortuneteller" : "querent";
          await storage.markRoomRead(client.roomId, role);
        }
        return;
      }

      if (data.type !== "chat_message") return;

      const { sender, text, category, title, free: isFree, cost_pt: directCostPt } = data;
      let roomId = client.roomId;

      if (!roomId && client.fortunetellerId) {
        const room = await storage.getOrCreateRoom(client.fortunetellerId, userId);
        roomId = room.id;
        client.roomId = roomId;
        ws.send(JSON.stringify({ type: "room_init", room_id: roomId }));
      }

      if (!roomId) return;

      let costPt: number | null = null;
      let isLocked = false;
      let msgFree = false;
      let msgCategory = category || "free";

      let subscriptionBonus = 0;
      if (sender === "fortuneteller") {
        if (category === "length_paying") {
          costPt = (text || "").length * 2;
          isLocked = true;
          msgCategory = "length_paying";
        } else if (category === "treatment") {
          costPt = parseInt(directCostPt) || 0;
          isLocked = true;
          msgCategory = "treatment";
        }
        const roomData = await storage.getRoom(roomId);
        if (roomData) {
          const querentSub = await storage.getActiveSubscription(roomData.querentId);
          if (querentSub) {
            const hasReplied = await storage.hasFortunetellerRepliedInRoom(roomId, roomData.fortunetellerId, 30);
            if (!hasReplied) {
              subscriptionBonus = 2000;
              await storage.addFortunetellerBonusCashable(roomData.fortunetellerId, 2000);
            }
          }
          if (category !== "treatment") {
            const earnedFromTreatment = await storage.settleTreatmentMessagesInRoom(roomId);
            if (earnedFromTreatment > 0) {
              await storage.addFortunetellerBonusCashable(roomData.fortunetellerId, earnedFromTreatment);
            }
          }
        }
      } else if (sender === "querent" && text) {
        const isValidFreeTemplate = isFree && SERVER_FREE_TEMPLATES.includes(text.trim());
        if (isValidFreeTemplate) {
          msgFree = true;
          costPt = 0;
          msgCategory = "free";
        } else {
          const activeSub = await storage.getActiveSubscription(userId);
          if (activeSub) {
            const subStart = activeSub.startDate;
            const slotAdvisors = await storage.getSubscriptionSlotAdvisors(userId, subStart);
            const roomData2 = await storage.getRoom(roomId);
            const advisorId = roomData2?.fortunetellerId;
            const isInSlot = advisorId ? slotAdvisors.includes(advisorId) : false;
            const slotFull = slotAdvisors.length >= 5;
            if (isInSlot || (!slotFull && advisorId)) {
              costPt = 0;
              msgCategory = "free";
            } else {
              const roomData3 = roomData2;
              if (roomData3) {
                const ftProfile2 = await storage.getFortunetellerProfile(roomData3.fortunetellerId);
                const storedRank2 = ftProfile2?.rank || "NORMAL";
                const RANK_MULT2: Record<string, number> = {
                  DIAMOND_PLUS: 24, DIAMOND: 22, PLATINUM_PLUS: 20,
                  PLATINUM: 18, GOLD: 16, SILVER: 14, BRONZE: 10, NORMAL: 6,
                };
                const mult2 = RANK_MULT2[storedRank2] || 6;
                costPt = text.length * mult2;
                msgCategory = "length_paying";
                const deducted = await storage.deductPoints(userId, costPt);
                if (!deducted) {
                  ws.send(JSON.stringify({ type: "error", message: "ポイントが不足しています。" }));
                  return;
                }
              }
            }
          } else {
            const roomData = await storage.getRoom(roomId);
            if (roomData) {
              const ftProfile = await storage.getFortunetellerProfile(roomData.fortunetellerId);
              const storedRank = ftProfile?.rank || "NORMAL";
              const RANK_MULT: Record<string, number> = {
                DIAMOND_PLUS: 24, DIAMOND: 22, PLATINUM_PLUS: 20,
                PLATINUM: 18, GOLD: 16, SILVER: 14, BRONZE: 10, NORMAL: 6,
              };
              const mult = RANK_MULT[storedRank] || 6;
              costPt = text.length * mult;
              msgCategory = "length_paying";
              const deducted = await storage.deductPoints(userId, costPt);
              if (!deducted) {
                ws.send(JSON.stringify({ type: "error", message: "ポイントが不足しています。" }));
                return;
              }
            }
          }
        }
      }

      const isFromQuerent = sender === "querent";
      const msg = await storage.createMessage({
        roomId,
        sender,
        text,
        title: category === "treatment" ? (title || null) : null,
        category: msgCategory,
        costPt,
        bonusPt: subscriptionBonus > 0 ? subscriptionBonus : 0,
        isLocked,
        isReadByQuerent: isFromQuerent,
        isReadByFortuneteller: !isFromQuerent,
      });

      broadcastToRoom(roomId, {
        type: "new_message",
        message: {
          id: String(msg.id),
          sender: msg.sender,
          text: msg.isLocked && (msg.category === "treatment" || msg.category === "length_paying") ? null : msg.text,
          title: msg.title || null,
          category: msg.category || "free",
          cost_pt: msg.costPt,
          is_locked: msg.isLocked,
          created_at: msg.createdAt.toISOString(),
          attachments: [],
          free: msgFree,
          subscription_bonus: subscriptionBonus > 0 ? subscriptionBonus : undefined,
        },
      });
    } catch (e) {
      console.error("WS message error:", e);
    }
  });

  ws.on("close", () => {
    clients.delete(client);
  });
});

async function seedAdminAndSubscriptions() {
  try {
    const hashedPassword = await bcrypt.hash("Test1234", 10);

    const existingAdmin = await storage.getUserByEmail("admin@example.com");
    if (!existingAdmin) {
      const adminUser = await storage.createUser({ email: "admin@example.com", password: hashedPassword, role: "9" });
      log(`Admin user created: admin@example.com (id=${adminUser.id})`);
    }

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let subCount = 0;
    for (let i = 0; i < 10; i++) {
      const idx = String(i + 1).padStart(2, "0");
      const qUser = await storage.getUserByEmail(`querent${idx}@example.com`);
      if (qUser) {
        const alreadySub = await storage.getActiveSubscription(qUser.id);
        if (!alreadySub) {
          await storage.createSubscription({
            querentId: qUser.id,
            amount: 20000,
            status: "active",
            startDate: now,
            endDate: thirtyDaysLater,
          });
          await storage.updateQuerentProfile(qUser.id, { isSubscription: true });
          subCount++;
        }
      }
    }
    if (subCount > 0) log(`Subscriptions seeded for ${subCount} querents.`);
  } catch (e: any) {
    log(`Admin/subscription seed: ${e.message}`);
  }
}

async function seedDatabase() {
  try {
    const existing = await storage.getUserByEmail("querent01@example.com");
    if (existing) return;

    log("Seeding database with 30 fortunetellers and 30 querents...");
    const hashedPassword = await bcrypt.hash("Test1234", 10);

    const ftNames = [
      { name: "月影みやび", headline: "月の導きで未来を照らす", intro: "タロットと西洋占星術を組み合わせた独自の鑑定スタイルで、恋愛運を中心にお悩みを解決します。" },
      { name: "星宮れいな", headline: "星が語る真実の道標", intro: "霊感タロットで15年の実績。複雑な恋愛や不倫相談もお任せください。" },
      { name: "天河すみれ", headline: "心の奥の声を聴きます", intro: "チャネリングとオラクルカードで、あなたの魂が本当に望んでいることをお伝えします。" },
      { name: "紫月かおり", headline: "紫の月が示す運命", intro: "四柱推命と手相の二刀流。仕事運・転職相談に定評があります。" },
      { name: "風花ひなた", headline: "風に乗せて幸せを届ける", intro: "数秘術とカラーセラピーで、あなたの人生のテーマカラーを見つけます。" },
      { name: "蒼空あかり", headline: "蒼い空に希望の光を", intro: "ルノルマンカードとダウジングで具体的な時期や方向をお伝えします。" },
      { name: "桜庭ゆき", headline: "桜舞う春を呼び込む", intro: "九星気学と風水で開運アドバイス。引っ越し・旅行方位もご相談ください。" },
      { name: "水鏡なぎさ", headline: "水面に映る本当の姿", intro: "透視能力で相手の気持ちを読み取ります。片思い・復縁相談が得意です。" },
      { name: "暁月りん", headline: "夜明けの月に願いを", intro: "西洋占星術とアロマテラピーを融合。心と体のバランスを整えます。" },
      { name: "雪乃しずく", headline: "静かに降る雪のように", intro: "易占いと霊感で、仕事・人間関係の悩みに具体的なアドバイスをお届けします。" },
      { name: "翠川まこと", headline: "翠の風が吹く場所へ", intro: "インド占星術と宝石療法の専門家。金運アップのお守りも承ります。" },
      { name: "朝霧えみ", headline: "霧が晴れると未来が見える", intro: "サイキックリーディングで10年以上の経験。ペットの気持ちも読めます。" },
      { name: "夕凪そら", headline: "夕凪の海に答えがある", intro: "マヤ暦とKIN診断で、あなたの生まれ持った才能と使命をお伝えします。" },
      { name: "花宮あずさ", headline: "花が咲く時を見逃さない", intro: "タロットカードと夢占いの組み合わせで、潜在意識からのメッセージを解読します。" },
      { name: "琴音はるか", headline: "心の琴線に触れる鑑定", intro: "ルーン占いとクリスタルヒーリングで心の傷を癒しながら未来を占います。" },
      { name: "白雪まひろ", headline: "純白の雪が道を示す", intro: "姓名判断と画数占いの専門家。改名・命名のご相談も多数実績があります。" },
      { name: "結城あおい", headline: "結ばれる縁を見つける", intro: "縁結び専門の占い師。赤い糸リーディングで運命の人との出会い時期をお伝えします。" },
      { name: "霞月のぞみ", headline: "霞の向こうの希望の光", intro: "アカシックレコードリーディングで前世からの課題と今世の使命を読み解きます。" },
      { name: "鈴音ことは", headline: "鈴の音が幸運を呼ぶ", intro: "算命学と紫微斗数で運勢の流れを詳細に分析。来年の運勢が気になる方へ。" },
      { name: "夢路みさき", headline: "夢への道を照らします", intro: "ヒプノセラピーと前世療法で、心のブロックを解放するお手伝いをします。" },
      { name: "凛華せつな", headline: "凛と咲く花のように", intro: "断易と梅花心易で、YES/NOの明確な答えをお出しします。決断に迷う方へ。" },
      { name: "天音みこと", headline: "天の音色を届けます", intro: "ボイスリーディングで声のエネルギーから運勢を読み取る独自の鑑定法です。" },
      { name: "深雪かなで", headline: "深い雪の下の温もり", intro: "ジオマンシーと砂占いで、土地のエネルギーと相性を鑑定します。" },
      { name: "光風あすか", headline: "光の風に乗って飛ぶ", intro: "エンジェルカードとフェアリーカードで、守護天使からのメッセージをお届けします。" },
      { name: "椿月さやか", headline: "椿の花言葉は理想の愛", intro: "宿曜占星術で相性診断。ビジネスパートナーや結婚相手との相性を詳しく鑑定。" },
      { name: "朝陽のどか", headline: "朝の光が心を温める", intro: "カバラ数秘術と生命の樹で、人生の設計図を読み解きます。" },
      { name: "真珠みなみ", headline: "真珠のような輝きを", intro: "水晶玉占いとスクライングで、ビジョンとして未来の映像をお伝えします。" },
      { name: "虹色ひかる", headline: "七色の虹を架ける占い", intro: "オーラリーディングとチャクラ診断で、心身のエネルギーバランスを整えます。" },
      { name: "月白うらら", headline: "月白に照らされる道", intro: "ホラリー占星術で、質問に対する的確な答えを天体の配置から導き出します。" },
      { name: "風月あやめ", headline: "風と月が紡ぐ物語", intro: "トートタロットとカバラの融合鑑定。スピリチュアルな成長をサポートします。" },
    ];

    const ranks = ["SILVER", "GOLD", "PLATINUM"];
    const styles = ["優しく回答", "じっくり聞きます", "即対応いたします", "リードします", "寄り添います", "明るく、元気に"];
    const methods = ["手相", "タロット", "四柱推命", "占星術", "九星気学"];
    for (let i = 0; i < 30; i++) {
      const idx = String(i + 1).padStart(2, "0");
      const ft = ftNames[i];
      const ftMethods = [methods[i % 5], methods[(i + 2) % 5]].filter((v, j, a) => a.indexOf(v) === j);
      const user = await storage.createUser({ email: `fortune${idx}@example.com`, password: hashedPassword, role: "2" });
      await storage.createFortunetellerProfile({
        userId: user.id,
        name: ft.name,
        rank: ranks[i % 3],
        profileImage: "",
        iconImage: "",
        headline: ft.headline,
        intro: ft.intro,
        isRecommended: i < 5,
        style: styles[i % 6],
        divinationMethods: ftMethods,
      });
    }

    const qNames = [
      { name: "田中美咲", zodiac: "牡羊座", worry: "love", msg: "彼との関係に悩んでいます" },
      { name: "佐藤健太", zodiac: "牡牛座", worry: "work", msg: "転職すべきか迷っています" },
      { name: "鈴木あかり", zodiac: "双子座", worry: "love", msg: "片思いの相手に告白すべきか" },
      { name: "高橋翔太", zodiac: "蟹座", worry: "money", msg: "投資を始めるタイミングについて" },
      { name: "伊藤さくら", zodiac: "獅子座", worry: "human", msg: "職場の人間関係で悩んでいます" },
      { name: "渡辺大地", zodiac: "乙女座", worry: "health", msg: "体調管理のアドバイスが欲しい" },
      { name: "山本花音", zodiac: "天秤座", worry: "love", msg: "復縁したい相手がいます" },
      { name: "中村拓海", zodiac: "蠍座", worry: "work", msg: "起業するかどうか悩んでいます" },
      { name: "小林美月", zodiac: "射手座", worry: "love", msg: "遠距離恋愛の不安を解消したい" },
      { name: "加藤蓮", zodiac: "山羊座", worry: "money", msg: "貯金が増えない原因を知りたい" },
      { name: "吉田陽菜", zodiac: "水瓶座", worry: "human", msg: "友人との距離感に悩んでいます" },
      { name: "山田悠真", zodiac: "魚座", worry: "work", msg: "やりたいことが見つからない" },
      { name: "松本心優", zodiac: "牡羊座", worry: "love", msg: "結婚のタイミングを知りたい" },
      { name: "井上颯太", zodiac: "牡牛座", worry: "health", msg: "ストレスの解消法を教えて" },
      { name: "木村七海", zodiac: "双子座", worry: "love", msg: "彼の浮気が心配です" },
      { name: "林凛太朗", zodiac: "蟹座", worry: "work", msg: "昇進できるか知りたい" },
      { name: "清水結衣", zodiac: "獅子座", worry: "money", msg: "副業を始めるべきか" },
      { name: "斎藤大翔", zodiac: "乙女座", worry: "human", msg: "家族との関係を改善したい" },
      { name: "藤田莉子", zodiac: "天秤座", worry: "love", msg: "出会いの場が欲しい" },
      { name: "岡田悠人", zodiac: "蠍座", worry: "work", msg: "資格取得のアドバイスが欲しい" },
      { name: "石川芽依", zodiac: "射手座", worry: "love", msg: "元カレのことが忘れられない" },
      { name: "前田陸", zodiac: "山羊座", worry: "money", msg: "今年の金運を知りたい" },
      { name: "小川紬", zodiac: "水瓶座", worry: "health", msg: "睡眠の質を上げたい" },
      { name: "後藤奏太", zodiac: "魚座", worry: "human", msg: "上司との付き合い方に悩み" },
      { name: "近藤葵", zodiac: "牡羊座", worry: "love", msg: "婚活がうまくいかない" },
      { name: "坂本瑛斗", zodiac: "牡牛座", worry: "work", msg: "海外転勤の話が来ています" },
      { name: "遠藤凛", zodiac: "双子座", worry: "love", msg: "年の差恋愛について相談したい" },
      { name: "青木湊", zodiac: "蟹座", worry: "money", msg: "引っ越し先の家賃について" },
      { name: "西村詩", zodiac: "獅子座", worry: "human", msg: "ママ友との関係に疲れました" },
      { name: "村上陽太", zodiac: "乙女座", worry: "work", msg: "定年後の過ごし方が不安" },
    ];

    const addresses = [
      "東京都渋谷区", "大阪府大阪市北区", "愛知県名古屋市中区", "福岡県福岡市博多区", "北海道札幌市中央区",
      "宮城県仙台市青葉区", "広島県広島市中区", "京都府京都市下京区", "兵庫県神戸市中央区", "千葉県千葉市中央区",
    ];
    const birthplaces = ["東京", "大阪", "名古屋", "福岡", "札幌", "仙台", "広島", "京都", "神戸", "千葉"];

    for (let i = 0; i < 30; i++) {
      const idx = String(i + 1).padStart(2, "0");
      const q = qNames[i];
      const year = 1980 + (i % 20);
      const month = String((i % 12) + 1).padStart(2, "0");
      const day = String((i % 28) + 1).padStart(2, "0");
      const user = await storage.createUser({ email: `querent${idx}@example.com`, password: hashedPassword, role: "1" });
      await storage.createQuerentProfile({
        userId: user.id,
        name: q.name,
        telNumber: `090${String(10000000 + i * 111111).slice(0, 8)}`,
        postalCode: `${100 + i}0001`,
        address: addresses[i % 10],
        birthdate: `${year}-${month}-${day}`,
        zodiacSign: q.zodiac,
        birthplace: birthplaces[i % 10],
        birthtime: `${String(6 + (i % 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
        worryCategory: q.worry,
        worryMessage: q.msg,
        points: 500 + (i * 50),
      });
    }

    log("Database seeded with 30 fortunetellers and 30 querents.");
  } catch (e: any) {
    log(`Seed skipped or failed: ${e.message}`);
  }
}

async function backfillSampleImages() {
  try {
    const profiles = await storage.getAllFortunetellerProfiles();
    let updated = 0;
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      const needsIcon = !p.iconImage || p.iconImage === "";
      const needsBanner = !p.profileImage || p.profileImage === "";
      if (needsIcon || needsBanner) {
        const data: any = {};
        const iconIdx = (i % 5) + 1;
        const bannerIdx = (i % 5) + 1;
        if (needsIcon) data.iconImage = `/uploads/sample_icon_0${iconIdx}.png`;
        if (needsBanner) data.profileImage = `/uploads/sample_banner_0${bannerIdx}.png`;
        await storage.updateFortunetellerProfile(p.userId, data);
        updated++;
      }
    }
    if (updated > 0) log(`Backfilled sample images for ${updated} fortuneteller profiles.`);
  } catch (e: any) {
    log(`Image backfill skipped: ${e.message}`);
  }
}

async function backfillStylesAndMethods() {
  try {
    const styles = ["優しく回答", "じっくり聞きます", "即対応いたします", "リードします", "寄り添います", "明るく、元気に"];
    const methods = ["手相", "タロット", "四柱推命", "占星術", "九星気学"];
    const profiles = await storage.getAllFortunetellerProfiles();
    let updated = 0;
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      const needsStyle = !p.style || p.style === "";
      const needsMethods = !p.divinationMethods || p.divinationMethods.length === 0;
      if (needsStyle || needsMethods) {
        const data: any = {};
        if (needsStyle) data.style = styles[i % styles.length];
        if (needsMethods) data.divinationMethods = [methods[i % 5], methods[(i + 2) % 5]].filter((v, j, a) => a.indexOf(v) === j);
        await storage.updateFortunetellerProfile(p.userId, data);
        updated++;
      }
    }
    if (updated > 0) log(`Backfilled style/methods for ${updated} fortuneteller profiles.`);
  } catch (e: any) {
    log(`Backfill skipped: ${e.message}`);
  }
}

async function processExpiredTreatmentRefunds() {
  try {
    const expired = await storage.getExpiredUnsettledTreatmentMessages();
    for (const msg of expired) {
      await storage.refundTreatmentMessage(msg.id, msg.querentId, msg.costPt);
      if (msg.costPt > 0) {
        broadcastToRoom(msg.roomId, {
          type: "treatment_refunded",
          message_id: String(msg.id),
          refunded_pt: msg.costPt,
        });
        log(`Treatment message ${msg.id} refunded ${msg.costPt}pt to querent ${msg.querentId}`);
      }
    }
  } catch (e: any) {
    log(`Treatment refund job error: ${e.message}`);
  }
}

(async () => {
  await seedDatabase();
  await seedAdminAndSubscriptions();
  await backfillStylesAndMethods();
  await backfillSampleImages();

  setInterval(processExpiredTreatmentRefunds, 15 * 60 * 1000);
  setTimeout(processExpiredTreatmentRefunds, 5000);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
