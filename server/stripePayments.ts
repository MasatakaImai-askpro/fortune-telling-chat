import { storage } from "./storage";
import { log } from "./vite";

export type ProcessResult =
  | { status: "already_processed" }
  | { status: "not_paid" }
  | { status: "ok"; type: "points"; points: number }
  | { status: "ok"; type: "subscription"; plan_type: string };

/**
 * Stripe の checkout.session.completed イベント／セッションを受け取り、
 * stripe_processed_sessions テーブルで二重処理を防ぎつつ DB を更新する。
 *
 * webhook と verify_session エンドポイントの両方から呼ばれる共通処理。
 */
export async function processStripeSession(session: {
  id: string;
  mode?: string | null;
  payment_status: string;
  status: string | null;
  metadata: Record<string, string> | null;
  subscription?: string | { id: string; current_period_end: number } | null;
}): Promise<ProcessResult> {
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { status: "not_paid" };
  }

  const alreadyProcessed = await storage.isStripeSessionProcessed(session.id);
  if (alreadyProcessed) {
    log(`processStripeSession: session ${session.id} already processed, skipping`);
    return { status: "already_processed" };
  }

  const marked = await storage.markStripeSessionProcessed(session.id);
  if (!marked) {
    return { status: "already_processed" };
  }

  const querentId = parseInt(session.metadata?.querent_id || "0");
  if (!querentId) {
    log(`processStripeSession: invalid querent_id in session ${session.id}`);
    return { status: "not_paid" };
  }

  const purchaseType = session.metadata?.purchase_type;

  if (purchaseType === "points") {
    const points = parseInt(session.metadata?.points || "0");
    if (points > 0) {
      await storage.addQuerentPoints(querentId, points);
      log(`processStripeSession: added ${points}pt to querent ${querentId} (session ${session.id})`);
    }
    return { status: "ok", type: "points", points };
  } else {
    const planType = session.metadata?.plan_type || "standard";
    const amount = planType === "premium" ? 50000 : 20000;
    const now = new Date();

    // サブスクリプションモードの場合はStripeから期間終了日を取得
    let endDate: Date;
    let stripeSubscriptionId = "";

    if (session.mode === "subscription" && session.subscription) {
      if (typeof session.subscription === "string") {
        // subscription IDのみの場合：Stripeから取得が必要 → フォールバックで1ヶ月
        stripeSubscriptionId = session.subscription;
        endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else {
        // 展開済みオブジェクトの場合
        stripeSubscriptionId = session.subscription.id;
        const periodEndRaw = (session.subscription as any).current_period_end;
        const periodEndMs =
          typeof periodEndRaw === "number" && periodEndRaw > 0
            ? periodEndRaw * 1000
            : now.getTime() + 30 * 24 * 60 * 60 * 1000; // フォールバック: 1ヶ月
        endDate = new Date(periodEndMs);
      }
    } else {
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    await storage.cancelSubscription(querentId).catch(() => {});
    await storage.createSubscription({
      querentId,
      amount,
      planType,
      status: "active",
      startDate: now,
      endDate,
      stripeSubscriptionId,
    } as any);
    await storage.updateQuerentProfile(querentId, { isSubscription: true });
    log(`processStripeSession: subscription (${planType}) activated for querent ${querentId}, stripeSubId=${stripeSubscriptionId}, endDate=${endDate.toISOString()} (session ${session.id})`);
    return { status: "ok", type: "subscription", plan_type: planType };
  }
}
