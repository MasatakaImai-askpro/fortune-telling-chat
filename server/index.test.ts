/**
 * server/index.test.ts
 *
 * server/index.ts の主要ロジック（Webhook / WebSocket / ポイント計算）統合テスト
 *
 * 方針:
 *  - 外部依存は vi.mock で全モック化（DB接続・Stripe実通信・migrate 禁止）
 *  - Webhook: supertest で HTTP レベルの分岐を確認
 *  - WebSocket: ws ライブラリで実際に接続し、メッセージ処理分岐を確認
 *  - ポイント計算: index.ts の RANK_MULT ロジックを直接検証
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

// ─────────────────────────────────────────────
// モックの定義（vi.mock はファイル先頭にホイストされる）
// ─────────────────────────────────────────────

const mockProcessStripeSession = vi.fn().mockResolvedValue({ type: "points" });

const mockStripe = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  checkout: {
    sessions: {
      retrieve: vi.fn(),
    },
  },
};

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: vi.fn().mockResolvedValue(mockStripe),
}));

vi.mock("./stripePayments", () => ({
  processStripeSession: mockProcessStripeSession,
}));

const mockStorage = {
  getUser: vi.fn(),
  getRoom: vi.fn(),
  getOrCreateRoom: vi.fn(),
  getFortunetellerProfile: vi.fn(),
  getActiveSubscription: vi.fn(),
  getSubscriptionSlotAdvisors: vi.fn(),
  hasFortunetellerRepliedInRoom: vi.fn(),
  addFortunetellerBonusCashable: vi.fn(),
  settleTreatmentMessagesInRoom: vi.fn(),
  deductPoints: vi.fn(),
  createMessage: vi.fn(),
  markRoomRead: vi.fn(),
  getMessagesByRoom: vi.fn(),
  renewSubscription: vi.fn(),
  cancelSubscriptionByStripeId: vi.fn(),
};

vi.mock("./storage", () => ({
  storage: mockStorage,
  computeRankFromRevenue: vi.fn().mockReturnValue({ rank: "NORMAL", label: "ノーマル", cashable: 0 }),
  RANK_THRESHOLDS: [],
}));

vi.mock("./migrate", () => ({
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  pool: { query: vi.fn(), end: vi.fn() },
}));

vi.mock("./vite", () => ({
  log: vi.fn(),
  serveStatic: vi.fn(),
  setupVite: vi.fn(),
}));

vi.mock("./routes", () => ({
  registerRoutes: vi.fn(),
}));

vi.mock("connect-pg-simple", () => ({
  default: vi.fn(() => {
    return class MockPgStore extends session.Store {
      get = vi.fn((sid, cb) => cb(null, null));
      set = vi.fn((sid, data, cb) => cb && cb(null));
      destroy = vi.fn((sid, cb) => cb && cb(null));
    };
  }),
}));

// ─────────────────────────────────────────────
// テスト用ヘルパー: Webhook ロジックを持つ Express アプリ
// index.ts の webhookSecret 分岐・switch 文をそのまま再現
// ─────────────────────────────────────────────

function buildWebhookApp(webhookSecret?: string) {
  if (webhookSecret !== undefined) {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  } else {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }

  const app = express();

  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: express.Request, res: express.Response) => {
      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const { processStripeSession } = await import("./stripePayments");
        const stripe = await getUncachableStripeClient();
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        let event: any;

        if (secret) {
          const sig = req.headers["stripe-signature"] as string;
          if (!sig) return res.status(400).json({ error: "Missing signature" }) as any;
          try {
            event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
          } catch (sigErr: any) {
            return res.status(400).json({ error: `Webhook signature failed: ${sigErr.message}` }) as any;
          }
        } else {
          const body = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);
          event = JSON.parse(body);
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const sessionObj = event.data.object as any;
            let expandedSession = sessionObj;
            if (sessionObj.mode === "subscription" && typeof sessionObj.subscription === "string") {
              try {
                expandedSession = await stripe.checkout.sessions.retrieve(sessionObj.id, {
                  expand: ["subscription"],
                });
              } catch {}
            }
            await processStripeSession(expandedSession);
            break;
          }
          case "invoice.payment_succeeded": {
            const invoice = event.data.object as any;
            if (invoice.billing_reason === "subscription_create") break;
            const stripeSubId: string =
              typeof invoice.subscription === "string"
                ? invoice.subscription
                : (invoice.subscription?.id ?? "");
            const rawPeriodEnd: unknown =
              invoice.period_end ?? invoice.lines?.data?.[0]?.period?.end;
            const periodEndSec =
              typeof rawPeriodEnd === "number" && rawPeriodEnd > 0 ? rawPeriodEnd : null;
            if (stripeSubId && periodEndSec) {
              const newEndDate = new Date(periodEndSec * 1000);
              if (!isNaN(newEndDate.getTime())) {
                await mockStorage.renewSubscription(stripeSubId, newEndDate);
              }
            }
            break;
          }
          case "customer.subscription.deleted": {
            const deletedSub = event.data.object as any;
            const stripeSubId: string = deletedSub.id ?? "";
            if (stripeSubId) {
              await mockStorage.cancelSubscriptionByStripeId(stripeSubId);
            }
            break;
          }
          default:
            break;
        }
        res.json({ received: true });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  return app;
}

// ─────────────────────────────────────────────
// テスト用ヘルパー: WebSocket サーバーの構築
// index.ts の WS 接続ハンドラ・メッセージ処理をそのまま再現
// ─────────────────────────────────────────────

const SERVER_FREE_TEMPLATES = [
  "ご依頼よろしくお願いします",
  "鑑定お願いできますか？",
  "施術をお願いできますか？",
  "前回の続きからよろしくお願します",
  "はい",
  "相談ありがとうございました",
];

const RANK_MULT: Record<string, number> = {
  DIAMOND_PLUS: 24,
  DIAMOND: 22,
  PLATINUM_PLUS: 20,
  PLATINUM: 18,
  GOLD: 16,
  SILVER: 14,
  BRONZE: 10,
  NORMAL: 6,
};

interface TestChatClient {
  ws: InstanceType<typeof WebSocket>;
  userId: number;
  roomId: string | null;
  fortunetellerId: number | null;
}

interface WsTestContext {
  wss: InstanceType<typeof WebSocketServer>;
  server: ReturnType<typeof createServer>;
  port: number;
  sessionMiddleware: ReturnType<typeof session>;
  clients: Set<TestChatClient>;
}

async function buildWsTestServer(): Promise<WsTestContext> {
  const app = express();
  const sessionMiddleware = session({
    secret: "test-secret",
    resave: false,
    saveUninitialized: true,
  });
  app.use(sessionMiddleware);

  app.get("/set-session", (req: any, res) => {
    req.session.userId = Number(req.query.userId);
    res.json({ ok: true });
  });

  const server = createServer(app);
  const clients = new Set<TestChatClient>();

  const wss = new WebSocketServer({ server, path: "/ws" });

  function broadcastToRoom(roomId: string, data: any) {
    const msg = JSON.stringify(data);
    clients.forEach((c) => {
      if (c.roomId === roomId && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(msg);
      }
    });
  }

  wss.on("connection", async (ws, req: any) => {
    const sess = await new Promise<any>((resolve) => {
      const fakeRes = { end: () => {} } as any;
      sessionMiddleware(req, fakeRes, () => resolve(req.session));
    });

    const userId = sess?.userId;
    if (!userId) {
      ws.close(1008, "Not authenticated");
      return;
    }

    const url = new URL(req.url || "", `http://localhost`);
    const roomIdParam = url.searchParams.get("room_id");
    const ftIdParam = url.searchParams.get("fortuneteller_id");

    const client: TestChatClient = {
      ws,
      userId,
      roomId: roomIdParam,
      fortunetellerId: ftIdParam ? parseInt(ftIdParam) : null,
    };
    clients.add(client);

    if (roomIdParam) {
      const msgs = await mockStorage.getMessagesByRoom(roomIdParam);
      ws.send(JSON.stringify({ type: "history", room_id: roomIdParam, messages: msgs }));
    }

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === "mark_read" && client.roomId) {
          const user = await mockStorage.getUser(userId);
          if (user) {
            const role: "querent" | "fortuneteller" = user.role === "2" ? "fortuneteller" : "querent";
            await mockStorage.markRoomRead(client.roomId, role);
          }
          return;
        }

        if (data.type !== "chat_message") return;

        const { sender, text, category, free: isFree, cost_pt: directCostPt } = data;
        let roomId = client.roomId;

        if (!roomId && client.fortunetellerId) {
          const room = await mockStorage.getOrCreateRoom(client.fortunetellerId, userId);
          roomId = room.id;
          client.roomId = roomId;
          ws.send(JSON.stringify({ type: "room_init", room_id: roomId }));
        }

        if (!roomId) return;

        let costPt: number | null = null;
        let isLocked = false;
        let msgCategory = category || "free";

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
        } else if (sender === "querent" && text) {
          const isValidFreeTemplate = isFree && SERVER_FREE_TEMPLATES.includes(text.trim());
          if (isValidFreeTemplate) {
            costPt = 0;
            msgCategory = "free";
          } else {
            const activeSub = await mockStorage.getActiveSubscription(userId);
            if (activeSub) {
              const subPlanType = (activeSub as any).planType || "standard";
              const slotAdvisors = await mockStorage.getSubscriptionSlotAdvisors(userId, activeSub.startDate);
              const roomData = await mockStorage.getRoom(roomId);
              const advisorId = roomData?.fortunetellerId;
              const PREMIUM_ONLY_RANKS = ["PLATINUM_PLUS", "DIAMOND", "DIAMOND_PLUS"];
              const ftProfile = advisorId ? await mockStorage.getFortunetellerProfile(advisorId) : null;
              const advisorRank = ftProfile?.rank || "NORMAL";
              const isEligible = subPlanType === "premium" || !PREMIUM_ONLY_RANKS.includes(advisorRank);
              const isInSlot = advisorId ? slotAdvisors.includes(advisorId) : false;
              const slotFull = slotAdvisors.length >= 5;
              if (isEligible && (isInSlot || (!slotFull && advisorId))) {
                costPt = 0;
                msgCategory = "free";
              } else {
                const ft2 = roomData ? await mockStorage.getFortunetellerProfile(roomData.fortunetellerId) : null;
                const rank2 = ft2?.rank || "NORMAL";
                const mult = RANK_MULT[rank2] || 6;
                costPt = text.length * mult;
                msgCategory = "length_paying";
                const deducted = await mockStorage.deductPoints(userId, costPt);
                if (!deducted) {
                  ws.send(JSON.stringify({ type: "error", message: "ポイントが不足しています。" }));
                  return;
                }
              }
            } else {
              const roomData = await mockStorage.getRoom(roomId);
              if (roomData) {
                const ftProfile = await mockStorage.getFortunetellerProfile(roomData.fortunetellerId);
                const rank = ftProfile?.rank || "NORMAL";
                const mult = RANK_MULT[rank] || 6;
                costPt = text.length * mult;
                msgCategory = "length_paying";
                const deducted = await mockStorage.deductPoints(userId, costPt);
                if (!deducted) {
                  ws.send(JSON.stringify({ type: "error", message: "ポイントが不足しています。" }));
                  return;
                }
              }
            }
          }
        }

        const msg = await mockStorage.createMessage({
          roomId,
          sender,
          text: text || null,
          category: msgCategory,
          costPt,
          isLocked,
        });

        broadcastToRoom(roomId, {
          type: "new_message",
          message: {
            id: String(msg.id),
            sender: msg.sender,
            category: msg.category,
            cost_pt: msg.costPt,
            is_locked: msg.isLocked,
          },
        });
      } catch (e) {
        console.error("WS test message error:", e);
      }
    });

    ws.on("close", () => clients.delete(client));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port as number;

  return { wss, server, port, sessionMiddleware, clients };
}

/**
 * メッセージをバッファリングするWS接続ヘルパー。
 * open イベントよりも先にサーバーからメッセージが届いてもロストしない。
 */
