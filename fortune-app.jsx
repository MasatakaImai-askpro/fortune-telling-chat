import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Chat Fortune Demo – Mobile-first Customer UI (Vercel-ready)
 * -----------------------------------------------------------
 * 指摘対応:
 * - 616行付近の二重インポート(React)により SyntaxError: Identifier 'React' has already been declared が発生。
 *   👉 ファイル末尾側の重複ブロックを削除し、インポートは先頭の1箇所のみとした。
 * - 鑑定士の顔写真表示、モバイル95%前提のUI、占い向けの配色/装飾は維持。
 * - 簡易ランタイムテスト(開発時のみ実行)を追加して、定数やデータ整合性を検証。
 *   （"ALWAYS add more test cases" の要件に合わせ、実運用を阻害しない軽量テストを同梱）
 *
 * 注意: これはフロントのみのモックです。StripeはテストCheckoutへの遷移だけ。
 */

// ====== 設定(必要に応じて調整) ======
const STRIPE_TEST_CHECKOUT_SUBSCRIPTION = "https://buy.stripe.com/test_XXXXXXXXXXXX"; // 月額プラン用
const STRIPE_TEST_CHECKOUT_POINTS_1000 = "https://buy.stripe.com/test_YYYYYYYYYYYY"; // 1000pt 購入
const STRIPE_TEST_CHECKOUT_POINTS_3000 = "https://buy.stripe.com/test_ZZZZZZZZZZZZ"; // 3000pt 購入

// 鑑定士ランクと消費ポイント(送信/開封)
const RANK_PRICING: Record<string, { send: number; open: number; label: string; color: string } > = {
  S: { send: 10, open: 20, label: "S", color: "from-fuchsia-500 to-amber-400" },
  A: { send: 7, open: 14, label: "A", color: "from-indigo-500 to-cyan-400" },
  B: { send: 5, open: 10, label: "B", color: "from-emerald-500 to-lime-400" },
};

