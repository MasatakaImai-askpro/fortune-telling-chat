import { describe, it, expect, vi, beforeEach } from "vitest";
import { processStripeSession } from "./stripePayments";

// storage と log をモック化
vi.mock("./storage", () => ({
  storage: {
    isStripeSessionProcessed: vi.fn(),
    markStripeSessionProcessed: vi.fn(),
    addQuerentPoints: vi.fn(),
    cancelSubscription: vi.fn(),
    createSubscription: vi.fn(),
    updateQuerentProfile: vi.fn(),
  },
}));

vi.mock("./vite", () => ({
  log: vi.fn(),
}));

import { storage } from "./storage";

const mockStorage = storage as {
  isStripeSessionProcessed: ReturnType<typeof vi.fn>;
  markStripeSessionProcessed: ReturnType<typeof vi.fn>;
  addQuerentPoints: ReturnType<typeof vi.fn>;
  cancelSubscription: ReturnType<typeof vi.fn>;
  createSubscription: ReturnType<typeof vi.fn>;
  updateQuerentProfile: ReturnType<typeof vi.fn>;
};

// 共通のベースセッションオブジェクト
const baseSession = {
  id: "sess_test_001",
  payment_status: "paid",
  status: "complete",
  metadata: { querent_id: "42", purchase_type: "points", points: "1000" },
  mode: "payment" as const,
  subscription: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.isStripeSessionProcessed.mockResolvedValue(false);
  mockStorage.markStripeSessionProcessed.mockResolvedValue(true);
  mockStorage.addQuerentPoints.mockResolvedValue(undefined);
  mockStorage.cancelSubscription.mockResolvedValue(undefined);
  mockStorage.createSubscription.mockResolvedValue(undefined);
  mockStorage.updateQuerentProfile.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────
// processStripeSession
// ─────────────────────────────────────────────
describe("processStripeSession", () => {
  // 説明：payment_status が "paid" でも status が "complete" でもない場合は not_paid を返すこと
  // 条件：payment_status: "unpaid", status: "open"
  it("未払いセッションは { status: 'not_paid' } を返す", async () => {
    const result = await processStripeSession({
      ...baseSession,
      payment_status: "unpaid",
      status: "open",
    });
    expect(result).toEqual({ status: "not_paid" });
  });

  // 説明：同じセッションIDが既に処理済みの場合は already_processed を返すこと
  // 条件：isStripeSessionProcessed が true を返す
  it("処理済みセッションは { status: 'already_processed' } を返す", async () => {
    mockStorage.isStripeSessionProcessed.mockResolvedValue(true);

    const result = await processStripeSession(baseSession);
    expect(result).toEqual({ status: "already_processed" });
  });

  // 説明：purchase_type が "points" の場合、指定ポイントを相談者に加算すること
  // 条件：metadata.purchase_type = "points", points = "1000", querent_id = "42"
  it("ポイント購入セッションで正しいポイント数を加算し ok を返す", async () => {
    const result = await processStripeSession(baseSession);

    expect(result).toEqual({ status: "ok", type: "points", points: 1000 });
    expect(mockStorage.addQuerentPoints).toHaveBeenCalledWith(42, 1000);
  });

  // 説明：purchase_type が "points" でない場合（サブスク）、サブスクを作成して ok を返すこと
  // 条件：metadata.purchase_type = "subscription", plan_type = "standard"
  it("サブスク購入セッションでサブスクを作成し ok を返す", async () => {
    const result = await processStripeSession({
      ...baseSession,
      metadata: { querent_id: "42", purchase_type: "subscription", plan_type: "standard" },
    });

    expect(result).toEqual({ status: "ok", type: "subscription", plan_type: "standard" });
    expect(mockStorage.createSubscription).toHaveBeenCalled();
    expect(mockStorage.updateQuerentProfile).toHaveBeenCalledWith(42, { isSubscription: true });
  });

  // 説明：metadata に querent_id がない（0になる）場合は not_paid を返すこと
  // 条件：metadata.querent_id が未設定
  it("querent_id がない場合は { status: 'not_paid' } を返す", async () => {
    const result = await processStripeSession({
      ...baseSession,
      metadata: { purchase_type: "points", points: "500" },
    });
    expect(result).toEqual({ status: "not_paid" });
  });

  // 説明：Stripe サブスクモードで subscription オブジェクトが渡された場合、
  //        current_period_end から endDate を計算してサブスクを作成すること
  // 条件：mode = "subscription", subscription = { id: "sub_xxx", current_period_end: Unix秒 }
  it("subscriptionオブジェクト付きセッションで期間終了日を正しく設定する", async () => {
    const futureUnix = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    const result = await processStripeSession({
      ...baseSession,
      mode: "subscription",
      metadata: { querent_id: "42", purchase_type: "subscription", plan_type: "premium" },
      subscription: { id: "sub_abc123", current_period_end: futureUnix },
    });

    expect(result).toEqual({ status: "ok", type: "subscription", plan_type: "premium" });

    const callArg = mockStorage.createSubscription.mock.calls[0][0];
    expect(callArg.stripeSubscriptionId).toBe("sub_abc123");
    expect(callArg.endDate.getTime()).toBeCloseTo(futureUnix * 1000, -3);
  });

  // 説明：markStripeSessionProcessed が false を返す場合（競合状態による二重処理防止）
  // 条件：isStripeSessionProcessed=false だが markStripeSessionProcessed=false（他のプロセスが先に処理した）
  it("markStripeSessionProcessed=false のとき { status: 'already_processed' } を返す", async () => {
    mockStorage.markStripeSessionProcessed.mockResolvedValue(false);

    const result = await processStripeSession(baseSession);
    expect(result).toEqual({ status: "already_processed" });
  });

  // 説明：points が 0 のとき addQuerentPoints は呼ばれないこと
  // 条件：metadata.points = "0"（ソースの if (points > 0) 分岐を通らない）
  it("points=0 のとき addQuerentPoints は呼ばれない", async () => {
    const result = await processStripeSession({
      ...baseSession,
      metadata: { querent_id: "42", purchase_type: "points", points: "0" },
    });

    expect(result).toEqual({ status: "ok", type: "points", points: 0 });
    expect(mockStorage.addQuerentPoints).not.toHaveBeenCalled();
  });

  // 説明：premium プランのとき createSubscription に amount=50000 が渡されること
  // 条件：metadata.plan_type = "premium"
  it("premium プランで amount=50000 が createSubscription に渡される", async () => {
    await processStripeSession({
      ...baseSession,
      metadata: { querent_id: "42", purchase_type: "subscription", plan_type: "premium" },
    });

    expect(mockStorage.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000, planType: "premium" })
    );
  });

  // 説明：standard プランのとき createSubscription に amount=20000 が渡されること
  // 条件：metadata.plan_type = "standard"
  it("standard プランで amount=20000 が createSubscription に渡される", async () => {
    await processStripeSession({
      ...baseSession,
      metadata: { querent_id: "42", purchase_type: "subscription", plan_type: "standard" },
    });

    expect(mockStorage.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20000, planType: "standard" })
    );
  });

  // 説明：mode="subscription" かつ subscription が文字列IDのみの場合、
  //        endDate はフォールバックで約30日後になり stripeSubscriptionId がセットされること
  // 条件：mode = "subscription", subscription = "sub_string_only"（文字列ID）
  it("subscription が文字列IDのみのとき endDate が約30日後・stripeSubscriptionId がセットされる", async () => {
    const before = Date.now();

    await processStripeSession({
      ...baseSession,
      mode: "subscription",
      metadata: { querent_id: "42", purchase_type: "subscription", plan_type: "standard" },
      subscription: "sub_string_only",
    });

    const callArg = mockStorage.createSubscription.mock.calls[0][0];
    expect(callArg.stripeSubscriptionId).toBe("sub_string_only");
    const diff = callArg.endDate.getTime() - before;
    expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });

  // 説明：サブスク処理の前に既存サブスクのキャンセルが呼ばれること
  // 条件：purchase_type = "subscription"（cancelSubscription は必ず呼ばれる）
  it("サブスク処理前に cancelSubscription が querentId で呼ばれる", async () => {
    await processStripeSession({
      ...baseSession,
      metadata: { querent_id: "42", purchase_type: "subscription", plan_type: "standard" },
    });

    expect(mockStorage.cancelSubscription).toHaveBeenCalledWith(42);
  });

  // 説明：metadata が null の場合は querentId が 0 になり not_paid を返すこと
  // 条件：metadata = null
  it("metadata=null のとき { status: 'not_paid' } を返す", async () => {
    const result = await processStripeSession({
      ...baseSession,
      metadata: null,
    });

    expect(result).toEqual({ status: "not_paid" });
  });
});