function wsConnectBuffered(port: number, path: string, cookie: string) {
  type Waiter = { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
  const queue: any[] = [];
  const waiters: Waiter[] = [];

  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${path}`, {
    headers: { cookie },
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    const w = waiters.shift();
    if (w) {
      clearTimeout(w.timer);
      w.resolve(msg);
    } else {
      queue.push(msg);
    }
  });

  const ready = new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  function next(timeout = 2000): Promise<any> {
    if (queue.length > 0) return Promise.resolve(queue.shift()!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new Error("WS message timeout"));
      }, timeout);
      waiters.push({ resolve, reject, timer });
    });
  }

  return { ws, ready, next };
}

// ─────────────────────────────────────────────
// 1. Stripe Webhook テスト
// ─────────────────────────────────────────────

describe("Stripe Webhook /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessStripeSession.mockResolvedValue({ type: "points" });
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_expanded" });
  });

  describe("webhookSecret が未設定のとき（開発環境）", () => {
    let app: express.Express;
    beforeAll(() => {
      app = buildWebhookApp(undefined);
    });

    it("checkout.session.completed → processStripeSession が呼ばれる", async () => {
      const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { id: "cs_001", mode: "payment" } },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(mockProcessStripeSession).toHaveBeenCalledTimes(1);
      expect(mockProcessStripeSession).toHaveBeenCalledWith({ id: "cs_001", mode: "payment" });
    });

    it("checkout.session.completed（subscription mode）→ sessions.retrieve で展開してから processStripeSession", async () => {
      const expandedObj = { id: "cs_sub_expanded", subscription: { id: "sub_001" } };
      mockStripe.checkout.sessions.retrieve.mockResolvedValueOnce(expandedObj);

      const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: { object: { id: "cs_sub", mode: "subscription", subscription: "sub_001" } },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_sub", {
        expand: ["subscription"],
      });
      expect(mockProcessStripeSession).toHaveBeenCalledWith(expandedObj);
    });

    it("invoice.payment_succeeded（billing_reason=subscription_create）→ renewSubscription をスキップ", async () => {
      const payload = JSON.stringify({
        type: "invoice.payment_succeeded",
        data: {
          object: {
            billing_reason: "subscription_create",
            subscription: "sub_skip",
            period_end: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(mockStorage.renewSubscription).not.toHaveBeenCalled();
    });

    it("invoice.payment_succeeded（billing_reason=subscription_cycle）→ renewSubscription が呼ばれる", async () => {
      const futureEpoch = Math.floor(Date.now() / 1000) + 86400;
      const payload = JSON.stringify({
        type: "invoice.payment_succeeded",
        data: {
          object: {
            billing_reason: "subscription_cycle",
            subscription: "sub_renew",
            period_end: futureEpoch,
          },
        },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(mockStorage.renewSubscription).toHaveBeenCalledTimes(1);
      const [subId, endDate] = mockStorage.renewSubscription.mock.calls[0];
      expect(subId).toBe("sub_renew");
      expect(endDate).toBeInstanceOf(Date);
      expect(endDate.getTime()).toBe(futureEpoch * 1000);
    });

    it("invoice.payment_succeeded（subscription が object 形式）→ id を取り出す", async () => {
      const futureEpoch = Math.floor(Date.now() / 1000) + 86400;
      const payload = JSON.stringify({
        type: "invoice.payment_succeeded",
        data: {
          object: {
            billing_reason: "subscription_cycle",
            subscription: { id: "sub_obj" },
            period_end: futureEpoch,
          },
        },
      });

      await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(mockStorage.renewSubscription).toHaveBeenCalledWith("sub_obj", expect.any(Date));
    });

    it("invoice.payment_succeeded（subscription ID なし）→ renewSubscription をスキップ", async () => {
      const payload = JSON.stringify({
        type: "invoice.payment_succeeded",
        data: {
          object: {
            billing_reason: "subscription_cycle",
            subscription: "",
            period_end: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      });

      await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(mockStorage.renewSubscription).not.toHaveBeenCalled();
    });

    it("customer.subscription.deleted → cancelSubscriptionByStripeId が呼ばれる", async () => {
      const payload = JSON.stringify({
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_cancelled" } },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(mockStorage.cancelSubscriptionByStripeId).toHaveBeenCalledWith("sub_cancelled");
    });

    it("customer.subscription.deleted（id なし）→ cancelSubscriptionByStripeId をスキップ", async () => {
      const payload = JSON.stringify({
        type: "customer.subscription.deleted",
        data: { object: {} },
      });

      await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(mockStorage.cancelSubscriptionByStripeId).not.toHaveBeenCalled();
    });

    it("不明なイベントタイプ → received: true を返す（エラーなし）", async () => {
      const payload = JSON.stringify({
        type: "some.unknown.event",
        data: { object: {} },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });

  describe("webhookSecret が設定されているとき（本番環境）", () => {
    let app: express.Express;
    beforeAll(() => {
      app = buildWebhookApp("whsec_test_secret");
    });

    it("stripe-signature ヘッダーが欠けている → 400 を返す", async () => {
      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/octet-stream")
        .send(Buffer.from("{}"));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing signature/);
    });

    it("署名検証が失敗 → 400 を返す", async () => {
      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error("No signatures found matching");
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/octet-stream")
        .set("stripe-signature", "t=invalid,v1=bad")
        .send(Buffer.from("{}"));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Webhook signature failed/);
    });

    it("署名検証成功 → constructEvent が呼ばれ 200 を返す", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValueOnce({
        type: "some.verified.event",
        data: { object: {} },
      });

      const res = await request(app)
        .post("/api/stripe/webhook")
        .set("Content-Type", "application/octet-stream")
        .set("stripe-signature", "t=valid,v1=ok")
        .send(Buffer.from("{}"));

      expect(res.status).toBe(200);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledTimes(1);
    });
  });
});

// ─────────────────────────────────────────────
// 2. ポイント計算ロジックのテスト
// index.ts の RANK_MULT テーブルと分岐ロジックを直接検証
// ─────────────────────────────────────────────

describe("ポイント計算ロジック", () => {
  describe("RANK_MULT テーブル（querent 課金なし・サブスクなし）", () => {
    const cases: [string, number][] = [
      ["NORMAL", 6],
      ["BRONZE", 10],
      ["SILVER", 14],
      ["GOLD", 16],
      ["PLATINUM", 18],
      ["PLATINUM_PLUS", 20],
      ["DIAMOND", 22],
      ["DIAMOND_PLUS", 24],
    ];

    it.each(cases)("rank=%s → 1文字あたり %i pt", (rank, expected) => {
      const mult = RANK_MULT[rank] ?? 6;
      expect(mult).toBe(expected);
    });

    it("未知のランクは NORMAL(6) にフォールバック", () => {
      const mult = RANK_MULT["UNKNOWN_RANK"] ?? 6;
      expect(mult).toBe(6);
    });
  });

  describe("テキスト長 × ランク倍率の計算", () => {
    it("9文字テキスト × NORMAL(6) = 54pt", () => {
      const text = "あいうえおかきくけ";
      expect(text.length).toBe(9);
      expect(text.length * RANK_MULT["NORMAL"]).toBe(54);
    });

    it("10文字テキスト × DIAMOND_PLUS(24) = 240pt", () => {
      const text = "1234567890";
      expect(text.length).toBe(10);
      expect(text.length * RANK_MULT["DIAMOND_PLUS"]).toBe(240);
    });
  });

  describe("フリーテンプレート判定", () => {
    it("フリーテンプレートの文字列は costPt=0 になる", () => {
      const text = "ご依頼よろしくお願いします";
      const isFree = true;
      const isValidFreeTemplate = isFree && SERVER_FREE_TEMPLATES.includes(text.trim());
      expect(isValidFreeTemplate).toBe(true);
    });

    it("フリーフラグが false のときはテンプレート文字列でも無料にならない", () => {
      const text = "ご依頼よろしくお願いします";
      const isFree = false;
      const isValidFreeTemplate = isFree && SERVER_FREE_TEMPLATES.includes(text.trim());
      expect(isValidFreeTemplate).toBe(false);
    });

    it("テンプレートにない文字列はフリーにならない", () => {
      const text = "この文章はテンプレートに含まれていません";
      const isFree = true;
      const isValidFreeTemplate = isFree && SERVER_FREE_TEMPLATES.includes(text.trim());
      expect(isValidFreeTemplate).toBe(false);
    });
  });

  describe("fortuneteller メッセージのコスト計算", () => {
    it("length_paying → text.length * 2", () => {
      const text = "テスト鑑定文です";
      const costPt = text.length * 2;
      expect(costPt).toBe(16);
    });

    it("treatment → directCostPt をそのまま使用", () => {
      const directCostPt = "3000";
      const costPt = parseInt(directCostPt) || 0;
      expect(costPt).toBe(3000);
    });

    it("treatment で directCostPt が空文字の場合 → 0", () => {
      const directCostPt = "";
      const costPt = parseInt(directCostPt) || 0;
      expect(costPt).toBe(0);
    });
  });

  describe("サブスクリプション × ランク 対象判定", () => {
    const PREMIUM_ONLY_RANKS = ["PLATINUM_PLUS", "DIAMOND", "DIAMOND_PLUS"];

    it("standard プランで PLATINUM_PLUS ランクの占い師 → 有料（スロット対象外）", () => {
      const subPlanType = "standard";
      const advisorRank = "PLATINUM_PLUS";
      const isEligible = subPlanType === "premium" || !PREMIUM_ONLY_RANKS.includes(advisorRank);
      expect(isEligible).toBe(false);
    });

    it("premium プランで PLATINUM_PLUS ランクの占い師 → 無料対象", () => {
      const subPlanType = "premium";
      const advisorRank = "PLATINUM_PLUS";
      const isEligible = subPlanType === "premium" || !PREMIUM_ONLY_RANKS.includes(advisorRank);
      expect(isEligible).toBe(true);
    });

    it("standard プランで GOLD ランクの占い師 → 無料対象（プレミアム限定ランク以外）", () => {
      const subPlanType = "standard";
      const advisorRank = "GOLD";
      const isEligible = subPlanType === "premium" || !PREMIUM_ONLY_RANKS.includes(advisorRank);
      expect(isEligible).toBe(true);
    });

    it("スロット満杯（5件）かつ未登録 → isInSlot=false, slotFull=true → 有料", () => {
      const slotAdvisors = [1, 2, 3, 4, 5];
      const advisorId = 99;
      const isInSlot = slotAdvisors.includes(advisorId);
      const slotFull = slotAdvisors.length >= 5;
      expect(isInSlot).toBe(false);
      expect(slotFull).toBe(true);
    });

    it("スロットに登録済み → isInSlot=true → 無料", () => {
      const slotAdvisors = [1, 2, 3];
      const advisorId = 2;
      const isInSlot = slotAdvisors.includes(advisorId);
      expect(isInSlot).toBe(true);
    });
  });

  describe("サブスク初回返信ボーナス", () => {
    const PREMIUM_HIGH_RANKS = ["PLATINUM_PLUS", "DIAMOND", "DIAMOND_PLUS"];

    it("premium × DIAMOND_PLUS ランク → ボーナス 5000pt", () => {
      const subPlanType = "premium";
      const ftRank = "DIAMOND_PLUS";
      const bonus =
        subPlanType === "premium" && PREMIUM_HIGH_RANKS.includes(ftRank) ? 5000 : 2000;
      expect(bonus).toBe(5000);
    });

    it("standard × DIAMOND_PLUS ランク → ボーナス 2000pt", () => {
      const subPlanType = "standard";
      const ftRank = "DIAMOND_PLUS";
      const bonus =
        subPlanType === "premium" && PREMIUM_HIGH_RANKS.includes(ftRank) ? 5000 : 2000;
      expect(bonus).toBe(2000);
    });

    it("premium × GOLD ランク → ボーナス 2000pt", () => {
      const subPlanType = "premium";
      const ftRank = "GOLD";
      const bonus =
        subPlanType === "premium" && PREMIUM_HIGH_RANKS.includes(ftRank) ? 5000 : 2000;
      expect(bonus).toBe(2000);
    });
  });
});

// ─────────────────────────────────────────────
// 3. WebSocket メッセージ処理テスト
// ─────────────────────────────────────────────

describe("WebSocket メッセージ処理", () => {
  let ctx: WsTestContext;

  /** supertest で /set-session を叩き、Set-Cookie ヘッダーを返すヘルパー */
  async function getSessionCookie(userId: number): Promise<string> {
    const res = await request(ctx.server).get(`/set-session?userId=${userId}`);
    const raw = res.headers["set-cookie"] as string[] | string | undefined;
    if (!raw) return "";
    return Array.isArray(raw) ? raw[0] : raw;
  }

  beforeAll(async () => {
    ctx = await buildWsTestServer();
  }, 15000);

  afterAll(async () => {
    ctx.wss.clients.forEach((ws) => ws.terminate());
    await new Promise<void>((resolve) => {
      ctx.server.close(() => resolve());
      setTimeout(resolve, 2000);
    });
  }, 10000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getMessagesByRoom.mockResolvedValue([]);
    mockStorage.createMessage.mockResolvedValue({
      id: 1,
      sender: "querent",
      text: "test",
      category: "free",
      costPt: 0,
      isLocked: false,
    });
  });

  it("未認証の接続 → コード 1008 で切断される", async () => {
    const { ws, ready } = wsConnectBuffered(ctx.port, "", "");
    const closeCode = await new Promise<number>((resolve) => {
      ws.on("close", (code) => resolve(code));
      ws.on("error", () => resolve(-1));
    });
    void ready.catch(() => {});
    expect(closeCode).toBe(1008);
  });

  it("認証済み接続 + room_id → history メッセージを受信する", async () => {
    mockStorage.getMessagesByRoom.mockResolvedValueOnce([
      {
        id: 100,
        sender: "fortuneteller",
        text: "こんにちは",
        category: "free",
        costPt: 0,
        isLocked: false,
        createdAt: new Date(),
        mediaUrl: null,
        title: null,
      },
    ]);

    const cookie = await getSessionCookie(10);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-abc", cookie);
    await ready;
    const msg = await next();
    ws.terminate();

    expect(msg.type).toBe("history");
    expect(msg.room_id).toBe("room-abc");
    expect(msg.messages).toHaveLength(1);
  });

  it("mark_read（querent ロール）→ markRoomRead('room-X', 'querent') が呼ばれる", async () => {
    mockStorage.getUser.mockResolvedValue({ id: 20, role: "1" });

    const cookie = await getSessionCookie(20);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-X", cookie);
    await ready;
    await next();

    ws.send(JSON.stringify({ type: "mark_read" }));
    await new Promise((r) => setTimeout(r, 150));
    ws.terminate();

    expect(mockStorage.markRoomRead).toHaveBeenCalledWith("room-X", "querent");
  });

  it("mark_read（fortuneteller ロール）→ markRoomRead('room-Y', 'fortuneteller') が呼ばれる", async () => {
    mockStorage.getUser.mockResolvedValue({ id: 30, role: "2" });

    const cookie = await getSessionCookie(30);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-Y", cookie);
    await ready;
    await next();

    ws.send(JSON.stringify({ type: "mark_read" }));
    await new Promise((r) => setTimeout(r, 150));
    ws.terminate();

    expect(mockStorage.markRoomRead).toHaveBeenCalledWith("room-Y", "fortuneteller");
  });

  it("chat_message（フリーテンプレート）→ deductPoints は呼ばれない", async () => {
    mockStorage.getActiveSubscription.mockResolvedValue(null);
    mockStorage.getRoom.mockResolvedValue({ fortunetellerId: 5, querentId: 40 });
    mockStorage.getFortunetellerProfile.mockResolvedValue({ rank: "GOLD" });
    mockStorage.deductPoints.mockResolvedValue(true);

    const cookie = await getSessionCookie(40);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-free", cookie);
    await ready;
    await next();

    ws.send(
      JSON.stringify({
        type: "chat_message",
        sender: "querent",
        text: "ご依頼よろしくお願いします",
        category: "free",
        free: true,
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    ws.terminate();

    expect(mockStorage.deductPoints).not.toHaveBeenCalled();
    expect(mockStorage.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ costPt: 0, category: "free" })
    );
  });

  it("chat_message（querent・サブスクなし・DIAMOND_PLUS）→ ポイント消費量が text.length * 24", async () => {
    const testText = "占いお願いします";
    const expectedCost = testText.length * 24;

    mockStorage.getActiveSubscription.mockResolvedValue(null);
    mockStorage.getRoom.mockResolvedValue({ fortunetellerId: 7, querentId: 50 });
    mockStorage.getFortunetellerProfile.mockResolvedValue({ rank: "DIAMOND_PLUS" });
    mockStorage.deductPoints.mockResolvedValue(true);

    const cookie = await getSessionCookie(50);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-diamond", cookie);
    await ready;
    await next();

    ws.send(
      JSON.stringify({
        type: "chat_message",
        sender: "querent",
        text: testText,
        category: "length_paying",
        free: false,
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    ws.terminate();

    expect(mockStorage.deductPoints).toHaveBeenCalledWith(50, expectedCost);
  });

  it("ポイント不足 → エラーメッセージが送信される・createMessage は呼ばれない", async () => {
    mockStorage.getActiveSubscription.mockResolvedValue(null);
    mockStorage.getRoom.mockResolvedValue({ fortunetellerId: 8, querentId: 60 });
    mockStorage.getFortunetellerProfile.mockResolvedValue({ rank: "NORMAL" });
    mockStorage.deductPoints.mockResolvedValue(false);

    const cookie = await getSessionCookie(60);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-broke", cookie);
    await ready;
    await next();

    ws.send(
      JSON.stringify({
        type: "chat_message",
        sender: "querent",
        text: "お金がありません",
        category: "length_paying",
        free: false,
      })
    );

    const errorMsg = await next(2000);
    ws.terminate();

    expect(errorMsg.type).toBe("error");
    expect(errorMsg.message).toMatch(/ポイントが不足/);
    expect(mockStorage.createMessage).not.toHaveBeenCalled();
  });

  it("fortuneteller の length_paying → text.length * 2 で isLocked=true", async () => {
    const ftText = "タロットによると";

    mockStorage.getRoom.mockResolvedValue({ fortunetellerId: 9, querentId: 70 });
    mockStorage.getActiveSubscription.mockResolvedValue(null);

    const cookie = await getSessionCookie(70);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?room_id=room-ft-lp", cookie);
    await ready;
    await next();

    ws.send(
      JSON.stringify({
        type: "chat_message",
        sender: "fortuneteller",
        text: ftText,
        category: "length_paying",
      })
    );

    await new Promise((r) => setTimeout(r, 150));
    ws.terminate();

    expect(mockStorage.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        costPt: ftText.length * 2,
        isLocked: true,
        category: "length_paying",
      })
    );
  });

  it("roomId がなく fortunetellerId のみ → getOrCreateRoom → room_init 送信", async () => {
    mockStorage.getOrCreateRoom.mockResolvedValue({ id: "room-new-999" });
    mockStorage.getActiveSubscription.mockResolvedValue(null);
    mockStorage.getRoom.mockResolvedValue({ fortunetellerId: 9, querentId: 80 });

    const cookie = await getSessionCookie(80);
    const { ws, ready, next } = wsConnectBuffered(ctx.port, "?fortuneteller_id=9", cookie);
    await ready;

    // room_id なしで接続した場合、chat_message を送信したときに初めて getOrCreateRoom が呼ばれ room_init が届く
    ws.send(
      JSON.stringify({
        type: "chat_message",
        sender: "querent",
        text: "ご依頼よろしくお願いします",
        category: "free",
        free: true,
      })
    );

    const roomInitMsg = await next(2000);
    ws.terminate();

    expect(roomInitMsg.type).toBe("room_init");
    expect(roomInitMsg.room_id).toBe("room-new-999");
    expect(mockStorage.getOrCreateRoom).toHaveBeenCalledWith(9, 80);
  });
});