// デモ用鑑定士 (顔写真: Unsplash サンプル)
const ADVISORS = [
  { id: "1", name: "霊澄(れいすみ)", rank: "S", tags: ["霊視", "スピリチュアル"], avatar: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=300&q=80&auto=format" },
  { id: "2", name: "月乃(つきの)", rank: "A", tags: ["恋愛", "相性"], avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80&auto=format" },
  { id: "3", name: "結衣(ゆい)", rank: "B", tags: ["仕事", "転職"], avatar: "https://images.unsplash.com/photo-1520975922284-6c988d6200f3?w=300&q=80&auto=format" },
  { id: "4", name: "和真(かずま)", rank: "A", tags: ["復縁", "運勢"], avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=300&q=80&auto=format" },
  { id: "5", name: "千夜(ちや)", rank: "S", tags: ["タロット", "総合"], avatar: "https://images.unsplash.com/photo-1544006659-f0b21884ce1d?w=300&q=80&auto=format" },
];

// ====== 型 ======
interface MessageItem {
  id: string;
  role: "user" | "advisor" | "system";
  text?: string;
  attachments?: { type: "image" | "video" | "file"; url: string; name: string }[];
  createdAt: number; // epoch ms
  opened?: boolean; // 占い結果(鑑定士→ユーザー)の開封状態
}

interface ChatThread {
  advisorId: string;
  messages: MessageItem[];
}

// ====== ストレージ ======
const storage = {
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  save<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

// ====== ユーティリティ ======
const yen = (n: number) => `${n.toLocaleString()} pt`;
const timefmt = (ms: number) => new Date(ms).toLocaleTimeString();
const cls = (...v: (string | false | undefined)[]) => v.filter(Boolean).join(" ");

// ====== ランタイム簡易テスト（開発時のみ実行） ======
function runDemoTests() {
  const errors: string[] = [];
  // 1) ランク料金の基本整合
  const expected = { S: { send: 10, open: 20 }, A: { send: 7, open: 14 }, B: { send: 5, open: 10 } } as const;
  (Object.keys(expected) as Array<keyof typeof expected>).forEach((r) => {
    const p = (RANK_PRICING as any)[r];
    if (!p) errors.push(`RANK_PRICING[${r}] が未定義`);
    else {
      if (p.send !== expected[r].send) errors.push(`RANK ${r} send 想定 ${expected[r].send} 実際 ${p.send}`);
      if (p.open !== expected[r].open) errors.push(`RANK ${r} open 想定 ${expected[r].open} 実際 ${p.open}`);
    }
  });
  // 2) 鑑定士データのバリデーション
  const ids = new Set<string>();
  for (const a of ADVISORS) {
    if (!a.id || ids.has(a.id)) errors.push(`鑑定士IDの重複/欠落: ${a.id}`);
    ids.add(a.id);
    if (!a.name) errors.push(`鑑定士名の欠落 (id=${a.id})`);
    if (!(a.rank in RANK_PRICING)) errors.push(`未知ランク: ${a.rank} (id=${a.id})`);
    if (!a.avatar) errors.push(`avatar欠落 (id=${a.id})`);
  }
  // 3) 鑑定文テキストの基本性
  const sample = demoReadingText();
  if (typeof sample !== "string" || sample.length < 4) errors.push("demoReadingText() が不正な値を返しました");

  if (errors.length > 0) {
    console.groupCollapsed("[DemoTests] 失敗しました");
    errors.forEach((e) => console.error(e));
    console.groupEnd();
  } else {
    console.info("[DemoTests] すべて成功");
  }
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  try { runDemoTests(); } catch (e) { console.error("[DemoTests] 実行エラー", e); }
}

// ====== ルートコンポーネント ======
export default function CustomerDemoApp() {
  // グローバル状態
  const [plan, setPlan] = useState<"subscription" | "points">(
    () => storage.load("plan", "points")
  );
  const [points, setPoints] = useState<number>(() => storage.load("points", 200));
  const [subscriptionActive, setSubscriptionActive] = useState<boolean>(
    () => storage.load("subscriptionActive", false)
  );
  const [favorites, setFavorites] = useState<string[]>(() => storage.load("favorites", []));
  const [threads, setThreads] = useState<Record<string, ChatThread>>(
    () => storage.load("threads", {})
  );
  const [activeTab, setActiveTab] = useState<"home" | "advisors" | "chat" | "account">("home");
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string | null>(
    () => storage.load("selectedAdvisorId", null)
  );

  useEffect(() => storage.save("plan", plan), [plan]);
  useEffect(() => storage.save("points", points), [points]);
  useEffect(() => storage.save("subscriptionActive", subscriptionActive), [subscriptionActive]);
  useEffect(() => storage.save("favorites", favorites), [favorites]);
  useEffect(() => storage.save("threads", threads), [threads]);
  useEffect(() => storage.save("selectedAdvisorId", selectedAdvisorId), [selectedAdvisorId]);

  const selectedAdvisor = useMemo(
    () => ADVISORS.find((a) => a.id === selectedAdvisorId) ?? null,
    [selectedAdvisorId]
  );

  const startChat = (advisorId: string) => {
    if (!threads[advisorId]) {
      setThreads((prev) => ({ ...prev, [advisorId]: { advisorId, messages: [] } }));
    }
    setSelectedAdvisorId(advisorId);
    setActiveTab("chat");
  };

  const toggleFavorite = (advisorId: string) => {
    setFavorites((prev) =>
      prev.includes(advisorId) ? prev.filter((id) => id !== advisorId) : [...prev, advisorId]
    );
  };

  // ランキング(デモ)
  const rankingFavorites = ADVISORS.filter((a) => favorites.includes(a.id));
  const rankingPopular = useMemo(() => [...ADVISORS].sort(() => Math.random() - 0.5), [points]);
  const rankingNew = [...ADVISORS].reverse();

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#2e1065_0%,#0b1020_45%,#05060b_100%)] text-white">
      {/* ヒーロー */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center shadow-lg shadow-fuchsia-800/30">🔮</div>
          <div>
            <div className="text-xl font-extrabold tracking-tight">占いチャット</div>
            <div className="text-[11px] text-white/70 -mt-0.5">あなただけの鑑定を、すぐに。</div>
          </div>
          <div className="ml-auto text-xs bg-white/10 backdrop-blur rounded-full px-3 py-1 border border-white/10">
            {plan === "subscription" ? (subscriptionActive ? "月額(有効)" : "月額(未契約)") : `ポイント ${points.toLocaleString()}`}
          </div>
        </div>
        <div className="mt-5 rounded-3xl p-4 bg-gradient-to-br from-indigo-600/50 via-fuchsia-600/40 to-amber-500/30 border border-white/10 shadow-xl">
          <div className="text-2xl font-bold leading-tight">今夜、心に灯(ひ)を。<br />気になる相手・仕事・運命の分岐、
            <span className="opacity-90"> プロ鑑定士</span>に相談。</div>
          <div className="mt-3 text-sm text-white/80">画像・動画も送れて、結果はすぐに届く。月額なら消費なし、ポイントならランク別でおトクに。</div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setActiveTab("advisors")} className="flex-1 rounded-2xl py-3 text-sm font-semibold bg-white text-gray-900">鑑定士を探す</button>
            <button onClick={() => setActiveTab("account")} className="rounded-2xl px-4 py-3 text-sm font-semibold bg-white/10 border border-white/20">プランを見る</button>
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <main className="px-4 pb-28">
        {activeTab === "home" && (
          <Home
            rankingFavorites={rankingFavorites}
            rankingPopular={rankingPopular}
            rankingNew={rankingNew}
            favorites={favorites}
            onFav={toggleFavorite}
            onStartChat={startChat}
          />
        )}

        {activeTab === "advisors" && (
          <Advisors
            favorites={favorites}
            onFav={toggleFavorite}
            onStartChat={startChat}
          />
        )}

        {activeTab === "chat" && (
          <Chat
            plan={plan}
            points={points}
            setPoints={setPoints}
            subscriptionActive={subscriptionActive}
            advisor={selectedAdvisor}
            thread={selectedAdvisor ? threads[selectedAdvisor.id] : undefined}
            saveThread={(t) => setThreads((prev) => ({ ...prev, [t.advisorId]: t }))}
          />
        )}

        {activeTab === "account" && (
          <Account
            plan={plan}
            setPlan={setPlan}
            points={points}
            setPoints={setPoints}
            subscriptionActive={subscriptionActive}
            setSubscriptionActive={setSubscriptionActive}
          />
        )}
      </main>

      {/* モバイルボトムナビ */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}

// ====== Bottom Nav ======
function BottomNav({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: any) => void }) {
  const items = [
    { id: "home", label: "ホーム", icon: "🏠" },
    { id: "advisors", label: "鑑定士", icon: "🧙" },
    { id: "chat", label: "相談", icon: "💬" },
    { id: "account", label: "プラン", icon: "💎" },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] bg-[#0b0f1a]/80 backdrop-blur border-t border-white/10">
      <div className="mx-auto max-w-md grid grid-cols-4">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => setActiveTab(it.id)}
            className={cls(
              "py-3 flex flex-col items-center text-[11px]",
              activeTab === it.id ? "text-white" : "text-white/60"
            )}
          >
            <div className="text-base leading-none">{it.icon}</div>
            <div className="mt-1">{it.label}</div>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ====== Home (ランキング) ======
function Home({ rankingFavorites, rankingPopular, rankingNew, favorites, onFav, onStartChat }: any) {
  return (
    <section className="space-y-6">
      <Carousel title="注目の鑑定士" advisors={rankingPopular} onStartChat={onStartChat} onFav={onFav} favorites={favorites} />
      <CardList title="お気に入り" advisors={rankingFavorites} onStartChat={onStartChat} onFav={onFav} favorites={favorites} emptyText="お気に入りの鑑定士を登録しましょう" />
      <CardList title="新着の鑑定士" advisors={rankingNew} onStartChat={onStartChat} onFav={onFav} favorites={favorites} />
    </section>
  );
}

function Ribbon({ rank }: { rank: keyof typeof RANK_PRICING }) {
  return (
    <span className={cls("text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r", RANK_PRICING[rank].color)}>RANK {rank}</span>
  );
}

function Carousel({ title, advisors, onStartChat, onFav, favorites }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white/90">{title}</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x no-scrollbar pr-2">
        {advisors.map((a: any) => (
          <div key={a.id} className="snap-start min-w-[220px] bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur shrink-0">
            <div className="flex items-center gap-3">
              <img src={a.avatar} alt={a.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20" />
              <div className="min-w-0">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-[11px] text-white/70 truncate">{a.tags.join("・")} ・ <Ribbon rank={a.rank} /></div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-xl py-2 text-xs font-semibold bg-white text-gray-900" onClick={() => onStartChat(a.id)}>相談する</button>
              <button className={cls("rounded-xl py-2 text-xs font-semibold border border-white/20", favorites.includes(a.id) ? "bg-pink-500/20 text-pink-100" : "text-white/80")}
                onClick={() => onFav(a.id)}>{favorites.includes(a.id) ? "★ お気に入り" : "☆ お気に入り"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardList({ title, advisors, onStartChat, onFav, favorites, emptyText }: any) {
  return (
    <div>
      <h3 className="font-semibold text-white/90 mb-2">{title}</h3>
      {advisors.length === 0 ? (
        <div className="text-sm text-white/60">{emptyText ?? "該当なし"}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {advisors.map((a: any) => (
            <button key={a.id} onClick={() => onStartChat(a.id)} className="text-left bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <img src={a.avatar} alt={a.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-2">{a.name} <Ribbon rank={a.rank} /></div>
                  <div className="text-[11px] text-white/70 truncate">{a.tags.join("・")}</div>
                </div>
                <div className="text-xs text-white/70">相談する →</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== Advisors (一覧) ======
function Advisors({ favorites, onFav, onStartChat }: any) {
  const [q, setQ] = useState("");
  const filtered = ADVISORS.filter((a) => (a.name + a.tags.join(" ") + a.rank).toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-1 bg-[#0b0f1a]/80 backdrop-blur">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・タグ・ランクで検索"
          className="w-full rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/50"
        />
      </div>
      <div className="grid grid-cols-1 gap-3">
        {filtered.map((a) => (
          <div key={a.id} className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <img src={a.avatar} alt={a.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-white/20" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate flex items-center gap-2">
                  {a.name} <Ribbon rank={a.rank} />
                </div>
                <div className="text-[11px] text-white/70 truncate">{a.tags.join("・")}・送 {RANK_PRICING[a.rank].send}・開 {RANK_PRICING[a.rank].open}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button className="rounded-xl px-3 py-2 text-xs font-semibold bg-white text-gray-900" onClick={() => onStartChat(a.id)}>相談</button>
                <button className="rounded-xl px-3 py-2 text-[11px] border border-white/20 text-white/80" onClick={() => onFav(a.id)}>
                  {favorites.includes(a.id) ? "★ お気に入り" : "☆ お気に入り"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ====== Chat ======
function Chat({ plan, points, setPoints, subscriptionActive, advisor, thread, saveThread }: {
  plan: "subscription" | "points";
  points: number;
  setPoints: (n: number) => void;
  subscriptionActive: boolean;
  advisor: { id: string; name: string; rank: keyof typeof RANK_PRICING; avatar: string } | null;
  thread?: ChatThread;
  saveThread: (t: ChatThread) => void;
}) {
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<{ type: "image" | "video" | "file"; url: string; name: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  if (!advisor) {
    return (
      <section className="py-12 text-center text-white/70">
        まず鑑定士を選んでください（ホームまたは「鑑定士」から）。
      </section>
    );
  }

  const pricing = RANK_PRICING[advisor.rank];
  const consume = (need: number) => {
    if (plan === "subscription" && subscriptionActive) return true;
    if (points < need) return false;
    setPoints(points - need);
    return true;
  };

  const addMsg = (msg: MessageItem) => {
    const t: ChatThread = thread ?? { advisorId: advisor.id, messages: [] };
    const updated = { ...t, messages: [...t.messages, msg] };
    saveThread(updated);
  };

  const onSend = () => {
    const need = pricing.send;
    if (!(plan === "subscription" && subscriptionActive) && points < need) {
      alert(`ポイントが不足しています。必要: ${need}pt`);
      return;
    }
    consume(need);
    addMsg({ id: crypto.randomUUID(), role: "user", text, attachments: uploads, createdAt: Date.now() });
    setText("");
    setUploads([]);
    setTimeout(() => {
      addMsg({ id: crypto.randomUUID(), role: "advisor", text: "鑑定結果が届いています。開封してください。", createdAt: Date.now(), opened: false });
    }, 600);
  };

  const onOpenResult = (msgId: string) => {
    const need = pricing.open;
    if (!(plan === "subscription" && subscriptionActive) && points < need) {
      alert(`ポイントが不足しています。必要: ${need}pt`);
      return;
    }
    consume(need);
    const t = thread!;
    const next = t.messages.map((m) => (m.id === msgId ? { ...m, opened: true, text: demoReadingText() } : m));
    saveThread({ ...t, messages: next });
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video" | "file") => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setUploads((prev) => [...prev, { type, url, name: f.name }]);
    e.target.value = "";
  };

  return (
    <section className="pb-28">
      {/* チャット上部: 鑑定士ヘッダー */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3 bg-[#0b0f1a]/80 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src={advisor.avatar} className="w-10 h-10 rounded-full ring-2 ring-white/20 object-cover" />
          <div className="min-w-0">
            <div className="font-semibold leading-tight truncate">{advisor.name}</div>
            <div className="text-[11px] text-white/70 flex items-center gap-2"><Ribbon rank={advisor.rank} /> {plan === "subscription" && subscriptionActive ? <span className="text-emerald-300">月額内で使い放題</span> : <span>送 {pricing.send} / 開 {pricing.open}</span>}</div>
          </div>
        </div>
      </div>

      {/* メッセージリスト */}
      <div className="mt-3 space-y-3">
        {(thread?.messages ?? []).length === 0 ? (
          <div className="text-center text-white/60 mt-8 text-sm">最初のご相談内容を送ってみましょう。画像・動画・ファイルも添付できます。</div>
        ) : (
          <ul className="space-y-3">
            {thread!.messages.map((m) => (
              <li key={m.id} className={cls("px-2", m.role === "user" ? "text-right" : "text-left")}> 
                <div className={cls(
                  "inline-block max-w-[85%] rounded-2xl p-3 shadow-lg",
                  m.role === "user" ? "bg-gradient-to-br from-indigo-600 to-fuchsia-600" : "bg-white/8 border border-white/10"
                )}> 
                  <div className={cls("text-[10px] mb-1", m.role === "user" ? "text-white/70" : "text-white/60")}>{m.role === "user" ? "あなた" : "鑑定士"}・{timefmt(m.createdAt)}</div>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {m.attachments.map((a, idx) => (
                        <Attachment key={idx} item={a} contrast={m.role === "user"} />
                      ))}
                    </div>
                  )}
                  {m.role === "advisor" && m.opened === false ? (
                    <div className="flex items-center justify-between gap-3 text-white">
                      <span>🔒 鑑定結果(未開封)</span>
                      <button className="text-xs bg-white/10 border border-white/20 px-2 py-1 rounded-lg" onClick={() => onOpenResult(m.id)}>
                        開封する{plan === "subscription" && subscriptionActive ? "(無料)" : `(${pricing.open}pt)`}
                      </button>
                    </div>
                  ) : (
                    <p className={cls("whitespace-pre-wrap leading-relaxed", m.role === "user" ? "text-white" : "text-white/90")}>{m.text}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 入力エリア（固定） */}
      <div className="fixed bottom-[56px] left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)] px-4">
        {uploads.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {uploads.map((u, idx) => (
              <div key={idx} className="min-w-[140px] border border-white/15 bg-white/5 rounded-2xl p-2 text-xs flex items-center gap-2">
                <span className="opacity-80">{u.type === "image" ? "🖼" : u.type === "video" ? "🎬" : "📎"}</span>
                <span className="truncate max-w-[96px]" title={u.name}>{u.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="bg-[#0e1424] border border-white/10 rounded-2xl p-2 flex items-end gap-2 shadow-xl">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ご相談内容を入力…"
            className="flex-1 bg-transparent outline-none resize-none text-sm max-h-28 min-h-[44px] placeholder:text-white/50"
          />
          <div className="flex gap-1">
            <IconBtn onClick={() => fileRef.current?.click()}>🖼</IconBtn>
            <IconBtn onClick={() => videoRef.current?.click()}>🎬</IconBtn>
            <label className="rounded-xl px-3 py-2 text-base bg-white/5 border border-white/10">📎
              <input type="file" className="hidden" onChange={(e) => onFile(e, "file")} />
            </label>
          </div>
          <button
            onClick={onSend}
            disabled={text.trim() === "" && uploads.length === 0}
            className="rounded-xl bg-white text-gray-900 px-5 py-2 h-10 text-sm font-semibold disabled:opacity-50"
            title={plan === "subscription" && subscriptionActive ? "月額内" : `送信時 ${pricing.send}pt 消費`}
          >送信</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e, "image")} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e, "video")} />
        </div>
        {plan === "points" && (
          <div className="mt-1 text-[11px] text-white/60">※ 送信・開封時にポイントが消費されます。</div>
        )}
      </div>
    </section>
  );
}

function IconBtn({ children, onClick }: any) {
  return (
    <button onClick={onClick} className="rounded-xl px-3 py-2 text-base bg-white/5 border border-white/10">
      {children}
    </button>
  );
}

function Attachment({ item, contrast }: { item: { type: string; url: string; name: string }; contrast: boolean }) {
  const base = contrast ? "opacity-95" : "opacity-90";
  if (item.type === "image") return <img src={item.url} alt={item.name} className={cls("rounded-xl max-h-48", base)} />;
  if (item.type === "video") return <video src={item.url} controls className={cls("rounded-xl max-h-48", base)} />;
  return (
    <a href={item.url} target="_blank" className={cls("underline break-all", base)} rel="noreferrer">{item.name}</a>
  );
}

// ====== Account (プラン/決済) ======
function Account({ plan, setPlan, points, setPoints, subscriptionActive, setSubscriptionActive }: any) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">プラン</h2>

      <div className="grid grid-cols-1 gap-3">
        {/* 月額 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">月額サブスク</div>
              <div className="text-sm text-white/70">ポイント消費なし。相談・開封が使い放題。</div>
            </div>
            <Ribbon rank={'S' as any} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={plan === "subscription"} onChange={() => setPlan("subscription")} /> このプランにする
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className={cls("rounded-xl px-4 py-2 text-sm font-semibold", subscriptionActive ? "bg-emerald-300 text-gray-900" : "bg-white text-gray-900")}
              onClick={() => {
                if (!subscriptionActive) {
                  window.open(STRIPE_TEST_CHECKOUT_SUBSCRIPTION, "_blank");
                  alert("デモ: StripeのテストCheckoutへ遷移します。決済後は下のボタンで有効化してください。");
                }
              }}
            >{subscriptionActive ? "契約中" : "Stripeで契約(テスト)"}</button>
            {!subscriptionActive && (
              <button className="rounded-xl px-3 py-2 text-xs bg-white/10 border border-white/20" onClick={() => setSubscriptionActive(true)}>← 決済済として有効化(デモ)</button>
            )}
          </div>
        </div>

        {/* ポイント */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">ポイント制</div>
              <div className="text-sm text白/70">ランク別に送信/開封でポイント消費。</div>
            </div>
            <Ribbon rank={'A' as any} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={plan === "points"} onChange={() => setPlan("points")} /> このプランにする
            </label>
            <span className="text-sm text-white/80">残高: <b>{yen(points)}</b></span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold bg白 text-gray-900" onClick={() => { window.open(STRIPE_TEST_CHECKOUT_POINTS_1000, "_blank"); setPoints(points + 1000); }}>1000pt購入(テスト)</button>
            <button className="rounded-xl px-4 py-2 text-sm font-semibold bg白 text-gray-900" onClick={() => { window.open(STRIPE_TEST_CHECKOUT_POINTS_3000, "_blank"); setPoints(points + 3000); }}>3000pt購入(テスト)</button>
          </div>
          <div className="mt-3 text-[11px] text-white/60">※ 実運用ではStripe Webhookで残高反映/サブスク状態をサーバーで管理してください。</div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">料金テーブル(ポイント制時)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/70">
                  <th className="py-1">ランク</th>
                  <th className="py-1">送信</th>
                  <th className="py-1">開封</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(RANK_PRICING).map(([rank, p]) => (
                  <tr key={rank} className="border-t border-white/10">
                    <td className="py-1">{p.label}</td>
                    <td className="py-1">{yen(p.send)}</td>
                    <td className="py-1">{yen(p.open)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-white/50">© {new Date().getFullYear()} Fortune Demo</div>
    </section>
  );
}

// ====== デモ用テキスト ======
function demoReadingText() {
  return [
    "あなたの直感が冴えています。焦らず、まずは目の前の小さな一歩を踏み出しましょう。",
    "心のバランスが回復しつつあります。深呼吸と短い散歩が運気を整えます。",
    "連絡は午前中が吉。素直な一言が大きな変化を生みます。",
    "変化の波が近づいています。迷った時は、最初に浮かんだ選択が正解です。",
  ][Math.floor(Math.random() * 4)];
}
