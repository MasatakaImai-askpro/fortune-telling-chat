import { db } from "./db";
import { eq, and, desc, gte, sql, ne, count } from "drizzle-orm";
import { lte } from "drizzle-orm";
import {
  users, fortunetellerProfiles, querentProfiles, bankInfo, rooms, messages, subscriptions, transferRequests,
  type User, type InsertUser,
  type FortunetellerProfile, type InsertFortunetellerProfile,
  type QuerentProfile, type InsertQuerentProfile,
  type BankInfo, type InsertBankInfo,
  type Room, type InsertRoom,
  type Message, type InsertMessage,
  type Subscription, type InsertSubscription,
  type TransferRequest, type InsertTransferRequest,
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

  getAllTransferRequests(): Promise<TransferRequest[]>;
  createTransferRequest(req: InsertTransferRequest): Promise<TransferRequest>;
  approveTransferRequest(id: number, scheduledDate: Date): Promise<TransferRequest | undefined>;
  markTransferredRequests(): Promise<number>;

  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  updateUser(id: number, data: Partial<{ email: string; role: string }>): Promise<User | undefined>;

  getFortuneteller6MonthRevenue(fortunetellerId: number): Promise<number>;
  getUnreadCountForRoom(roomId: string, role: "querent" | "fortuneteller"): Promise<number>;
  markRoomRead(roomId: string, role: "querent" | "fortuneteller"): Promise<void>;
  getTotalUnreadCount(userId: number, role: "querent" | "fortuneteller"): Promise<number>;
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

  async unlockMessage(id: number): Promise<Message | undefined> {
    const [updated] = await db.update(messages).set({ isLocked: false }).where(eq(messages.id, id)).returning();
    return updated;
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

  async getAllSubscriptions(): Promise<Subscription[]> {
    return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
  }

  async getAllTransferRequests(): Promise<TransferRequest[]> {
    return db.select().from(transferRequests).orderBy(desc(transferRequests.requestedAt));
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
      total: sql<number>`COALESCE(SUM(${messages.costPt}), 0)`,
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
}

export const storage = new DatabaseStorage();

export const RANK_THRESHOLDS = [
  { rank: "DIAMOND_PLUS", label: "ダイヤモンド+", minRevenue: 2000000, cashable: 1000000 },
  { rank: "DIAMOND", label: "ダイヤモンド", minRevenue: 1000000, cashable: 500000 },
  { rank: "PLATINUM_PLUS", label: "プラチナ+", minRevenue: 500000, cashable: 250000 },
  { rank: "PLATINUM", label: "プラチナ", minRevenue: 250000, cashable: 125000 },
  { rank: "GOLD", label: "ゴールド", minRevenue: 160000, cashable: 80000 },
  { rank: "SILVER", label: "シルバー", minRevenue: 80000, cashable: 40000 },
  { rank: "BRONZE", label: "ブロンズ", minRevenue: 0, cashable: 0 },
];

export function computeRankFromRevenue(revenue: number): { rank: string; label: string; cashable: number } {
  for (const tier of RANK_THRESHOLDS) {
    if (revenue >= tier.minRevenue) {
      const cashableRate = tier.minRevenue > 0 ? tier.cashable / tier.minRevenue : 0;
      const cashable = Math.floor(revenue * cashableRate);
      return { rank: tier.rank, label: tier.label, cashable };
    }
  }
  return { rank: "BRONZE", label: "ブロンズ", cashable: 0 };
}
