import type { Express, Request, Response, NextFunction } from "express";
import { storage, computeRankFromRevenue, RANK_THRESHOLDS } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.resolve("uploads");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("JPEG/PNG/WebP/GIF画像のみアップロード可能です"));
    }
  },
});

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "9") {
    return res.status(403).json({ error: "管理者権限が必要です" });
  }
  next();
}

export function registerRoutes(app: Express, broadcast?: (roomId: string, data: any) => void, broadcastToAdvisor?: (advisorId: number, data: any) => void) {
  app.post("/api/user_login", async (req: Request, res: Response) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "メールアドレスとパスワードは必須です" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "認証に失敗しました" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "認証に失敗しました" });
      }
      if (role && user.role !== role && user.role !== "9") {
        return res.status(401).json({ error: "ログイン画面が異なります。" });
      }
      req.session.userId = user.id;
      await storage.updateUserLastLogin(user.id).catch(() => {});
      res.json({ message: "ログイン成功", user_role: user.role });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "ログアウトに失敗しました" });
      res.clearCookie("connect.sid");
      res.json({ detail: "Successfully logged out." });
    });
  });

  app.post("/api/password_reset_request", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "メールアドレスを入力してください" });
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "登録されているメールアドレスの場合、リセットリンクが発行されます。" });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      const isDev = process.env.NODE_ENV !== "production";
      if (isDev) {
        res.json({
          message: "パスワードリセットリンクが発行されました。30分以内にリセットしてください。",
          token,
          reset_url: `/password_reset?token=${token}`,
        });
      } else {
        res.json({ message: "登録されているメールアドレスの場合、リセットリンクが発行されます。" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/password_reset", async (req: Request, res: Response) => {
    try {
      const { token, new_password } = req.body;
      if (!token || !new_password) return res.status(400).json({ error: "トークンと新しいパスワードは必須です" });
      if (new_password.length < 6) return res.status(400).json({ error: "パスワードは6文字以上で入力してください" });
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) return res.status(400).json({ error: "無効なリセットトークンです" });
      if (resetToken.usedAt) return res.status(400).json({ error: "このリセットリンクは既に使用されています" });
      if (new Date() > resetToken.expiresAt) return res.status(400).json({ error: "リセットリンクの有効期限が切れています" });
      const hashed = await bcrypt.hash(new_password, 10);
      await storage.updateUserPassword(resetToken.userId, hashed);
      await storage.markPasswordResetTokenUsed(token);
      res.json({ message: "パスワードが正常にリセットされました。新しいパスワードでログインしてください。" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/upload_image", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "画像ファイルを選択してください" });

      const imageType = req.body.type as string;
      if (!imageType || !["icon", "banner"].includes(imageType)) {
        return res.status(400).json({ error: "typeはiconまたはbannerを指定してください" });
      }

      const metadata = await sharp(file.buffer).metadata();
      const w = metadata.width || 0;
      const h = metadata.height || 0;

      if (imageType === "icon") {
        if (file.size > 2 * 1024 * 1024) {
          return res.status(400).json({ error: "アイコン画像は2MB以下にしてください" });
        }
        const ratio = w / h;
        if (ratio < 0.9 || ratio > 1.1) {
          return res.status(400).json({ error: "アイコン画像は正方形（1:1）の画像を使用してください。現在の縦横比: " + ratio.toFixed(2) });
        }
      } else {
        const ratio = w / h;
        if (ratio < 1.5 || ratio > 2.0) {
          return res.status(400).json({ error: "バナー画像は横長（16:9〜2:1）の画像を使用してください。現在の縦横比: " + ratio.toFixed(2) });
        }
      }

      const ext = "webp";
      const filename = `${imageType}_${req.session.userId}_${Date.now()}.${ext}`;
      const outputPath = path.join(UPLOADS_DIR, filename);

      if (imageType === "icon") {
        await sharp(file.buffer).resize(200, 200, { fit: "cover" }).webp({ quality: 85 }).toFile(outputPath);
      } else {
        await sharp(file.buffer).resize(800, 450, { fit: "cover" }).webp({ quality: 85 }).toFile(outputPath);
      }

      const url = `/uploads/${filename}`;
      res.json({ url, message: "画像をアップロードしました" });
    } catch (e: any) {
      if (e.message?.includes("アップロード")) {
        return res.status(400).json({ error: e.message });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/get_login_info", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.json(null);
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.json(null);
    }
    res.json({ id: user.id, email: user.email, role: user.role });
  });

  app.post("/api/register_querent", async (req: Request, res: Response) => {
    try {
      const { email, password, name, tel_number, postal_code, address, birthdate, zodiac_sign, birthplace, birthtime, worry_category, worry_message } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "必須フィールドが不足しています" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "このメールアドレスは既に登録されています" });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, password: hashed, role: "1" });
      await storage.createQuerentProfile({
        userId: user.id,
        name: name || "",
        telNumber: tel_number || "",
        postalCode: postal_code || "",
        address: address || "",
        birthdate: birthdate || "",
        zodiacSign: zodiac_sign || "",
        birthplace: birthplace || "",
        birthtime: birthtime || "",
        worryCategory: worry_category || "",
        worryMessage: worry_message || "",
      });
      req.session.userId = user.id;
      res.status(201).json({ message: "登録しました" });
    } catch (e: any) {
      res.status(400).json({ error: `エラーが発生しました: ${e.message}` });
    }
  });

  app.post("/api/register_fortuneteller", async (req: Request, res: Response) => {
    try {
      const { name, email, password, headline, intro } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "必須フィールドが不足しています" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "このメールアドレスは既に登録されています" });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, password: hashed, role: "2" });
      await storage.createFortunetellerProfile({
        userId: user.id,
        name: name || "",
        headline: headline || "",
        intro: intro || "",
        profileImage: "",
        iconImage: "",
      });
      req.session.userId = user.id;
      res.status(201).json({ message: "登録しました" });
    } catch (e: any) {
      res.status(400).json({ error: `エラーが発生しました: ${e.message}` });
    }
  });

  app.get("/api/get_fortuneteller_profiles", async (_req: Request, res: Response) => {
    try {
      const profiles = await storage.getAllFortunetellerProfiles();
      const list = await Promise.all(profiles.map(async (p) => {
        const revenue = await storage.getFortuneteller6MonthRevenue(p.userId);
        const rankInfo = computeRankFromRevenue(revenue);
        return {
          user_id: p.userId,
          name: p.name,
          rank: rankInfo.rank,
          rank_label: rankInfo.label,
          profile_image: p.profileImage,
          icon_image: p.iconImage,
          headline: p.headline,
          intro: p.intro,
          is_recommended: p.isRecommended,
          style: p.style,
          genre: p.genre,
          divination_methods: p.divinationMethods,
        };
      }));
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_fortuneteller_profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const profile = await storage.getFortunetellerProfile(user.id);
      if (!profile) return res.status(404).json({ error: "プロフィールが見つかりません" });
      const revenue = await storage.getFortuneteller6MonthRevenue(user.id);
      const rankInfo = computeRankFromRevenue(revenue);
      res.json({
        user_id: user.id,
        name: profile.name,
        rank: rankInfo.rank,
        rank_label: rankInfo.label,
        headline: profile.headline,
        intro: profile.intro,
        profile_image: profile.profileImage,
        icon_image: profile.iconImage,
        is_recommended: profile.isRecommended,
        style: profile.style,
        genre: profile.genre,
        divination_methods: profile.divinationMethods,
        regular_holidays: profile.regularHolidays,
        business_hours: profile.businessHours,
        long_intro: profile.longIntro,
        free_note: profile.freeNote || "",
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/my_fortuneteller_profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, headline, intro, style, genre, divination_methods, profile_image, icon_image, regular_holidays, business_hours, long_intro, free_note } = req.body;
      if (long_intro !== undefined && typeof long_intro === "string" && long_intro.length > 10000) {
        return res.status(400).json({ error: "紹介文は10,000文字以内にしてください" });
      }
      if (free_note !== undefined && typeof free_note === "string" && free_note.length > 3000) {
        return res.status(400).json({ error: "フリーメモは3,000文字以内にしてください" });
      }
      if (regular_holidays !== undefined && typeof regular_holidays === "string" && regular_holidays.length > 100) {
        return res.status(400).json({ error: "定休日は100文字以内にしてください" });
      }
      if (business_hours !== undefined && typeof business_hours === "string" && business_hours.length > 100) {
        return res.status(400).json({ error: "営業時間は100文字以内にしてください" });
      }
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (headline !== undefined) updateData.headline = headline;
      if (intro !== undefined) updateData.intro = intro;
      if (style !== undefined) updateData.style = Array.isArray(style) ? style : (style ? [style] : []);
      if (genre !== undefined) updateData.genre = genre;
      if (divination_methods !== undefined) updateData.divinationMethods = divination_methods;
      if (profile_image !== undefined) updateData.profileImage = profile_image;
      if (icon_image !== undefined) updateData.iconImage = icon_image;
      if (regular_holidays !== undefined) updateData.regularHolidays = regular_holidays;
      if (business_hours !== undefined) updateData.businessHours = business_hours;
      if (long_intro !== undefined) updateData.longIntro = long_intro;
      if (free_note !== undefined) updateData.freeNote = free_note;
      const updated = await storage.updateFortunetellerProfile(req.session.userId!, updateData);
      if (!updated) return res.status(400).json({ error: "更新に失敗しました" });
      res.json({ message: "更新しました" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_bank_info", requireAuth, async (req: Request, res: Response) => {
    try {
      const info = await storage.getBankInfo(req.session.userId!);
      res.json(info ? {
        name: info.name || "",
        branch_name: info.branchName || "",
        account_type: info.accountType || "",
        account_number: info.accountNumber || "",
        account_holder_name: info.accountHolderName || "",
      } : { name: "", branch_name: "", account_type: "", account_number: "", account_holder_name: "" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/my_bank_info", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, branch_name, account_type, account_number, account_holder_name } = req.body;
      const result = await storage.upsertBankInfo({
        userId: req.session.userId!,
        name, branchName: branch_name, accountType: account_type,
        accountNumber: account_number, accountHolderName: account_holder_name,
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_cashable", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const revenue = await storage.getFortuneteller6MonthRevenue(user.id);
      const rankInfo = computeRankFromRevenue(revenue);
      const bonusCashable = await storage.getFortunetellerBonusCashable(user.id);
      const withdrawn = await storage.getFortunetellerWithdrawnTotal(user.id);
      const totalCashable = rankInfo.cashable + bonusCashable;
      const availablePoints = Math.max(0, totalCashable - withdrawn);
      const yenAmount = Math.floor(availablePoints * 1.5);
      const transferFee = 1000;
      const netAmount = Math.max(0, yenAmount - transferFee);
      res.json({
        total_revenue: revenue,
        rank: rankInfo.rank,
        rank_label: rankInfo.label,
        total_cashable: totalCashable,
        rank_cashable: rankInfo.cashable,
        bonus_cashable: bonusCashable,
        withdrawn,
        available_points: availablePoints,
        yen_amount: yenAmount,
        transfer_fee: transferFee,
        net_amount: netAmount,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/apply_withdrawal", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const bank = await storage.getBankInfo(user.id);
      if (!bank || !bank.name || !bank.accountNumber || !bank.accountHolderName) {
        return res.status(400).json({ error: "振込先口座が未設定です。先に口座情報を保存してください。" });
      }
      const revenue = await storage.getFortuneteller6MonthRevenue(user.id);
      const rankInfo = computeRankFromRevenue(revenue);
      const bonusCashable = await storage.getFortunetellerBonusCashable(user.id);
      const withdrawn = await storage.getFortunetellerWithdrawnTotal(user.id);
      const totalCashable = rankInfo.cashable + bonusCashable;
      const availablePoints = Math.max(0, totalCashable - withdrawn);
      if (availablePoints <= 0) {
        return res.status(400).json({ error: "申請可能なポイントがありません" });
      }
      const yenAmount = Math.floor(availablePoints * 1.5);
      const transferFee = 1000;
      const netAmount = yenAmount - transferFee;
      if (netAmount <= 0) {
        return res.status(400).json({ error: "振込手数料を差し引くと振込額が0円以下になります" });
      }
      const request = await storage.createTransferRequest({
        fortunetellerId: user.id,
        amount: availablePoints,
        status: "pending",
      });
      res.json({
        message: "振込申請を受け付けました",
        request: {
          id: request.id,
          amount: request.amount,
          yen_amount: yenAmount,
          transfer_fee: transferFee,
          net_amount: netAmount,
          status: request.status,
          requested_at: request.requestedAt.toISOString(),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_withdrawals", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const requests = await storage.getTransferRequestsByFortuneTeller(user.id);
      res.json(requests.map((r) => ({
        id: r.id,
        amount: r.amount,
        yen_amount: Math.floor(r.amount * 1.5),
        transfer_fee: 1000,
        net_amount: Math.floor(r.amount * 1.5) - 1000,
        status: r.status,
        requested_at: r.requestedAt.toISOString(),
        approved_at: r.approvedAt?.toISOString() || null,
        scheduled_transfer_date: r.scheduledTransferDate?.toISOString() || null,
        transferred_at: r.transferredAt?.toISOString() || null,
      })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_rooms", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "認証エラー" });

      let roomList;
      if (user.role === "2") {
        roomList = await storage.getRoomsByFortuneteller(user.id);
      } else {
        roomList = await storage.getRoomsByQuerent(user.id);
      }

      const role = user.role === "2" ? "fortuneteller" : "querent";
      const result = [];
      for (const room of roomList) {
        const querent = await storage.getQuerentProfile(room.querentId);
        const ft = await storage.getFortunetellerProfile(room.fortunetellerId);
        const msgs = await storage.getMessagesByRoom(room.id);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const unreadCount = await storage.getUnreadCountForRoom(room.id, role as "querent" | "fortuneteller");
        result.push({
          id: room.id,
          querent_id: room.querentId,
          fortuneteller_id: room.fortunetellerId,
          querent_name: querent?.name || "不明",
          fortuneteller_name: ft?.name || "不明",
          fortuneteller_icon: ft?.iconImage || "",
          last_message: lastMsg
            ? (lastMsg.isLocked && (lastMsg.category === "treatment" || lastMsg.category === "length_paying")
                ? (lastMsg.category === "treatment" ? "[施術メッセージ]" : "[有料メッセージ]")
                : lastMsg.text || "")
            : "",
          last_message_sender: lastMsg?.sender || null,
          last_at: lastMsg?.createdAt.toISOString() || room.createdAt.toISOString(),
          unread_count: unreadCount,
        });
      }
      result.sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/send_dm", requireAuth, async (req: Request, res: Response) => {
    try {
      const { fortuneteller_id, text } = req.body;
      if (!fortuneteller_id || !text) {
        return res.status(400).json({ error: "必須フィールドが不足しています" });
      }
      const room = await storage.getOrCreateRoom(fortuneteller_id, req.session.userId!);
      const msg = await storage.createMessage({
        roomId: room.id,
        sender: "querent",
        text,
      });
      res.status(201).json({ message: "送信しました", room_id: room.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/rooms/:id/mark_read", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "認証エラー" });
      const roomId = req.params.id as string;
      const room = await storage.getRoom(roomId);
      if (!room) return res.status(404).json({ error: "ルームが見つかりません" });
      if (room.querentId !== user.id && room.fortunetellerId !== user.id) {
        return res.status(403).json({ error: "権限がありません" });
      }
      const role: "querent" | "fortuneteller" = user.role === "2" ? "fortuneteller" : "querent";
      await storage.markRoomRead(roomId, role);
      res.json({ message: "既読にしました" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/unread_count", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ error: "認証エラー" });
      const role = user.role === "2" ? "fortuneteller" : "querent";
      const count = await storage.getTotalUnreadCount(user.id, role as "querent" | "fortuneteller");
      res.json({ unread_count: count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_rank_summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const revenue = await storage.getFortuneteller6MonthRevenue(user.id);
      const rankInfo = computeRankFromRevenue(revenue);
      await storage.updateFortunetellerProfile(user.id, { rank: rankInfo.rank });
      res.json({
        total_revenue: revenue,
        rank: rankInfo.rank,
        rank_label: rankInfo.label,
        cashable_points: rankInfo.cashable,
        thresholds: RANK_THRESHOLDS.map((t) => ({
          rank: t.rank,
          label: t.label,
          min_revenue: t.minRevenue,
          cashable: t.cashable,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/get_querent_info", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });
      const profile = await storage.getQuerentProfile(user.id);
      if (!profile) return res.status(404).json({ error: "プロフィールが見つかりません" });

      const activeSub = await storage.getActiveSubscription(user.id);
      const isSubActive = !!activeSub;
      if (profile.isSubscription !== isSubActive) {
        await storage.updateQuerentProfile(user.id, { isSubscription: isSubActive });
      }

      res.json({
        name: profile.name,
        email: user.email,
        address: profile.address,
        birthdate: profile.birthdate,
        zodiac_sign: profile.zodiacSign,
        birthplace: profile.birthplace,
        birthtime: profile.birthtime,
        worry_category: profile.worryCategory,
        worry_message: profile.worryMessage,
        partner_name: profile.partnerName || "",
        partner_birthdate: profile.partnerBirthdate || "",
        partner_zodiac_sign: profile.partnerZodiacSign || "",
        partner_birthplace: profile.partnerBirthplace || "",
        partner_birthtime: profile.partnerBirthtime || "",
        subscription: isSubActive,
        subscription_plan_type: activeSub ? (activeSub as any).planType || "standard" : null,
        subscription_end_date: activeSub ? activeSub.endDate.toISOString() : null,
        point: profile.points,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const karteSchema = z.object({
    birthdate: z.string().optional().default(""),
    zodiac_sign: z.string().optional().default(""),
    birthplace: z.string().optional().default(""),
    birthtime: z.string().optional().default(""),
    worry_category: z.string().optional().default(""),
    worry_message: z.string().max(1000).optional().default(""),
    partner_name: z.string().max(20).optional().default(""),
    partner_birthdate: z.string().optional().default(""),
    partner_zodiac_sign: z.string().optional().default(""),
    partner_birthplace: z.string().optional().default(""),
    partner_birthtime: z.string().optional().default(""),
  });

  app.post("/api/edit_querent_karte", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });
      const parsed = karteSchema.parse(req.body);
      const updated = await storage.updateQuerentProfile(user.id, {
        birthdate: parsed.birthdate, zodiacSign: parsed.zodiac_sign,
        birthplace: parsed.birthplace, birthtime: parsed.birthtime,
        worryCategory: parsed.worry_category, worryMessage: parsed.worry_message,
        partnerName: parsed.partner_name, partnerBirthdate: parsed.partner_birthdate,
        partnerZodiacSign: parsed.partner_zodiac_sign, partnerBirthplace: parsed.partner_birthplace,
        partnerBirthtime: parsed.partner_birthtime,
      });
      if (!updated) return res.status(400).json({ error: "更新に失敗しました" });
      res.json({ message: "更新しました" });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  const infoSchema = z.object({
    name: z.string().max(20).optional(),
    address: z.string().max(255).optional(),
  });

  app.post("/api/edit_querent_info", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });
      const parsed = infoSchema.parse(req.body);
      const updated = await storage.updateQuerentProfile(user.id, {
        name: parsed.name, address: parsed.address,
      });
      if (!updated) return res.status(400).json({ error: "更新に失敗しました" });
      res.json({ message: "更新しました" });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/get_room", requireAuth, async (req: Request, res: Response) => {
    try {
      const fortunetellerId = parseInt(req.query.fortuneteller as string, 10);
      if (isNaN(fortunetellerId)) return res.status(400).json({ error: "fortuneteller is required" });
      const room = await storage.getRoomByPair(fortunetellerId, req.session.userId!);
      if (!room) return res.json(null);
      res.json({ id: room.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/all_querents", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const filter = (req.query.filter as string) || "all";

      const profiles = await storage.getAllQuerentProfiles();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      const rooms = await storage.getRoomsByFortuneteller(user.id);
      const roomMap = new Map(rooms.map((r) => [r.querentId, r]));

      const now = new Date();
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const list = await Promise.all(profiles.map(async (p) => {
        const u = userMap.get(p.userId);
        const room = roomMap.get(p.userId);
        let lastMsgAt: Date | null = null;
        let msgCount = 0;
        let ftMsgCount = 0;
        let hasUnread = false;

        if (room) {
          const msgs = await storage.getMessagesByRoom(room.id);
          msgCount = msgs.filter((m) => m.sender === "querent").length;
          ftMsgCount = msgs.filter((m) => m.sender === "fortuneteller").length;
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg) lastMsgAt = lastMsg.createdAt;
          hasUnread = msgs.some(
            (m) => !m.isLocked && (m.category === "treatment" || m.category === "length_paying")
          );
        }

        const isNew = room && msgCount > 0 && ftMsgCount === 0;
        const isRevisit = room && ftMsgCount > 0 && lastMsgAt && (now.getTime() - lastMsgAt.getTime()) < 7 * 24 * 60 * 60 * 1000;
        const isPast = room && msgCount > 0 && lastMsgAt && (now.getTime() - lastMsgAt.getTime()) > 30 * 24 * 60 * 60 * 1000;
        const isDig = room && msgCount > 0 && lastMsgAt && (now.getTime() - lastMsgAt.getTime()) > 7 * 24 * 60 * 60 * 1000 && !isPast;
        const loggedInRecent = u?.lastLoginAt && u.lastLoginAt > thirtyMinAgo;

        const activeSub = await storage.getActiveSubscription(p.userId);
        const isSubscriber = !!activeSub;

        let include = true;
        if (filter === "new") include = !!isNew;
        else if (filter === "revisit") include = !!isRevisit;
        else if (filter === "past") include = !!isPast;
        else if (filter === "dig") include = !!isDig;
        else if (filter === "unread") include = hasUnread;
        else if (filter === "login30") include = !!loggedInRecent;
        else if (filter === "subscriber") include = isSubscriber;

        if (!include) return null;

        return {
          user_id: p.userId,
          name: p.name,
          zodiac_sign: p.zodiacSign,
          worry_category: p.worryCategory,
          worry_message: p.worryMessage,
          birthdate: p.birthdate,
          points: p.points,
          is_subscription: isSubscriber,
          last_login_at: u?.lastLoginAt?.toISOString() || null,
          has_room: !!room,
          is_new: !!isNew,
          is_revisit: !!isRevisit,
          has_unread: hasUnread,
          logged_in_recent: !!loggedInRecent,
        };
      }));

      res.json(list.filter(Boolean));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const bulkSendLastAt = new Map<number, number>();

  app.post("/api/send_bulk_message", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });

      const last = bulkSendLastAt.get(user.id) ?? 0;
      const diffMs = Date.now() - last;
      const COOLTIME_MS = 30 * 60 * 1000;
      if (diffMs < COOLTIME_MS) {
        const remainSec = Math.ceil((COOLTIME_MS - diffMs) / 1000);
        const remainMin = Math.ceil(remainSec / 60);
        return res.status(429).json({ error: `一括送信のクールタイム中です。あと約${remainMin}分後に再送信できます。` });
      }

      const schema = z.object({
        querent_ids: z.array(z.number()).min(1, "送信先を1人以上選択してください").max(100, "一括送信は100人までです"),
        text: z.string().min(1, "メッセージを入力してください").max(150, "メッセージは150文字以内で入力してください"),
      });
      const parsed = schema.parse(req.body);

      bulkSendLastAt.set(user.id, Date.now());

      const results = [];
      for (const querentId of parsed.querent_ids) {
        const room = await storage.getOrCreateRoom(user.id, querentId);
        const msg = await storage.createMessage({
          roomId: room.id,
          sender: "fortuneteller",
          text: parsed.text,
        });
        results.push({ querent_id: querentId, room_id: room.id, message_id: msg.id });
      }

      res.status(201).json({ message: `${results.length}名にメッセージを送信しました`, results });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message || "入力エラー" });
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/querent_karte/:querentId", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const querentId = parseInt(req.params.querentId);
      const profile = await storage.getQuerentProfile(querentId);
      if (!profile) return res.status(404).json({ error: "見つかりません" });
      res.json({
        name: profile.name,
        birthdate: profile.birthdate,
        zodiac_sign: profile.zodiacSign,
        birthplace: profile.birthplace,
        birthtime: profile.birthtime,
        worry_category: profile.worryCategory,
        worry_message: profile.worryMessage,
        partner_name: profile.partnerName || "",
        partner_birthdate: profile.partnerBirthdate || "",
        points: profile.points,
        is_subscription: profile.isSubscription,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/unlock_message", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });

      const { message_id } = req.body;
      if (!message_id) return res.status(400).json({ error: "message_id is required" });

      const msg = await storage.getMessage(Number(message_id));
      if (!msg) return res.status(404).json({ error: "メッセージが見つかりません" });
      if (!msg.isLocked) return res.status(400).json({ error: "このメッセージは既に開封済みです" });
      if (msg.category !== "treatment" && msg.category !== "length_paying") return res.status(400).json({ error: "施術・有料メッセージのみ開封できます" });

      const room = await storage.getRoom(msg.roomId);
      if (!room || room.querentId !== user.id) return res.status(403).json({ error: "権限がありません" });

      const cost = msg.costPt ?? 0;
      if (cost > 0) {
        const activeSub = await storage.getActiveSubscription(user.id);
        if (!activeSub) {
          const deducted = await storage.deductPoints(user.id, cost);
          if (!deducted) return res.status(400).json({ error: "ポイントが不足しています" });
        }
      }

      const updated = await storage.unlockMessage(msg.id);
      if (!updated) return res.status(500).json({ error: "開封に失敗しました" });

      const querentProfile = await storage.getQuerentProfile(user.id);
      if (broadcast) {
        broadcast(String(msg.roomId), {
          type: "message_unlocked",
          message_id: String(msg.id),
          cost_pt: cost,
        });
      }
      if (broadcastToAdvisor) {
        broadcastToAdvisor(room.fortunetellerId, {
          type: "unlock_notification",
          room_id: String(msg.roomId),
          querent_name: querentProfile?.name || "相談者",
          cost_pt: cost,
        });
      }

      res.json({
        message: "施術メッセージを開封しました",
        unlocked_message: {
          id: String(updated.id),
          text: updated.text,
          title: updated.title,
          cost_pt: updated.costPt,
          is_locked: false,
          category: updated.category,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/get_fortuneteller_all", async (_req: Request, res: Response) => {
    try {
      const profiles = await storage.getAllFortunetellerProfiles();
      const list = await Promise.all(profiles.map(async (p) => {
        const revenue = await storage.getFortuneteller6MonthRevenue(p.userId);
        const rankInfo = computeRankFromRevenue(revenue);
        return {
          id: p.userId,
          user_id: p.userId,
          name: p.name,
          rank: rankInfo.rank,
          rank_label: rankInfo.label,
          profile_image: p.profileImage,
          icon_image: p.iconImage,
          headline: p.headline,
          intro: p.intro,
          is_recommended: p.isRecommended,
          style: p.style,
          genre: p.genre,
          divination_methods: p.divinationMethods,
          regular_holidays: p.regularHolidays,
          business_hours: p.businessHours,
          long_intro: p.longIntro,
          tags: [p.genre, p.headline].filter(Boolean),
        };
      }));
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_subscription", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });
      const sub = await storage.getActiveSubscription(user.id);
      if (!sub) return res.json({ active: false, subscription: null });
      res.json({
        active: true,
        subscription: {
          id: sub.id,
          amount: sub.amount,
          start_date: sub.startDate.toISOString(),
          end_date: sub.endDate.toISOString(),
          status: sub.status,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/subscribe", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });

      const existing = await storage.getActiveSubscription(user.id);
      if (existing) return res.status(400).json({ error: "既にサブスクリプション契約中です" });

      const planType = req.body.plan_type === "premium" ? "premium" : "standard";
      const amount = planType === "premium" ? 50000 : 20000;

      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sub = await storage.createSubscription({
        querentId: user.id,
        amount,
        planType,
        status: "active",
        startDate: now,
        endDate,
      } as any);

      await storage.updateQuerentProfile(user.id, { isSubscription: true });

      res.status(201).json({
        message: `サブスクリプションを開始しました（${amount.toLocaleString()}円/30日）`,
        subscription: {
          id: sub.id,
          amount: sub.amount,
          plan_type: planType,
          start_date: sub.startDate.toISOString(),
          end_date: sub.endDate.toISOString(),
          status: sub.status,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/cancel_subscription", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });

      const existing = await storage.getActiveSubscription(user.id);
      if (!existing) return res.status(400).json({ error: "有効なサブスクリプションがありません" });

      await storage.cancelSubscription(user.id);
      res.json({ message: "サブスクリプションを解約しました" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Advisor Menus ----

  app.get("/api/my_menus", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const menus = await storage.getAdvisorMenus(user.id);
      res.json(menus.map((m) => ({ id: m.id, menu_type: m.menuType, name: m.name, required_pt: m.requiredPt, sort_order: m.sortOrder })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/my_menus", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const schema = z.object({ menu_type: z.enum(["treatment", "divination"]), name: z.string().min(1).max(50), required_pt: z.number().int().min(0) });
      const parsed = schema.parse(req.body);
      const existing = await storage.getAdvisorMenus(user.id);
      const menu = await storage.createAdvisorMenu({ fortunetellerId: user.id, menuType: parsed.menu_type, name: parsed.name, requiredPt: parsed.required_pt, sortOrder: existing.length });
      res.status(201).json({ id: menu.id, menu_type: menu.menuType, name: menu.name, required_pt: menu.requiredPt, sort_order: menu.sortOrder });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/my_menus/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const id = parseInt(req.params.id);
      const schema = z.object({ menu_type: z.enum(["treatment", "divination"]).optional(), name: z.string().min(1).max(50).optional(), required_pt: z.number().int().min(0).optional() });
      const parsed = schema.parse(req.body);
      const data: any = {};
      if (parsed.menu_type) data.menuType = parsed.menu_type;
      if (parsed.name) data.name = parsed.name;
      if (parsed.required_pt !== undefined) data.requiredPt = parsed.required_pt;
      const updated = await storage.updateAdvisorMenu(id, data);
      if (!updated) return res.status(404).json({ error: "メニューが見つかりません" });
      res.json({ id: updated.id, menu_type: updated.menuType, name: updated.name, required_pt: updated.requiredPt });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/my_menus/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      await storage.deleteAdvisorMenu(parseInt(req.params.id));
      res.json({ message: "削除しました" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/my_menus/reorder", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const { ids } = z.object({ ids: z.array(z.number()) }).parse(req.body);
      await storage.reorderAdvisorMenus(ids);
      res.json({ message: "並び替えました" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Advisor Templates ----

  app.get("/api/my_templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const tpls = await storage.getAdvisorTemplates(user.id);
      res.json(tpls.map((t) => ({ id: t.id, text: t.text, sort_order: t.sortOrder })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/my_templates", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const existing = await storage.getAdvisorTemplates(user.id);
      if (existing.length >= 100) return res.status(400).json({ error: "テンプレートは100件まで登録できます" });
      const { text } = z.object({ text: z.string().min(1).max(500) }).parse(req.body);
      const tpl = await storage.createAdvisorTemplate({ fortunetellerId: user.id, text, sortOrder: existing.length });
      res.status(201).json({ id: tpl.id, text: tpl.text, sort_order: tpl.sortOrder });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/my_templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const { text } = z.object({ text: z.string().min(1).max(500) }).parse(req.body);
      const updated = await storage.updateAdvisorTemplate(parseInt(req.params.id), { text });
      if (!updated) return res.status(404).json({ error: "テンプレートが見つかりません" });
      res.json({ id: updated.id, text: updated.text });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/my_templates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      await storage.deleteAdvisorTemplate(parseInt(req.params.id));
      res.json({ message: "削除しました" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/my_templates/reorder", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "2") return res.status(403).json({ error: "権限がありません" });
      const { ids } = z.object({ ids: z.array(z.number()) }).parse(req.body);
      await storage.reorderAdvisorTemplates(ids);
      res.json({ message: "並び替えました" });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ---- Stripe Payment ----

  app.get("/api/stripe/config", async (_req: Request, res: Response) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishable_key: publishableKey });
    } catch (e: any) {
      res.status(500).json({ error: "Stripe設定の取得に失敗しました" });
    }
  });

  app.post("/api/stripe/create_checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });

      const schema = z.object({ plan_type: z.enum(["standard", "premium"]) });
      const { plan_type } = schema.parse(req.body);

      const priceId = plan_type === "premium"
        ? process.env.STRIPE_PRICE_ID_50K
        : process.env.STRIPE_PRICE_ID_20K;

      if (!priceId) {
        return res.status(500).json({ error: "Stripe Price IDが設定されていません" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      const origin = req.headers.origin || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { querent_id: user.id.toString(), purchase_type: "subscription", plan_type },
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}&plan=${plan_type}`,
        cancel_url: `${origin}/?payment=cancel`,
      });

      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/stripe/verify_session", requireAuth, async (req: Request, res: Response) => {
    try {
      const { session_id } = req.body;
      if (!session_id || typeof session_id !== "string") {
        return res.status(400).json({ error: "session_idが必要です" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { processStripeSession } = await import("./stripePayments");
      const stripe = await getUncachableStripeClient();

      // サブスクリプションモードの場合に current_period_end を取得するため expand
      const stripeSession = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["subscription"],
      });

      const querentId = parseInt(stripeSession.metadata?.querent_id || "0");
      const loggedInUserId = req.session.userId!;
      if (!querentId || querentId !== loggedInUserId) {
        return res.status(403).json({ error: "セッションの所有者が一致しません" });
      }

      const result = await processStripeSession(stripeSession as any);
      log(`verify_session result: ${JSON.stringify(result)}`);
      return res.json(result);
    } catch (e: any) {
      log(`verify_session error: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/my_subscription_slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });
      const activeSub = await storage.getActiveSubscription(user.id);
      if (!activeSub) return res.json({ slot_advisor_ids: [], count: 0, max: 5 });
      const subStart = activeSub.startDate;
      const slotAdvisors = await storage.getSubscriptionSlotAdvisors(user.id, subStart);
      res.json({ slot_advisor_ids: slotAdvisors, count: slotAdvisors.length, max: 5 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/stripe/create_point_checkout", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user || user.role !== "1") return res.status(403).json({ error: "権限がありません" });
      const VALID_AMOUNTS = new Set([500, 1000, 3000, 5000, 10000, 30000]);
      const schema = z.object({ amount_yen: z.number().int().refine((v) => VALID_AMOUNTS.has(v), { message: "無効な金額です" }) });
      const { amount_yen } = schema.parse(req.body);
      const pts = Math.ceil(amount_yen / 1.5);
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const origin = req.headers.origin || `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "jpy",
            unit_amount: amount_yen,
            product_data: { name: `ポイント購入 ${pts.toLocaleString()}pt (${amount_yen.toLocaleString()}円)` },
          },
          quantity: 1,
        }],
        metadata: { querent_id: user.id.toString(), purchase_type: "points", points: pts.toString() },
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}&type=points&pts=${pts}`,
        cancel_url: `${origin}/?payment=cancel`,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Admin API Routes ----

  app.get("/api/admin/ranking", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const profiles = await storage.getAllFortunetellerProfiles();
      const withRevenue = await Promise.all(profiles.map(async (p) => {
        const revenue = await storage.getFortuneteller6MonthRevenue(p.userId);
        const rankInfo = computeRankFromRevenue(revenue);
        return { ...p, revenue, computedRank: rankInfo.rank, rankLabel: rankInfo.label, cashable: rankInfo.cashable };
      }));
      const sorted = withRevenue
        .sort((a, b) => {
          if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
          return b.revenue - a.revenue;
        })
        .map((p, i) => ({
          rank_position: i + 1,
          user_id: p.userId,
          name: p.name,
          headline: p.headline,
          rank: p.computedRank,
          rank_label: p.rankLabel,
          revenue: p.revenue,
          cashable: p.cashable,
          is_recommended: p.isRecommended,
          style: p.style,
          genre: p.genre,
          icon_image: p.iconImage,
        }));
      res.json(sorted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const adminRankingSchema = z.object({
    is_recommended: z.boolean().optional(),
  });

  app.patch("/api/admin/ranking/:userId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId as string);
      const parsed = adminRankingSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "入力が不正です" });
      const data: any = {};
      if (parsed.data.is_recommended !== undefined) data.isRecommended = parsed.data.is_recommended;
      const updated = await storage.updateFortunetellerProfile(userId, data);
      if (!updated) return res.status(404).json({ error: "占い師が見つかりません" });
      res.json({ message: "更新しました", profile: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/transfer_requests", requireAdmin, async (_req: Request, res: Response) => {
    try {
      await storage.markTransferredRequests();
      const requests = await storage.getAllTransferRequests();
      const profiles = await storage.getAllFortunetellerProfiles();
      const profileMap = new Map(profiles.map((p) => [p.userId, p]));
      const list = requests.map((r) => ({
        id: r.id,
        fortuneteller_id: r.fortunetellerId,
        fortuneteller_name: profileMap.get(r.fortunetellerId)?.name || "不明",
        amount: r.amount,
        status: r.status,
        requested_at: r.requestedAt.toISOString(),
        approved_at: r.approvedAt?.toISOString() || null,
        scheduled_transfer_date: r.scheduledTransferDate?.toISOString() || null,
        transferred_at: r.transferredAt?.toISOString() || null,
      }));
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const adminApproveSchema = z.object({
    scheduled_transfer_date: z.string().refine((v) => !isNaN(new Date(v).getTime()), { message: "日付形式が不正です" }),
  });

  app.post("/api/admin/transfer_requests/:id/approve", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const parsed = adminApproveSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || "入力が不正です" });
      const scheduledDate = new Date(parsed.data.scheduled_transfer_date);
      const updated = await storage.approveTransferRequest(id, scheduledDate);
      if (!updated) return res.status(404).json({ error: "申請が見つからないか既に処理済みです" });
      res.json({ message: "承認しました", request: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const ftProfiles = await storage.getAllFortunetellerProfiles();
      const qProfiles = await storage.getAllQuerentProfiles();
      const ftMap = new Map(ftProfiles.map((p) => [p.userId, p]));
      const qMap = new Map(qProfiles.map((p) => [p.userId, p]));

      const RANK_LABELS: Record<string, string> = {
        NORMAL: "ノーマル", BRONZE: "ブロンズ", SILVER: "シルバー", GOLD: "ゴールド",
        PLATINUM: "プラチナ", PLATINUM_PLUS: "プラチナ+", DIAMOND: "ダイヤモンド", DIAMOND_PLUS: "ダイヤモンド+",
      };
      const list = allUsers.map((u) => {
        const ft = ftMap.get(u.id);
        const q = qMap.get(u.id);
        const rank = ft?.rank || null;
        const rankLabel = rank ? (RANK_LABELS[rank] || rank) : null;
        return {
          id: u.id,
          email: u.email,
          role: u.role,
          role_label: u.role === "1" ? "相談者" : u.role === "2" ? "占い師" : u.role === "9" ? "管理者" : "不明",
          created_at: u.createdAt.toISOString(),
          profile_name: ft?.name || q?.name || null,
          rank,
          rank_label: rankLabel,
          points: q?.points ?? null,
          is_subscription: q?.isSubscription ?? null,
        };
      });
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const VALID_RANKS = ["NORMAL", "BRONZE", "SILVER", "GOLD", "PLATINUM", "PLATINUM_PLUS", "DIAMOND", "DIAMOND_PLUS"] as const;
  const adminUserUpdateSchema = z.object({
    email: z.string().email().optional(),
    profile_name: z.string().max(100).optional(),
    rank: z.enum(VALID_RANKS).optional(),
    points: z.number().int().min(0).optional(),
    is_subscription: z.boolean().optional(),
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });

      const parsed = adminUserUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "入力が不正です", details: parsed.error.issues });
      const { email, profile_name, rank, points, is_subscription } = parsed.data;
      if (email) await storage.updateUser(id, { email });

      if (user.role === "2") {
        const data: any = {};
        if (profile_name) data.name = profile_name;
        if (rank) data.rank = rank;
        if (Object.keys(data).length > 0) await storage.updateFortunetellerProfile(id, data);
      }

      if (user.role === "1") {
        const data: any = {};
        if (profile_name) data.name = profile_name;
        if (typeof points === "number") data.points = points;
        if (typeof is_subscription === "boolean") data.isSubscription = is_subscription;
        if (Object.keys(data).length > 0) await storage.updateQuerentProfile(id, data);
      }

      res.json({ message: "更新しました" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });
      if (user.role === "9") return res.status(400).json({ error: "管理者は削除できません" });
      await storage.deleteUser(id);
      res.json({ message: "退会処理が完了しました" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/fortunetellers", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const profiles = await storage.getAllFortunetellerProfiles();
      const list = profiles.map((p) => ({
        user_id: p.userId,
        name: p.name,
        headline: p.headline,
        rank: p.rank,
        is_recommended: p.isRecommended,
        style: p.style,
        genre: p.genre,
        divination_methods: p.divinationMethods,
        profile_image: p.profileImage,
        icon_image: p.iconImage,
      }));
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/fortunetellers/:userId/upload_image",
    requireAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const userId = parseInt(req.params.userId);
        const imageType = req.body.image_type as "banner" | "icon";
        if (!["banner", "icon"].includes(imageType)) return res.status(400).json({ error: "image_typeはbanner/iconのいずれかです" });
        if (!req.file) return res.status(400).json({ error: "ファイルが必要です" });

        const sharpImg = sharp(req.file.buffer);
        const meta = await sharpImg.metadata();
        const w = meta.width || 1;
        const h = meta.height || 1;
        const ratio = w / h;

        if (imageType === "icon") {
          if (Math.abs(ratio - 1) > 0.15) return res.status(400).json({ error: "アイコンは正方形（1:1）で提供してください" });
          if (req.file.size > 5 * 1024 * 1024) return res.status(400).json({ error: "アイコンは5MB以内にしてください" });
        } else {
          if (ratio < 16 / 10 || ratio > 2.1) return res.status(400).json({ error: "バナーは横長（16:9〜2:1）で提供してください" });
          if (req.file.size > 10 * 1024 * 1024) return res.status(400).json({ error: "バナーは10MB以内にしてください" });
        }

        const webpBuffer = imageType === "icon"
          ? await sharpImg.resize(400, 400, { fit: "cover" }).webp({ quality: 85 }).toBuffer()
          : await sharpImg.resize(1200, 675, { fit: "cover" }).webp({ quality: 85 }).toBuffer();

        const base64 = webpBuffer.toString("base64");
        const dataUrl = `data:image/webp;base64,${base64}`;

        const data: any = {};
        if (imageType === "icon") data.iconImage = dataUrl;
        else data.profileImage = dataUrl;
        await storage.updateFortunetellerProfile(userId, data);

        res.json({ url: dataUrl, image_type: imageType });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );
}
