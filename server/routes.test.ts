import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { registerRoutes } from "./routes";
import bcrypt from "bcrypt";

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
    updateUserLastLogin: vi.fn().mockResolvedValue(undefined),
    updateUserPassword: vi.fn().mockResolvedValue(undefined),
    markPasswordResetTokenUsed: vi.fn().mockResolvedValue(undefined),
    getOrCreateRoom: vi.fn().mockResolvedValue({ id: "room-bulk-1" }),
    createMessage: vi.fn().mockResolvedValue({ id: 999 }),
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

// ─────────────────────────────────────────────
// POST /api/user_login（追加ケース）
// ─────────────────────────────────────────────
describe("POST /api/user_login（追加ケース）", () => {
  let hashedPassword: string;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash("Test1234", 4);
  });

  // 説明：正しい認証情報のとき 200 と user_role を返すこと
  // 条件：正しいメールアドレスとパスワードを送信
  it("正しい認証情報のとき 200 と user_role を返す", async () => {
    mockStorage.getUserByEmail.mockResolvedValue({
      id: 1,
      email: "querent01@example.com",
      password: hashedPassword,
      role: "1",
    });

    const res = await request(app)
      .post("/api/user_login")
      .send({ email: "querent01@example.com", password: "Test1234" });

    expect(res.status).toBe(200);
    expect(res.body.user_role).toBe("1");
    expect(res.body.message).toBeDefined();
  });

  // 説明：パスワードが一致しない場合は 401 を返すこと
  // 条件：正しいメールだがパスワードが異なる
  it("パスワード不一致のとき 401 を返す", async () => {
    mockStorage.getUserByEmail.mockResolvedValue({
      id: 1,
      email: "querent01@example.com",
      password: hashedPassword,
      role: "1",
    });

    const res = await request(app)
      .post("/api/user_login")
      .send({ email: "querent01@example.com", password: "WrongPass1" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  // 説明：role 指定がありユーザーの role と一致しない場合は 401 を返すこと
  // 条件：role="2"（占い師向け画面）だがユーザーは role="1"（相談者）
  it("role 不一致のとき 401 を返す", async () => {
    mockStorage.getUserByEmail.mockResolvedValue({
      id: 1,
      email: "querent01@example.com",
      password: hashedPassword,
      role: "1",
    });

    const res = await request(app)
      .post("/api/user_login")
      .send({ email: "querent01@example.com", password: "Test1234", role: "2" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/ログイン画面が異なります/);
  });
});

// ─────────────────────────────────────────────
// POST /api/password_reset
// ─────────────────────────────────────────────
describe("POST /api/password_reset", () => {
  // 説明：token と new_password の両方が必須であること
  // 条件：リクエストボディが空
  it("token/new_password が欠けているとき 400 を返す", async () => {
    const res = await request(app)
      .post("/api/password_reset")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // 説明：存在しないトークンは 400 を返すこと
  // 条件：getPasswordResetToken が null を返す
  it("無効なトークンのとき 400 を返す", async () => {
    mockStorage.getPasswordResetToken.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/password_reset")
      .send({ token: "invalid_token", new_password: "NewPass123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/無効なリセットトークン/);
  });

  // 説明：既に使用済みのトークンは 400 を返すこと
  // 条件：getPasswordResetToken が usedAt を持つトークンを返す
  it("使用済みトークンのとき 400 を返す", async () => {
    mockStorage.getPasswordResetToken.mockResolvedValue({
      userId: 1,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });

    const res = await request(app)
      .post("/api/password_reset")
      .send({ token: "used_token", new_password: "NewPass123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/既に使用/);
  });

  // 説明：有効期限切れのトークンは 400 を返すこと
  // 条件：getPasswordResetToken が expiresAt が過去のトークンを返す
  it("期限切れトークンのとき 400 を返す", async () => {
    mockStorage.getPasswordResetToken.mockResolvedValue({
      userId: 1,
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post("/api/password_reset")
      .send({ token: "expired_token", new_password: "NewPass123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/有効期限/);
  });
});

// ─────────────────────────────────────────────
// POST /api/register_querent
// ─────────────────────────────────────────────
describe("POST /api/register_querent", () => {
  // 説明：email/password が欠けている場合は 400 を返すこと
  // 条件：email のみ送信（password なし）
  it("必須フィールド不足のとき 400 を返す", async () => {
    const res = await request(app)
      .post("/api/register_querent")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // 説明：既に登録済みのメールアドレスは 400 を返すこと
  // 条件：getUserByEmail が既存ユーザーを返す
  it("メールアドレス重複のとき 400 を返す", async () => {
    mockStorage.getUserByEmail.mockResolvedValue({ id: 99, email: "dup@example.com" });

    const res = await request(app)
      .post("/api/register_querent")
      .send({ email: "dup@example.com", password: "Pass1234" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/既に登録/);
  });

  // 説明：正しいリクエストのとき 201 を返すこと
  // 条件：メール重複なし、createUser/createQuerentProfile が成功する
  it("正常な登録のとき 201 を返す", async () => {
    mockStorage.getUserByEmail.mockResolvedValue(null);
    mockStorage.createUser.mockResolvedValue({ id: 100, email: "newuser@example.com", role: "1" });
    mockStorage.createQuerentProfile.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/register_querent")
      .send({ email: "newuser@example.com", password: "Pass1234" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// GET /api/ranking
// ─────────────────────────────────────────────
describe("GET /api/ranking", () => {
  // 説明：period=daily のとき 200 とスコア配列を返すこと
  // 条件：占い師プロフィールが1件ある状態
  it("period=daily のとき 200 とスコア配列を返す", async () => {
    mockStorage.getAllFortunetellerProfiles.mockResolvedValue([{ userId: 1 }]);
    mockStorage.getFortunetellerRankingScore.mockResolvedValue(500);

    const res = await request(app).get("/api/ranking?period=daily");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ userId: 1, score: 500 });
  });

  // 説明：period=monthly のとき 200 を返すこと（プロフィールなし）
  // 条件：getAllFortunetellerProfiles が空配列を返す
  it("period=monthly のとき 200 と空配列を返す", async () => {
    mockStorage.getAllFortunetellerProfiles.mockResolvedValue([]);

    const res = await request(app).get("/api/ranking?period=monthly");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// requireAuth ミドルウェア
// ─────────────────────────────────────────────
describe("requireAuth ミドルウェア", () => {
  // 説明：未認証のユーザーが保護ルートにアクセスすると 401 を返すこと
  // 条件：セッションなし（Cookie なし）で /api/my_fortuneteller_profile にアクセス
  it("未認証で保護ルートにアクセスすると 401 を返す", async () => {
    const res = await request(app).get("/api/my_fortuneteller_profile");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/認証が必要/);
  });
});

// ─────────────────────────────────────────────
// POST /api/send_bulk_message
// ─────────────────────────────────────────────
describe("POST /api/send_bulk_message", () => {
  let ftCookie: string;

  beforeAll(async () => {
    const hashed = await bcrypt.hash("Test1234", 4);
    mockStorage.getUserByEmail.mockResolvedValue({
      id: 200,
      email: "fortune01@example.com",
      password: hashed,
      role: "2",
    });
    const loginRes = await request(app)
      .post("/api/user_login")
      .send({ email: "fortune01@example.com", password: "Test1234" });
    const rawCookie = loginRes.headers["set-cookie"];
    ftCookie = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
  });

  // 説明：未認証のとき 401 を返すこと
  // 条件：Cookie なしでリクエスト
  it("未認証のとき 401 を返す", async () => {
    const res = await request(app)
      .post("/api/send_bulk_message")
      .send({ querent_ids: [1], text: "test" });

    expect(res.status).toBe(401);
  });

  // 説明：querent_ids が 101件（上限超過）のとき Zod バリデーションエラーで 400 を返すこと
  // 条件：fortuneteller としてログイン済み、querent_ids に 101件
  it("querent_ids が 101件のとき 400 を返す（一括送信上限超過）", async () => {
    mockStorage.getUser.mockResolvedValue({ id: 200, role: "2" });
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);

    const res = await request(app)
      .post("/api/send_bulk_message")
      .set("Cookie", ftCookie)
      .send({ querent_ids: ids, text: "一括テストメッセージ" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/100人/);
  });

  // 説明：querent ロール（role="1"）のユーザーは 403 を返すこと
  // 条件：相談者アカウントのセッションで role="1"
  it("querent ロールのユーザーのとき 403 を返す", async () => {
    mockStorage.getUser.mockResolvedValue({ id: 200, role: "1" });

    const res = await request(app)
      .post("/api/send_bulk_message")
      .set("Cookie", ftCookie)
      .send({ querent_ids: [1], text: "test" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/権限/);
  });
});
