import { db } from "./db";
import { eq, and, desc, gte, sql, ne, count, asc } from "drizzle-orm";
import { lte } from "drizzle-orm";
import {
  users, fortunetellerProfiles, querentProfiles, bankInfo, rooms, messages, subscriptions, transferRequests, passwordResetTokens,
  advisorMenus, advisorTemplates,
  type User, type InsertUser,
  type FortunetellerProfile, type InsertFortunetellerProfile,
  type QuerentProfile, type InsertQuerentProfile,
  type BankInfo, type InsertBankInfo,
  type Room, type InsertRoom,
  type Message, type InsertMessage,
  type Subscription, type InsertSubscription,
  type TransferRequest, type InsertTransferRequest,
  type AdvisorMenu, type InsertAdvisorMenu,
  type AdvisorTemplate, type InsertAdvisorTemplate,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getFortunetellerProfile(userId: number): Promise<FortunetellerProfile | undefined>;
  getAllFortunetellerProfiles(): Promise<FortunetellerProfile[]>;
  createFortunetellerProfile(profile: InsertFortunetellerProfile): Promise<FortunetellerProfile>;
  updateFortunetellerProfile(userId: number, data: Partial<InsertFortunetellerProfile>): Promise<FortunetellerProfile | undefined>;

  getQuerentProfile(userId: number): Promise<QuerentProfile | undefined>;
  getAllQuerentProfiles(): Promise<QuerentProfile[]>;
  createQuerentProfile(profile: InsertQuerentProfile): Promise<QuerentProfile>;
  updateQuerentProfile(userId: number, data: Partial<InsertQuerentProfile>): Promise<QuerentProfile | undefined>;

  getBankInfo(userId: number): Promise<BankInfo | undefined>;
  upsertBankInfo(data: InsertBankInfo): Promise<BankInfo>;

  getRoom(id: string): Promise<Room | undefined>;
  getRoomByPair(fortunetellerId: number, querentId: number): Promise<Room | undefined>;
  getOrCreateRoom(fortunetellerId: number, querentId: number): Promise<Room>;
  getRoomsByFortuneteller(fortunetellerId: number): Promise<Room[]>;
  getRoomsByQuerent(querentId: number): Promise<Room[]>;

  getMessagesByRoom(roomId: string): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  createMessages(msgs: InsertMessage[]): Promise<Message[]>;
  unlockMessage(id: number): Promise<Message | undefined>;

  deductPoints(userId: number, amount: number): Promise<boolean>;

  getActiveSubscription(querentId: number): Promise<Subscription | undefined>;
  getAllSubscriptions(): Promise<Subscription[]>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  cancelSubscription(querentId: number): Promise<void>;
  getSubscriptionByStripeId(stripeSubId: string): Promise<Subscription | undefined>;
  renewSubscription(stripeSubId: string, newEndDate: Date): Promise<void>;
  cancelSubscriptionByStripeId(stripeSubId: string): Promise<void>;

  getAllTransferRequests(): Promise<TransferRequest[]>;
  getTransferRequestsByFortuneTeller(fortunetellerId: number): Promise<TransferRequest[]>;
  getFortunetellerWithdrawnTotal(fortunetellerId: number): Promise<number>;
  createTransferRequest(req: InsertTransferRequest): Promise<TransferRequest>;
  approveTransferRequest(id: number, scheduledDate: Date): Promise<TransferRequest | undefined>;
  markTransferredRequests(): Promise<number>;

  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  updateUser(id: number, data: Partial<{ email: string; role: string }>): Promise<User | undefined>;

  getFortuneteller6MonthRevenue(fortunetellerId: number): Promise<number>;
  getFortunetellerRankingScore(fortunetellerId: number, period: "daily" | "monthly"): Promise<number>;
  hasFortunetellerRepliedInRoom(roomId: string, fortunetellerId: number, withinDays: number): Promise<boolean>;
  getUnreadCountForRoom(roomId: string, role: "querent" | "fortuneteller"): Promise<number>;
  markRoomRead(roomId: string, role: "querent" | "fortuneteller"): Promise<void>;
  getTotalUnreadCount(userId: number, role: "querent" | "fortuneteller"): Promise<number>;

  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserLastLogin(userId: number): Promise<void>;

  getSubscriptionSlotAdvisors(querentId: number, since: Date): Promise<number[]>;

  getAdvisorMenus(fortunetellerId: number): Promise<AdvisorMenu[]>;
  createAdvisorMenu(menu: InsertAdvisorMenu): Promise<AdvisorMenu>;
  updateAdvisorMenu(id: number, data: Partial<InsertAdvisorMenu>): Promise<AdvisorMenu | undefined>;
  deleteAdvisorMenu(id: number): Promise<void>;
  reorderAdvisorMenus(ids: number[]): Promise<void>;

  getAdvisorTemplates(fortunetellerId: number): Promise<AdvisorTemplate[]>;
  createAdvisorTemplate(tpl: InsertAdvisorTemplate): Promise<AdvisorTemplate>;
  updateAdvisorTemplate(id: number, data: Partial<InsertAdvisorTemplate>): Promise<AdvisorTemplate | undefined>;
  deleteAdvisorTemplate(id: number): Promise<void>;
  reorderAdvisorTemplates(ids: number[]): Promise<void>;

  getSubscriptionAdvisorCount(querentId: number): Promise<number>;
  isAdvisorInSubscription(querentId: number, fortunetellerId: number): Promise<boolean>;

  addFortunetellerBonusCashable(advisorId: number, pts: number): Promise<void>;
  getFortunetellerBonusCashable(advisorId: number): Promise<number>;
  settleTreatmentMessagesInRoom(roomId: string): Promise<number>;
  getExpiredUnsettledTreatmentMessages(): Promise<{ id: number; roomId: string; costPt: number; querentId: number }[]>;
  refundTreatmentMessage(id: number, querentId: number, pts: number): Promise<void>;
  addQuerentPoints(userId: number, pts: number): Promise<void>;
  isStripeSessionProcessed(sessionId: string): Promise<boolean>;
  markStripeSessionProcessed(sessionId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getFortunetellerProfile(userId: number): Promise<FortunetellerProfile | undefined> {
    const [profile] = await db.select().from(fortunetellerProfiles).where(eq(fortunetellerProfiles.userId, userId));
    return profile;
  }

  async getAllFortunetellerProfiles(): Promise<FortunetellerProfile[]> {
    return db.select().from(fortunetellerProfiles);
  }

  async createFortunetellerProfile(profile: InsertFortunetellerProfile): Promise<FortunetellerProfile> {
    const [created] = await db.insert(fortunetellerProfiles).values(profile).returning();
    return created;
  }

  async updateFortunetellerProfile(userId: number, data: Partial<InsertFortunetellerProfile>): Promise<FortunetellerProfile | undefined> {
    const [updated] = await db.update(fortunetellerProfiles).set(data).where(eq(fortunetellerProfiles.userId, userId)).returning();
    return updated;
  }

  async getQuerentProfile(userId: number): Promise<QuerentProfile | undefined> {
    const [profile] = await db.select().from(querentProfiles).where(eq(querentProfiles.userId, userId));
    return profile;
  }

  async getAllQuerentProfiles(): Promise<QuerentProfile[]> {
    return db.select().from(querentProfiles);
  }

  async createQuerentProfile(profile: InsertQuerentProfile): Promise<QuerentProfile> {
    const [created] = await db.insert(querentProfiles).values(profile).returning();
    return created;
  }

  async updateQuerentProfile(userId: number, data: Partial<InsertQuerentProfile>): Promise<QuerentProfile | undefined> {
    const [updated] = await db.update(querentProfiles).set(data).where(eq(querentProfiles.userId, userId)).returning();
    return updated;
  }

  async getBankInfo(userId: number): Promise<BankInfo | undefined> {
    const [info] = await db.select().from(bankInfo).where(eq(bankInfo.userId, userId));
    return info;
  }

  async upsertBankInfo(data: InsertBankInfo): Promise<BankInfo> {
    const existing = await this.getBankInfo(data.userId);
    if (existing) {
      const [updated] = await db.update(bankInfo).set(data).where(eq(bankInfo.userId, data.userId)).returning();
      return updated;
    }
    const [created] = await db.insert(bankInfo).values(data).returning();
    return created;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async getRoomByPair(fortunetellerId: number, querentId: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(
      and(eq(rooms.fortunetellerId, fortunetellerId), eq(rooms.querentId, querentId))
    );
    return room;
  }

  async getOrCreateRoom(fortunetellerId: number, querentId: number): Promise<Room> {
    const existing = await this.getRoomByPair(fortunetellerId, querentId);
    if (existing) return existing;
    const [created] = await db.insert(rooms).values({ fortunetellerId, querentId }).returning();
    return created;
  }

  async getRoomsByFortuneteller(fortunetellerId: number): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.fortunetellerId, fortunetellerId));
  }

  async getRoomsByQuerent(querentId: number): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.querentId, querentId));
  }

  async getMessagesByRoom(roomId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.roomId, roomId)).orderBy(messages.createdAt);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    return msg;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async createMessages(msgs: InsertMessage[]): Promise<Message[]> {
    if (msgs.length === 0) return [];
    return db.insert(messages).values(msgs).returning();
  }

  async deductPoints(userId: number, amount: number): Promise<boolean> {
    const result = await db.update(querentProfiles)
      .set({ points: sql`${querentProfiles.points} - ${amount}` })
      .where(and(eq(querentProfiles.userId, userId), gte(querentProfiles.points, amount)))
      .returning();
    return result.length > 0;
  }

  async getActiveSubscription(querentId: number): Promise<Subscription | undefined> {
    const now = new Date();
    const rows = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.querentId, querentId), eq(subscriptions.status, "active")))
      .orderBy(desc(subscriptions.endDate));
    return rows.find((s) => s.endDate > now);
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(sub).returning();
    return created;
  }

  async cancelSubscription(querentId: number): Promise<void> {
    await db.update(subscriptions)
      .set({ status: "cancelled" })
      .where(and(eq(subscriptions.querentId, querentId), eq(subscriptions.status, "active")));
    await db.update(querentProfiles)
      .set({ isSubscription: false })
      .where(eq(querentProfiles.userId, querentId));
  }

  async getSubscriptionByStripeId(stripeSubId: string): Promise<Subscription | undefined> {
    const rows = await db.select().from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return rows[0];
  }

  async renewSubscription(stripeSubId: string, newEndDate: Date): Promise<void> {
    const sub = await this.getSubscriptionByStripeId(stripeSubId);
    if (!sub) return;
    await db.update(subscriptions)
      .set({ endDate: newEndDate, status: "active" })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
    await db.update(querentProfiles)
      .set({ isSubscription: true })
      .where(eq(querentProfiles.userId, sub.querentId));
  }

  async cancelSubscriptionByStripeId(stripeSubId: string): Promise<void> {
    const sub = await this.getSubscriptionByStripeId(stripeSubId);
    if (!sub) return;
    await db.update(subscriptions)
      .set({ status: "cancelled" })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));
    await db.update(querentProfiles)
      .set({ isSubscription: false })
      .where(eq(querentProfiles.userId, sub.querentId));
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
  }

  async getAllTransferRequests(): Promise<TransferRequest[]> {
    return db.select().from(transferRequests).orderBy(desc(transferRequests.requestedAt));
  }

  async getTransferRequestsByFortuneTeller(fortunetellerId: number): Promise<TransferRequest[]> {
    return db.select().from(transferRequests)
      .where(eq(transferRequests.fortunetellerId, fortunetellerId))
      .orderBy(desc(transferRequests.requestedAt));
  }

  async getFortunetellerWithdrawnTotal(fortunetellerId: number): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${transferRequests.amount}), 0)`,
    })
      .from(transferRequests)
      .where(eq(transferRequests.fortunetellerId, fortunetellerId));
    return Number(result[0]?.total || 0);
  }

  async createTransferRequest(req: InsertTransferRequest): Promise<TransferRequest> {
    const [created] = await db.insert(transferRequests).values(req).returning();
    return created;
  }

  async approveTransferRequest(id: number, scheduledDate: Date): Promise<TransferRequest | undefined> {
    const [updated] = await db.update(transferRequests)
      .set({ status: "approved", approvedAt: new Date(), scheduledTransferDate: scheduledDate })
      .where(and(eq(transferRequests.id, id), eq(transferRequests.status, "pending")))
      .returning();
    return updated;
  }

  async markTransferredRequests(): Promise<number> {
    const now = new Date();
    const result = await db.update(transferRequests)
      .set({ status: "transferred", transferredAt: now })
      .where(and(eq(transferRequests.status, "approved"), lte(transferRequests.scheduledTransferDate, now)))
      .returning();
    return result.length;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.id);
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUser(id: number, data: Partial<{ email: string; role: string }>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getFortuneteller6MonthRevenue(fortunetellerId: number): Promise<number> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(COALESCE(${messages.costPt}, 0) + COALESCE(${messages.bonusPt}, 0)), 0)`,
    })
      .from(messages)
      .innerJoin(rooms, eq(messages.roomId, rooms.id))
      .where(
        and(
          eq(rooms.fortunetellerId, fortunetellerId),
          eq(messages.sender, "fortuneteller"),
          gte(messages.createdAt, sixMonthsAgo)
        )
      );
    return Number(result[0]?.total || 0);
  }

  async getFortunetellerRankingScore(fortunetellerId: number, period: "daily" | "monthly"): Promise<number> {
    const now = new Date();
    const since = period === "daily"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const ptResult = await db.select({
      total: sql<number>`COALESCE(SUM(COALESCE(${messages.costPt}, 0) + COALESCE(${messages.bonusPt}, 0)), 0)`,
    })
      .from(messages)
      .innerJoin(rooms, eq(messages.roomId, rooms.id))
      .where(and(
        eq(rooms.fortunetellerId, fortunetellerId),
        eq(messages.sender, "fortuneteller"),
        gte(messages.createdAt, since),
      ));

    const regularPts = Number(ptResult[0]?.total || 0);

    const subResult = await db.select({
      cnt: sql<number>`COUNT(DISTINCT ${rooms.querentId})`,
    })
      .from(messages)
      .innerJoin(rooms, eq(messages.roomId, rooms.id))
      .innerJoin(subscriptions, and(
        eq(subscriptions.querentId, rooms.querentId),
        eq(subscriptions.status, "active"),
      ))
      .where(and(
        eq(rooms.fortunetellerId, fortunetellerId),
        eq(messages.sender, "fortuneteller"),
        gte(messages.createdAt, since),
      ));

    const subCount = Number(subResult[0]?.cnt || 0);
    const subBonus = period === "daily" ? subCount * 1000 : subCount * 5000;
    return regularPts + subBonus;
  }

  async hasFortunetellerRepliedInRoom(roomId: string, fortunetellerId: number, withinDays: number): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - withinDays);
    const result = await db.select({ cnt: count() })
      .from(messages)
      .innerJoin(rooms, eq(messages.roomId, rooms.id))
      .where(
        and(
          eq(messages.roomId, roomId),
          eq(rooms.fortunetellerId, fortunetellerId),
          eq(messages.sender, "fortuneteller"),
          gte(messages.createdAt, since)
        )
      );
    return Number(result[0]?.cnt || 0) > 0;
  }

  async getUnreadCountForRoom(roomId: string, role: "querent" | "fortuneteller"): Promise<number> {
    const col = role === "querent" ? messages.isReadByQuerent : messages.isReadByFortuneteller;
    const senderFilter = role === "querent" ? "fortuneteller" : "querent";
    const result = await db.select({ cnt: count() })
      .from(messages)
      .where(and(eq(messages.roomId, roomId), eq(col, false), eq(messages.sender, senderFilter)));
    return Number(result[0]?.cnt || 0);
  }

  async markRoomRead(roomId: string, role: "querent" | "fortuneteller"): Promise<void> {
    const senderFilter = role === "querent" ? "fortuneteller" : "querent";
    if (role === "querent") {
      await db.update(messages)
        .set({ isReadByQuerent: true })
        .where(and(eq(messages.roomId, roomId), eq(messages.sender, senderFilter), eq(messages.isReadByQuerent, false)));
    } else {
      await db.update(messages)
        .set({ isReadByFortuneteller: true })
        .where(and(eq(messages.roomId, roomId), eq(messages.sender, senderFilter), eq(messages.isReadByFortuneteller, false)));
    }
  }

  async getTotalUnreadCount(userId: number, role: "querent" | "fortuneteller"): Promise<number> {
    const col = role === "querent" ? messages.isReadByQuerent : messages.isReadByFortuneteller;
    const senderFilter = role === "querent" ? "fortuneteller" : "querent";
    const roomCol = role === "querent" ? rooms.querentId : rooms.fortunetellerId;
    const result = await db.select({ cnt: count() })
      .from(messages)
      .innerJoin(rooms, eq(messages.roomId, rooms.id))
      .where(and(eq(roomCol, userId), eq(col, false), eq(messages.sender, senderFilter)));
    return Number(result[0]?.cnt || 0);
  }
  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getPasswordResetToken(token: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | undefined> {
    const [row] = await db.select({
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
    }).from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row || undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async getAdvisorMenus(fortunetellerId: number): Promise<AdvisorMenu[]> {
    return db.select().from(advisorMenus)
      .where(eq(advisorMenus.fortunetellerId, fortunetellerId))
      .orderBy(asc(advisorMenus.sortOrder));
  }

  async createAdvisorMenu(menu: InsertAdvisorMenu): Promise<AdvisorMenu> {
    const [m] = await db.insert(advisorMenus).values(menu).returning();
    return m;
  }

  async updateAdvisorMenu(id: number, data: Partial<InsertAdvisorMenu>): Promise<AdvisorMenu | undefined> {
    const [m] = await db.update(advisorMenus).set(data).where(eq(advisorMenus.id, id)).returning();
    return m;
  }

  async deleteAdvisorMenu(id: number): Promise<void> {
    await db.delete(advisorMenus).where(eq(advisorMenus.id, id));
  }

  async reorderAdvisorMenus(ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db.update(advisorMenus).set({ sortOrder: i }).where(eq(advisorMenus.id, ids[i]));
    }
  }

  async getAdvisorTemplates(fortunetellerId: number): Promise<AdvisorTemplate[]> {
    return db.select().from(advisorTemplates)
      .where(eq(advisorTemplates.fortunetellerId, fortunetellerId))
      .orderBy(asc(advisorTemplates.sortOrder));
  }

  async createAdvisorTemplate(tpl: InsertAdvisorTemplate): Promise<AdvisorTemplate> {
    const [t] = await db.insert(advisorTemplates).values(tpl).returning();
    return t;
  }

  async updateAdvisorTemplate(id: number, data: Partial<InsertAdvisorTemplate>): Promise<AdvisorTemplate | undefined> {
    const [t] = await db.update(advisorTemplates).set(data).where(eq(advisorTemplates.id, id)).returning();
    return t;
  }

  async deleteAdvisorTemplate(id: number): Promise<void> {
    await db.delete(advisorTemplates).where(eq(advisorTemplates.id, id));
  }

  async reorderAdvisorTemplates(ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db.update(advisorTemplates).set({ sortOrder: i }).where(eq(advisorTemplates.id, ids[i]));
    }
  }

  async getSubscriptionAdvisorCount(querentId: number): Promise<number> {
    const sub = await this.getActiveSubscription(querentId);
    if (!sub) return 0;
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT r.fortuneteller_id) as cnt
      FROM rooms r
      JOIN messages m ON m.room_id = r.id
      WHERE r.querent_id = ${querentId}
        AND m.created_at >= ${sub.startDate}
        AND m.sender = 'querent'
    `);
    return parseInt((result.rows[0] as any)?.cnt ?? "0");
  }

  async isAdvisorInSubscription(querentId: number, fortunetellerId: number): Promise<boolean> {
    const sub = await this.getActiveSubscription(querentId);
    if (!sub) return false;
    const result = await db.execute(sql`
      SELECT 1 FROM rooms r
      JOIN messages m ON m.room_id = r.id
      WHERE r.querent_id = ${querentId}
        AND r.fortuneteller_id = ${fortunetellerId}
        AND m.created_at >= ${sub.startDate}
        AND m.sender = 'querent'
      LIMIT 1
    `);
    return result.rows.length > 0;
  }

  async getSubscriptionSlotAdvisors(querentId: number, since: Date): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT r.fortuneteller_id, MIN(m.created_at) as first_msg
      FROM rooms r
      INNER JOIN messages m ON m.room_id = r.id
      WHERE r.querent_id = ${querentId}
        AND m.sender = 'querent'
        AND m.created_at >= ${since}
      GROUP BY r.fortuneteller_id
      ORDER BY first_msg ASC
      LIMIT 5
    `);
    return (result.rows as any[]).map((row: any) => Number(row.fortuneteller_id));
  }

  async unlockMessage(id: number): Promise<Message | undefined> {
    const [updated] = await db.update(messages)
      .set({ isLocked: false, unlockedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async addFortunetellerBonusCashable(advisorId: number, pts: number): Promise<void> {
    await db.update(fortunetellerProfiles)
      .set({ bonusCashable: sql`${fortunetellerProfiles.bonusCashable} + ${pts}` })
      .where(eq(fortunetellerProfiles.userId, advisorId));
  }

  async getFortunetellerBonusCashable(advisorId: number): Promise<number> {
    const profile = await this.getFortunetellerProfile(advisorId);
    return profile?.bonusCashable ?? 0;
  }

  async settleTreatmentMessagesInRoom(roomId: string): Promise<number> {
    const now = new Date();
    const result = await db.update(messages)
      .set({ earnedByAdvisor: true })
      .where(and(
        eq(messages.roomId, roomId),
        eq(messages.category, "treatment"),
        eq(messages.isLocked, false),
        eq(messages.earnedByAdvisor, false),
        sql`${messages.unlockedAt} IS NOT NULL`
      ))
      .returning({ costPt: messages.costPt });
    return result.reduce((sum, m) => sum + (m.costPt ?? 0), 0);
  }

  async getExpiredUnsettledTreatmentMessages(): Promise<{ id: number; roomId: string; costPt: number; querentId: number }[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db.execute(sql`
      SELECT m.id, m.room_id, m.cost_pt, r.querent_id
      FROM messages m
      INNER JOIN rooms r ON r.id = m.room_id
      WHERE m.category = 'treatment'
        AND m.is_locked = false
        AND m.earned_by_advisor = false
        AND m.unlocked_at IS NOT NULL
        AND m.unlocked_at < ${cutoff}
    `);
    return (result.rows as any[]).map((row: any) => ({
      id: Number(row.id),
      roomId: String(row.room_id),
      costPt: Number(row.cost_pt ?? 0),
      querentId: Number(row.querent_id),
    }));
  }

  async refundTreatmentMessage(id: number, querentId: number, pts: number): Promise<void> {
    await db.update(messages).set({ earnedByAdvisor: true }).where(eq(messages.id, id));
    if (pts > 0) {
      await db.update(querentProfiles)
        .set({ points: sql`${querentProfiles.points} + ${pts}` })
        .where(eq(querentProfiles.userId, querentId));
    }
  }

  async addQuerentPoints(userId: number, pts: number): Promise<void> {
    await db.update(querentProfiles)
      .set({ points: sql`${querentProfiles.points} + ${pts}` })
      .where(eq(querentProfiles.userId, userId));
  }

  async isStripeSessionProcessed(sessionId: string): Promise<boolean> {
    const result = await db.execute(
      sql`SELECT 1 FROM stripe_processed_sessions WHERE session_id = ${sessionId} LIMIT 1`
    );
    return (result.rows?.length ?? 0) > 0;
  }

  async markStripeSessionProcessed(sessionId: string): Promise<boolean> {
    try {
      await db.execute(
        sql`INSERT INTO stripe_processed_sessions (session_id) VALUES (${sessionId}) ON CONFLICT DO NOTHING`
      );
      const check = await this.isStripeSessionProcessed(sessionId);
      return check;
    } catch {
      return false;
    }
  }
}

export const storage = new DatabaseStorage();

export const RANK_THRESHOLDS = [
  { rank: "DIAMOND_PLUS", label: "ダイヤモンド+", minRevenue: 2000000, cashable: 1000000 },
  { rank: "DIAMOND", label: "ダイヤモンド", minRevenue: 1000000, cashable: 500000 },
  { rank: "PLATINUM_PLUS", label: "プラチナ+", minRevenue: 500000, cashable: 250000 },
  { rank: "PLATINUM", label: "プラチナ", minRevenue: 250000, cashable: 125000 },
  { rank: "GOLD", label: "ゴールド", minRevenue: 160000, cashable: 80000 },
  { rank: "SILVER", label: "シルバー", minRevenue: 80000, cashable: 40000 },
  { rank: "BRONZE", label: "ブロンズ", minRevenue: 30000, cashable: 0 },
  { rank: "NORMAL", label: "ノーマル", minRevenue: 0, cashable: 0 },
];

export function computeRankFromRevenue(revenue: number): { rank: string; label: string; cashable: number } {
  for (const tier of RANK_THRESHOLDS) {
    if (revenue >= tier.minRevenue) {
      const cashableRate = tier.minRevenue > 0 ? tier.cashable / tier.minRevenue : 0;
      const cashable = Math.floor(revenue * cashableRate);
      return { rank: tier.rank, label: tier.label, cashable };
    }
  }
  return { rank: "NORMAL", label: "ノーマル", cashable: 0 };
}
