import { pgTable, text, serial, integer, boolean, timestamp, uuid, unique, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role", { length: 1 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fortunetellerProfiles = pgTable("fortuneteller_profiles", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 20 }).notNull(),
  headline: varchar("headline", { length: 30 }).notNull(),
  intro: text("intro").notNull(),
  rank: varchar("rank", { length: 8 }).notNull().default("SILVER"),
  profileImage: text("profile_image").notNull().default(""),
  iconImage: text("icon_image").notNull().default(""),
  isRecommended: boolean("is_recommended").notNull().default(false),
  style: varchar("style", { length: 20 }).notNull().default(""),
  divinationMethods: text("divination_methods").array().notNull().default([]),
  regularHolidays: varchar("regular_holidays", { length: 100 }).notNull().default(""),
  businessHours: varchar("business_hours", { length: 100 }).notNull().default(""),
  longIntro: text("long_intro").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const querentProfiles = pgTable("querent_profiles", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 20 }).notNull(),
  telNumber: varchar("tel_number", { length: 11 }).notNull(),
  postalCode: varchar("postal_code", { length: 7 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  birthdate: varchar("birthdate", { length: 10 }).notNull(),
  zodiacSign: varchar("zodiac_sign", { length: 10 }).notNull(),
  birthplace: varchar("birthplace", { length: 50 }).notNull(),
  birthtime: varchar("birthtime", { length: 5 }).notNull(),
  worryCategory: varchar("worry_category", { length: 10 }).notNull(),
  worryMessage: text("worry_message").notNull(),
  isSubscription: boolean("is_subscription").notNull().default(false),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankInfo = pgTable("bank_info", {
  userId: integer("user_id").primaryKey().references(() => fortunetellerProfiles.userId, { onDelete: "cascade" }),
  name: varchar("name", { length: 30 }),
  branchName: varchar("branch_name", { length: 20 }),
  accountType: varchar("account_type", { length: 5 }),
  accountNumber: varchar("account_number", { length: 7 }),
  accountHolderName: varchar("account_holder_name", { length: 20 }),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  fortunetellerId: integer("fortuneteller_id").notNull().references(() => fortunetellerProfiles.userId, { onDelete: "cascade" }),
  querentId: integer("querent_id").notNull().references(() => querentProfiles.userId, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("room_unique").on(table.fortunetellerId, table.querentId),
]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  sender: varchar("sender", { length: 15 }).notNull(),
  text: text("text"),
  title: varchar("title", { length: 100 }),
  category: varchar("category", { length: 20 }).notNull().default("free"),
  costPt: integer("cost_pt"),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  querentId: integer("querent_id").notNull().references(() => querentProfiles.userId, { onDelete: "cascade" }),
  amount: integer("amount").notNull().default(20000),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transferRequests = pgTable("transfer_requests", {
  id: serial("id").primaryKey(),
  fortunetellerId: integer("fortuneteller_id").notNull().references(() => fortunetellerProfiles.userId, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  scheduledTransferDate: timestamp("scheduled_transfer_date"),
  transferredAt: timestamp("transferred_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertFortunetellerProfileSchema = createInsertSchema(fortunetellerProfiles).omit({ createdAt: true });
export const insertQuerentProfileSchema = createInsertSchema(querentProfiles).omit({ createdAt: true });
export const insertBankInfoSchema = createInsertSchema(bankInfo);
export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true });
export const insertTransferRequestSchema = createInsertSchema(transferRequests).omit({ id: true, requestedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type FortunetellerProfile = typeof fortunetellerProfiles.$inferSelect;
export type InsertFortunetellerProfile = z.infer<typeof insertFortunetellerProfileSchema>;
export type QuerentProfile = typeof querentProfiles.$inferSelect;
export type InsertQuerentProfile = z.infer<typeof insertQuerentProfileSchema>;
export type BankInfo = typeof bankInfo.$inferSelect;
export type InsertBankInfo = z.infer<typeof insertBankInfoSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type TransferRequest = typeof transferRequests.$inferSelect;
export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;
