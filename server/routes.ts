import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "認証が必要です" });
  }
  next();
}

export function registerRoutes(app: Express) {
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
      if (role && user.role !== role) {
        return res.status(401).json({ error: "ログイン画面が異なります。" });
      }
      req.session.userId = user.id;
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
      const list = profiles.map((p) => ({
        user_id: p.userId,
        name: p.name,
        rank: p.rank,
        profile_image: p.profileImage,
        icon_image: p.iconImage,
        headline: p.headline,
        intro: p.intro,
        is_recommended: p.isRecommended,
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
      res.json({
        user_id: user.id,
        name: profile.name,
        rank: profile.rank,
        headline: profile.headline,
        intro: profile.intro,
        profile_image: profile.profileImage,
        icon_image: profile.iconImage,
        is_recommended: profile.isRecommended,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/my_fortuneteller_profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, headline, intro } = req.body;
      const updated = await storage.updateFortunetellerProfile(req.session.userId!, { name, headline, intro });
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

      const result = [];
      for (const room of roomList) {
        const querent = await storage.getQuerentProfile(room.querentId);
        const msgs = await storage.getMessagesByRoom(room.id);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        result.push({
          id: room.id,
          querent_id: room.querentId,
          querent_name: querent?.name || "不明",
          last_message: lastMsg?.text || "",
          last_at: lastMsg?.createdAt.toISOString() || room.createdAt.toISOString(),
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
}
