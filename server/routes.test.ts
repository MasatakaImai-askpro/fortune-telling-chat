import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { registerRoutes } from "./routes";

// storage・vite・sharp・nodemailerをモック化
vi.mock("./storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    createQuerentProfile: vi.fn(),
    createFortunetellerProfile: vi.fn(),
    createPasswordResetToken: vi.fn(),
    getPasswordResetToken: vi.fn(),
    getAllFortunetellerProfiles: vi.fn().mockResolvedValue([]),
    getFortunetellerProfile: vi.fn(),
    getRooms: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    getQuerentProfile: vi.fn(),
    getFortunetellerRankingScore: vi.fn().mockResolvedValue(0),
  },
  computeRankFromRevenue: vi.fn().mockReturnValue({ rank: "NORMAL", label: "ノーマル", cashable: 0 }),
  RANK_THRESHOLDS: [],
}));

vi.mock("./vite", () => ({
  log: vi.fn(),
  serveStatic: vi.fn(),
  setupVite: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("")),
  }),
}));

import { storage } from "./storage";

const mockStorage = storage as Record<string, ReturnType<typeof vi.fn>>;

// テスト用 Express アプリを一度だけセットアップ
let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(
    session({ secret: "test-secret", resave: false, saveUninitialized: false })
  );
  registerRoutes(app);
});

// ─────────────────────────────────────────────
// GET /api/get_login_info
// ─────────────────────────────────────────────
describe("GET /api/get_login_info", () => {
  // 説明：未ログイン状態ではnullを返すこと
  // 条件：セッションにuserIdが設定されていない
  it("未ログインのとき null を返す", async () => {
    const res = await request(app).get("/api/get_login_info");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ─────────────────────────────────────────────
// POST /api/user_login
// ─────────────────────────────────────────────
describe("POST /api/user_login", () => {
  // 説明：メールアドレスが存在しない場合は401を返すこと
  // 条件：存在しないメールアドレスでログイン試行（storage が null を返す）
  it("存在しないメールの場合 401 を返す", async () => {
    mockStorage.getUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/user_login")
      .send({ email: "notfound@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  // 説明：emailまたはpasswordが欠けている場合は400を返すこと
  // 条件：email のみ送信（password なし）
  it("パラメータ不足のとき 400 を返す", async () => {
    const res = await request(app)
      .post("/api/user_login")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// POST /api/password_reset_request
// ─────────────────────────────────────────────
describe("POST /api/password_reset_request", () => {
  // 説明：emailが空の場合は400を返すこと
  // 条件：リクエストボディが空（email なし）
  it("emailが空のとき 400 を返す", async () => {
    const res = await request(app)
      .post("/api/password_reset_request")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("メールアドレスを入力してください");
  });

  // 説明：登録されていないメールでもセキュリティのため200を返すこと
  // 条件：存在しないメールアドレスを送信
  it("存在しないメールでも 200 を返す（セキュリティ配慮）", async () => {
    mockStorage.getUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/password_reset_request")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});
