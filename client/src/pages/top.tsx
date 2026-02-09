import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, ChevronLeft, Sparkles, LogOut, Home as HomeIcon, Users, MessageCircle, Settings, Star, Paperclip, X, Clock, CalendarOff } from "lucide-react";

const API_BASE = "";
const YEN_PER_POINT = 1.5;

const RANK_TABLE: Record<string, { key: string; jp: string; mult: number; color: string }> = {
  DIAMOND_PLUS: { key: "DIAMOND_PLUS", jp: "ダイヤモンド+", mult: 7, color: "from-cyan-200 to-blue-500" },
  DIAMOND: { key: "DIAMOND", jp: "ダイヤモンド", mult: 6, color: "from-cyan-100 to-sky-400" },
  PLATINUM_PLUS: { key: "PLATINUM_PLUS", jp: "プラチナ+", mult: 5, color: "from-violet-200 to-purple-500" },
  PLATINUM: { key: "PLATINUM", jp: "プラチナ", mult: 4, color: "from-slate-200 to-zinc-500" },
  GOLD: { key: "GOLD", jp: "ゴールド", mult: 3, color: "from-amber-200 to-orange-500" },
  SILVER: { key: "SILVER", jp: "シルバー", mult: 2, color: "from-neutral-200 to-gray-400" },
  BRONZE: { key: "BRONZE", jp: "ブロンズ", mult: 1, color: "from-orange-300 to-amber-700" },
};
const getRankInfo = (rank: string) => RANK_TABLE[rank] || RANK_TABLE.BRONZE;

const SAMPLE_GENRES = ["恋愛", "仕事", "人間関係", "金運", "健康"];

const FREE_TEMPLATES = [
  "はじめまして。最近悩んでいることがあり、ご相談させてください。",
  "恋愛について占っていただきたいです。",
  "仕事の転機が来ている気がします。アドバイスをお願いします。",
];

const cls = (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(" ");
const fmtPts = (n: number) => `${n.toLocaleString()}pt`;
const yen = (pts: number) => `${Math.round(pts * YEN_PER_POINT).toLocaleString()}円`;
const truncate = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");
const timefmt = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

const genreColor = (g: string) => {
  const map: Record<string, { on: string; off: string }> = {
    "恋愛": { on: "bg-pink-100 border-pink-400 text-pink-700", off: "bg-pink-50 border-pink-200 text-gray-500" },
    "仕事": { on: "bg-blue-100 border-blue-400 text-blue-700", off: "bg-pink-50 border-pink-200 text-gray-500" },
    "人間関係": { on: "bg-green-100 border-green-400 text-green-700", off: "bg-pink-50 border-pink-200 text-gray-500" },
    "金運": { on: "bg-amber-100 border-amber-400 text-amber-700", off: "bg-pink-50 border-pink-200 text-gray-500" },
    "健康": { on: "bg-teal-100 border-teal-400 text-teal-700", off: "bg-pink-50 border-pink-200 text-gray-500" },
  };
  return map[g] || map["恋愛"];
};

const storage = {
  load: <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem("ftapp_" + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  save: (key: string, value: any) => { try { localStorage.setItem("ftapp_" + key, JSON.stringify(value)); } catch {} },
};

type Advisor = {
  id: number;
  user_id: number;
  name: string;
  headline: string;
  intro: string;
  rank: string;
  rank_label: string;
  profile_image: string;
  icon_image: string;
  is_recommended: boolean;
  style: string;
  divination_methods: string[];
  regular_holidays: string;
  business_hours: string;
  long_intro: string;
  tags: string[];
};

type ChatMessage = {
  id: number | string;
  sender: "querent" | "fortuneteller";
  text: string | null;
  title?: string | null;
  category?: string;
  cost_pt?: number;
  is_locked?: boolean;
  created_at: string;
  attachments?: any[];
  free?: boolean;
};

type Thread = {
  roomId: string | null;
  advisorId: number;
  messages: ChatMessage[];
};

type ThreadsMap = Record<number, Thread>;

type QuerentInfo = {
  name: string;
  email: string;
  tel_number: string;
  postal_code: string;
  address: string;
  birthdate: string;
  zodiac_sign: string;
  birthplace: string;
  birthtime: string;
  worry_category: string;
  worry_message: string;
  subscription: boolean;
  subscription_end_date: string | null;
  point: number;
};

function Ribbon({ rank }: { rank: string }) {
  const info = getRankInfo(rank);
  return (
    <span className={cls("text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r", info.color, "text-gray-900")}
      data-testid={`badge-rank-${rank}`}>
      {info.jp}
    </span>
  );
}

function IconBtn({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className={cls("w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-sm font-semibold text-gray-700", className)}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600 text-xs">{label}</span>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600 text-xs">{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none">
        {options.map((o) => <option key={o} value={o} className="bg-white">{o}</option>)}
      </select>
    </label>
  );
}

function Textarea({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600 text-xs">{label}</span>
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4}
        className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-none" />
      {hint && <div className="text-right text-[10px] text-gray-400">{hint}</div>}
    </label>
  );
}

function Header({ user, loading, point, subscriptionActive, onGoPlan, onLogout }: { user: any; loading: boolean; point?: number; subscriptionActive?: boolean; onGoPlan: () => void; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-pink-200">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-lg font-bold tracking-wide text-gray-900" data-testid="text-app-title">
            <Sparkles className="w-5 h-5 inline-block mr-1 text-pink-600" />
            占いチャット
          </div>
          {!loading && user && (
            <div className="flex items-center gap-3 flex-wrap">
              {subscriptionActive ? (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-1 rounded-full" data-testid="badge-subscription">月額プラン</span>
              ) : (
                <button onClick={onGoPlan} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-300 px-2 py-1 rounded-full" data-testid="badge-points">
                  {fmtPts(point ?? 0)}
                </button>
              )}
              <span className="text-xs text-gray-400 hidden sm:inline" data-testid="text-user-email">{user.email}</span>
              <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-700" data-testid="button-logout">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function AdvisorMiniCard({ advisor, onStartChat, onFav, favorites, rankNumber }: { advisor: Advisor; onStartChat: (id: number) => void; onFav: (id: number) => void; favorites: number[]; rankNumber?: number }) {
  return (
    <div className="relative min-w-[160px] max-w-[180px] bg-white border border-pink-200 rounded-2xl p-3 space-y-2 flex-shrink-0">
      {rankNumber != null && (
        <div className="absolute top-1.5 left-1.5 z-10 text-[10px] bg-amber-500 text-gray-900 font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">{rankNumber}</div>
      )}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          data-testid={`avatar-mini-${advisor.id}`}>
          {advisor.icon_image ? <img src={advisor.icon_image} alt="" className="w-full h-full rounded-full object-cover" /> : advisor.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate text-gray-900">{advisor.name}</div>
          <Ribbon rank={advisor.rank} />
        </div>
      </div>
      <p className="text-[10px] text-gray-500 line-clamp-2">{advisor.headline}</p>
      <div className="grid grid-cols-2 gap-1">
        <button className={cls("rounded-lg py-1 text-[10px] font-semibold border border-pink-200", favorites.includes(advisor.id) ? "bg-pink-100 text-pink-700" : "text-gray-700")}
          onClick={() => onFav(advisor.id)} data-testid={`button-fav-mini-${advisor.id}`}>
          {favorites.includes(advisor.id) ? <><Star className="w-3 h-3 inline fill-pink-400 text-pink-400" /> 済</> : <><Star className="w-3 h-3 inline" /> +</>}
        </button>
        <button className="rounded-lg py-1 text-[10px] font-semibold bg-pink-50 border border-pink-200 text-gray-700"
          onClick={() => onStartChat(advisor.id)} data-testid={`button-chat-mini-${advisor.id}`}>相談</button>
      </div>
    </div>
  );
}

function RankedCarousel({ title, advisors, onStartChat, onFav, favorites, limit = 10, showRankBadge = true, emptyText = "" }: {
  title: string; advisors: Advisor[]; onStartChat: (id: number) => void; onFav: (id: number) => void; favorites: number[]; limit?: number; showRankBadge?: boolean; emptyText?: string;
}) {
  const limited = advisors.slice(0, limit);
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      {limited.length === 0 ? (
        <div className="text-xs text-gray-400 py-4 text-center">{emptyText || "該当なし"}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {limited.map((a, idx) => (
            <div key={a.id}>
              <AdvisorMiniCard advisor={a} onStartChat={onStartChat} onFav={onFav} favorites={favorites} rankNumber={showRankBadge ? idx + 1 : undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedAdvisors({ advisors, onStartChat, onFav, favorites }: { advisors: Advisor[]; onStartChat: (id: number) => void; onFav: (id: number) => void; favorites: number[] }) {
  const featured = useMemo(() => advisors.filter((a) => a.is_recommended).slice(0, 5), [advisors]);
  if (featured.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1"><Sparkles className="w-4 h-4 text-pink-600" /> おすすめの占い師</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {featured.map((a) => <AdvisorMiniCard key={a.id} advisor={a} onStartChat={onStartChat} onFav={onFav} favorites={favorites} />)}
      </div>
    </div>
  );
}

function CardList({ advisors, onStartChat, onFav, favorites, emptyText = "" }: { advisors: Advisor[]; onStartChat: (id: number) => void; onFav: (id: number) => void; favorites: number[]; emptyText?: string }) {
  const [detailId, setDetailId] = useState<number | null>(null);
  const adv = (id: number) => advisors.find((a) => a.id === id);
  if (advisors.length === 0) return <div className="text-center text-gray-400 text-sm py-8">{emptyText || "該当する占い師が見つかりませんでした"}</div>;
  return (
    <div className="space-y-3">
      {advisors.map((a) => (
        <div key={a.id} className="bg-white border border-pink-200 rounded-2xl p-4 space-y-3" data-testid={`card-advisor-${a.id}`}>
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
              {a.icon_image ? <img src={a.icon_image} alt="" className="w-full h-full rounded-full object-cover" /> : a.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate text-gray-900" data-testid={`text-advisor-name-${a.id}`}>{a.name}</span>
                <Ribbon rank={a.rank} />
                {a.is_recommended && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">おすすめ</span>}
              </div>
              <p className="text-xs text-pink-700 leading-relaxed">{a.headline}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {a.style && <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded-full" data-testid={`badge-style-${a.id}`}>{a.style}</span>}
                {(a.divination_methods || []).map((m) => (
                  <span key={m} className="text-[10px] bg-cyan-100 text-cyan-700 border border-cyan-300 px-1.5 py-0.5 rounded-full" data-testid={`badge-method-${a.id}-${m}`}>{m}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{a.intro}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className={cls("rounded-xl py-2 text-xs font-semibold border border-pink-200", favorites.includes(a.id) ? "bg-pink-100 text-pink-700" : "text-gray-700")}
              onClick={() => onFav(a.id)} data-testid={`button-fav-${a.id}`}>
              {favorites.includes(a.id) ? <><Star className="w-3 h-3 inline fill-pink-400 text-pink-400" /> お気に入り</> : <><Star className="w-3 h-3 inline" /> お気に入り</>}
            </button>
            <button className="rounded-xl py-2 text-xs font-semibold bg-pink-50 border border-pink-200 text-gray-700"
              onClick={() => setDetailId(a.id)} data-testid={`button-detail-${a.id}`}>詳細を見る</button>
          </div>
        </div>
      ))}
      {detailId && adv(detailId) && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setDetailId(null)}>
          <div className="w-full max-w-md bg-white border border-pink-200 rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {adv(detailId)!.profile_image ? (
              <img src={adv(detailId)!.profile_image} className="w-full h-40 object-cover" alt="" data-testid="img-detail-banner" />
            ) : (
              <div className="w-full h-28 bg-gradient-to-br from-pink-200 to-pink-300" data-testid="img-detail-banner-placeholder" />
            )}
            <div className="p-4">
              <div className="flex items-center gap-3 -mt-10 relative z-10">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0 ring-3 ring-white" data-testid="icon-detail-avatar">
                  {adv(detailId)!.icon_image ? <img src={adv(detailId)!.icon_image} alt="" className="w-full h-full rounded-full object-cover" /> : adv(detailId)!.name.charAt(0)}
                </div>
                <div className="min-w-0 pt-8">
                  <div className="font-semibold truncate flex items-center gap-2 text-gray-900">{adv(detailId)!.name} <Ribbon rank={adv(detailId)!.rank} /></div>
                </div>
              </div>
              <h4 className="mt-3 font-semibold text-pink-700">{adv(detailId)!.headline}</h4>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {adv(detailId)!.style && (
                  <span className="text-[11px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full" data-testid="badge-detail-style">{adv(detailId)!.style}</span>
                )}
                {(adv(detailId)!.divination_methods || []).map((m) => (
                  <span key={m} className="text-[11px] bg-cyan-100 text-cyan-700 border border-cyan-300 px-2 py-0.5 rounded-full" data-testid={`badge-detail-method-${m}`}>{m}</span>
                ))}
              </div>
              {(adv(detailId)!.business_hours || adv(detailId)!.regular_holidays) && (
                <div className="mt-3 space-y-1.5 bg-pink-50 rounded-xl p-3 border border-pink-200">
                  {adv(detailId)!.business_hours && (
                    <div className="flex items-center gap-2 text-xs text-gray-600" data-testid="text-detail-hours">
                      <Clock className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
                      <span>営業時間: {adv(detailId)!.business_hours}</span>
                    </div>
                  )}
                  {adv(detailId)!.regular_holidays && (
                    <div className="flex items-center gap-2 text-xs text-gray-600" data-testid="text-detail-holidays">
                      <CalendarOff className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
                      <span>定休日: {adv(detailId)!.regular_holidays}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700" data-testid="text-detail-intro">
                  {truncate(adv(detailId)!.long_intro || adv(detailId)!.intro || "", 10000)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-xl py-2 text-xs font-semibold bg-pink-600 text-white" data-testid="button-start-chat-detail"
                  onClick={() => { onStartChat(detailId); setDetailId(null); }}>この占い師に相談</button>
                <button className="rounded-xl py-2 text-xs font-semibold bg-pink-50 border border-pink-200 text-gray-700" onClick={() => setDetailId(null)}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Advisors({ advisorsFromTop, favorites, onFav, onStartChat }: { advisorsFromTop: Advisor[]; favorites: number[]; onFav: (id: number) => void; onStartChat: (id: number) => void }) {
  const [q, setQ] = useState("");
  const lowerQ = q.toLowerCase();
  const filtered = advisorsFromTop.filter((a) => a.name.toLowerCase().includes(lowerQ) || (a.tags || []).join(" ").toLowerCase().includes(lowerQ) || a.headline.toLowerCase().includes(lowerQ));
  return (
    <section className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-1 bg-white/90 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・ジャンルで検索" data-testid="input-search-advisors"
            className="w-full rounded-2xl bg-pink-50 border border-pink-200 pl-9 pr-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
        </div>
      </div>
      <CardList advisors={filtered} onStartChat={onStartChat} onFav={onFav} favorites={favorites} emptyText="該当する占い師が見つかりませんでした" />
    </section>
  );
}

function ConfirmModal({ cost, onConfirm, onCancel, querentInfo }: { cost: number; onConfirm: () => void; onCancel: () => void; querentInfo: QuerentInfo | null }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
      <div className="w-full max-w-sm bg-white border border-pink-200 rounded-2xl overflow-hidden p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-lg font-semibold text-pink-700" data-testid="text-confirm-title">ポイント消費の確認</h4>
        <p className="text-gray-900 leading-relaxed">
          このメッセージを送信すると、<b className="text-lg text-pink-600">{fmtPts(cost)}</b>（約{yen(cost)}）を消費します。
        </p>
        <p className="text-sm text-gray-600">残ポイント: <b>{fmtPts(querentInfo?.point ?? 0)}</b></p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button className="rounded-xl py-2 text-sm font-semibold bg-pink-50 border border-pink-200 text-gray-700" onClick={onCancel} data-testid="button-cancel-confirm">キャンセル</button>
          <button className="rounded-xl py-2 text-sm font-semibold bg-pink-600 text-white" onClick={onConfirm} data-testid="button-confirm-send">送信して消費する</button>
        </div>
      </div>
    </div>
  );
}

const FULLWIDTH_REGEX = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFF9F\u2000-\u206F\s\n\r、。！？「」『』（）・ー〜…―]+$/;
const isValidJapaneseText = (text: string) => text.trim() === "" || FULLWIDTH_REGEX.test(text);

function getQuerentBubbleColor(m: ChatMessage): string {
  if (m.sender === "querent") {
    if (m.free || m.category === "free") return "bg-emerald-600";
    return "bg-gradient-to-br from-pink-500 to-pink-600";
  }
  if (m.category === "treatment") return "bg-amber-50 border border-amber-200";
  if (m.category === "length_paying") return "bg-pink-50 border border-pink-200";
  return "bg-gray-100 border border-pink-200";
}

type RoomInfo = {
  id: string;
  fortuneteller_id: number;
  fortuneteller_name: string;
  fortuneteller_icon?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
};

function ChatRoomList({ onSelectAdvisor, advisors }: { onSelectAdvisor: (advisorId: number) => void; advisors: Advisor[] }) {
  const { data: rooms = [], isLoading } = useQuery<RoomInfo[]>({
    queryKey: ["/api/my_rooms"],
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="text-gray-500 text-center py-8">読み込み中...</div>;
  if (rooms.length === 0) return <div className="text-center text-gray-400 text-sm py-8">まだ相談履歴がありません。占い師を選んで相談を始めましょう。</div>;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900 text-sm">相談履歴</h3>
      {rooms.map((room) => (
        <button key={room.id} onClick={() => onSelectAdvisor(room.fortuneteller_id)}
          className="w-full text-left bg-white border border-pink-200 rounded-2xl p-3 flex items-center gap-3"
          data-testid={`button-room-${room.id}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {room.fortuneteller_icon ? <img src={room.fortuneteller_icon} alt="" className="w-full h-full rounded-full object-cover" /> : (room.fortuneteller_name || "?").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate text-gray-900">{room.fortuneteller_name}</span>
              {room.unread_count > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex-shrink-0"
                  data-testid={`badge-unread-room-${room.id}`}>{room.unread_count > 99 ? "99+" : room.unread_count}</span>
              )}
            </div>
            {room.last_message && <p className="text-xs text-gray-500 truncate mt-0.5">{room.last_message}</p>}
          </div>
          {room.last_message_at && <span className="text-[10px] text-gray-400 flex-shrink-0">{timefmt(room.last_message_at)}</span>}
        </button>
      ))}
    </div>
  );
}

function Chat({ plan, points, setPoints, subscriptionActive, advisor, thread, setThreads, onBack, querentInfo, advisors, onSelectAdvisor }: {
  plan: string; points: number; setPoints: (fn: (p: number) => number) => void; subscriptionActive: boolean; advisor: Advisor | null;
  thread?: Thread; setThreads: React.Dispatch<React.SetStateAction<ThreadsMap>>; onBack: () => void; querentInfo: QuerentInfo | null;
  advisors: Advisor[]; onSelectAdvisor: (advisorId: number) => void;
}) {
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [costToConfirm, setCostToConfirm] = useState<number | null>(null);
  const [isFromTemplate, setIsFromTemplate] = useState(false);
  const [roomLoading, setRoomLoading] = useState(true);
  const [room, setRoom] = useState<{ id: string } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [inputError, setInputError] = useState("");
  const messages = thread?.messages ?? [];

  const scrollBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (!advisor) return;
    const fetchRoom = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/get_room?fortuneteller=${advisor.id}`, { credentials: "include" });
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (data) {
          setRoom({ id: data.id });
          fetch(`${API_BASE}/api/rooms/${data.id}/mark_read`, { method: "POST", credentials: "include" }).catch(() => {});
          queryClient.invalidateQueries({ queryKey: ["/api/unread_count"] });
          queryClient.invalidateQueries({ queryKey: ["/api/my_rooms"] });
        } else { setRoom(null); }
      } catch (e) { console.error(e); setRoom(null); }
      finally { setRoomLoading(false); }
    };
    fetchRoom();
  }, [advisor?.id]);

  useEffect(() => {
    if (roomLoading || !advisor) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = room
      ? `${proto}//${location.host}/ws?room_id=${room.id}`
      : `${proto}//${location.host}/ws?fortuneteller_id=${advisor.id}`;
    const sock = new WebSocket(wsUrl);
    socketRef.current = sock;

    sock.onopen = () => {
      sock.send(JSON.stringify({ type: "mark_read" }));
    };

    sock.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "history") {
        setThreads((prev) => ({
          ...prev,
          [advisor.id]: { advisorId: advisor.id, roomId: data.room_id || room?.id || null, messages: data.messages || [] },
        }));
        sock.send(JSON.stringify({ type: "mark_read" }));
        queryClient.invalidateQueries({ queryKey: ["/api/unread_count"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my_rooms"] });
        setTimeout(scrollBottom, 50);
        return;
      }
      if (data.type === "new_message") {
        setThreads((prev) => {
          const t = prev[advisor.id] ?? { advisorId: advisor.id, roomId: data.room_id || null, messages: [] };
          return { ...prev, [advisor.id]: { ...t, roomId: data.room_id ?? t.roomId, messages: [...(t.messages ?? []), data.message] } };
        });
        sock.send(JSON.stringify({ type: "mark_read" }));
        queryClient.invalidateQueries({ queryKey: ["/api/unread_count"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my_rooms"] });
        setTimeout(scrollBottom, 50);
      }
      if (data.type === "room_init") {
        setRoom({ id: data.room_id });
      }
    };
    return () => { sock.close(); };
  }, [roomLoading, advisor?.id, room?.id, setThreads, scrollBottom]);

  useEffect(() => { setTimeout(scrollBottom, 100); }, [messages.length, scrollBottom]);

  if (!advisor) return <section className="py-4"><ChatRoomList onSelectAdvisor={onSelectAdvisor} advisors={advisors} /></section>;

  const handleTextChange = (value: string) => {
    setText(value);
    if (showTemplates) setShowTemplates(false);
    setIsFromTemplate(false);
    if (value && !isValidJapaneseText(value)) {
      setInputError("全角ひらがな・カタカナ・漢字のみ入力可能です");
    } else {
      setInputError("");
    }
  };

  const unlockTreatment = async (msgId: string, costPt: number) => {
    if (unlockingId) return;
    const doUnlock = confirm(`この施術メッセージを開封しますか？\n${costPt}pt（約${Math.round(costPt * YEN_PER_POINT).toLocaleString()}円）を消費します。`);
    if (!doUnlock) return;
    setUnlockingId(msgId);
    try {
      const res = await apiRequest("POST", "/api/unlock_message", { message_id: msgId });
      const data = await res.json();
      setThreads((prev) => {
        if (!advisor) return prev;
        const t = prev[advisor.id];
        if (!t) return prev;
        return {
          ...prev,
          [advisor.id]: {
            ...t,
            messages: t.messages.map((m) =>
              String(m.id) === msgId
                ? { ...m, text: data.unlocked_message.text, title: data.unlocked_message.title, is_locked: false }
                : m
            ),
          },
        };
      });
      if (costPt > 0 && !(plan === "subscription" && subscriptionActive)) setPoints((p) => p - costPt);
      queryClient.invalidateQueries({ queryKey: ["/api/get_querent_info"] });
    } catch (e: any) {
      alert(e.message || "開封に失敗しました");
    } finally {
      setUnlockingId(null);
    }
  };

  const executeSend = (cost: number, free: boolean) => {
    if (!free && !(plan === "subscription" && subscriptionActive)) setPoints((p) => p - cost);
    const payload: any = { type: "chat_message", sender: "querent", text: text.trim(), attachments: uploads, free };
    if (!room) payload.advisor_id = advisor.id;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else { console.warn("WebSocket not open"); }
    setText(""); setUploads([]); setCostToConfirm(null); setShowTemplates(false); setIsFromTemplate(false); setInputError("");
  };

  const onSend = () => {
    const trimmed = text.trim();
    if (trimmed === "" && uploads.length === 0) return;
    if (!isFromTemplate && trimmed && !isValidJapaneseText(trimmed)) {
      setInputError("全角ひらがな・カタカナ・漢字のみ入力可能です");
      return;
    }
    if (isFromTemplate) { executeSend(0, true); return; }
    if (plan === "subscription" && subscriptionActive) { executeSend(0, false); return; }
    const rankInfo = getRankInfo(advisor.rank);
    const cost = trimmed.length * rankInfo.mult;
    if (points < cost) { alert(`ポイントが不足しています。必要: ${cost}pt。ポイントを購入してください。`); return; }
    setCostToConfirm(cost);
  };

  const onConfirmSend = () => { if (costToConfirm !== null) executeSend(costToConfirm, false); };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || !files.length) return;
    const newUploads = Array.from(files).map((f) => {
      const url = URL.createObjectURL(f);
      let type = "file"; if (f.type.startsWith("image/")) type = "image"; else if (f.type.startsWith("video/")) type = "video";
      return { type, url, name: f.name };
    });
    setUploads(newUploads); e.target.value = "";
  };
  const removeUpload = (i: number) => setUploads((prev) => prev.filter((_, idx) => idx !== i));
  const applyTemplate = (t: string) => { setText(t); setShowTemplates(false); setIsFromTemplate(true); setInputError(""); };

  if (roomLoading) return <div className="text-gray-500 p-4">読み込み中...</div>;

  return (
    <section className="pb-28">
      {costToConfirm !== null && <ConfirmModal cost={costToConfirm} onConfirm={onConfirmSend} onCancel={() => setCostToConfirm(null)} querentInfo={querentInfo} />}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-0 bg-white/90 backdrop-blur border-b border-pink-200">
        <div className="flex items-center gap-3 py-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {advisor.icon_image ? <img src={advisor.icon_image} alt="" className="w-full h-full rounded-full object-cover ring-2 ring-pink-200" /> : advisor.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight truncate text-gray-900" data-testid="text-chat-advisor-name">{advisor.name}</div>
            <div className="text-[11px] text-gray-600 flex items-center gap-2 flex-wrap">
              <Ribbon rank={advisor.rank} />
              {plan === "subscription" && subscriptionActive ? (
                <span className="text-emerald-600">月額内で使い放題</span>
              ) : (
                <span>1文字={getRankInfo(advisor.rank).mult}pt / 1pt={YEN_PER_POINT}円</span>
              )}
            </div>
          </div>
          <button className="ml-auto text-xs font-semibold rounded-xl px-3 py-1 bg-pink-50 border border-pink-200 text-gray-700" onClick={onBack} data-testid="button-back-to-list">一覧へ</button>
        </div>
        <div className="mt-2 mb-2 border-t border-pink-200 pt-2">
          <div className="rounded-2xl overflow-hidden border border-pink-200">
            {advisor.profile_image && <img src={advisor.profile_image} className="w-full h-28 object-cover" alt="" />}
            <div className="p-3">
              <div className="text-sm font-semibold text-gray-900">{advisor.headline}</div>
              <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{truncate(advisor.intro, 150)}</p>
            </div>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="mt-3 space-y-3 max-h-[50vh] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8 text-sm">最初のご相談内容を送ってみましょう。</div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={cls("px-2", m.sender === "querent" ? "text-right" : "text-left")}>
                <div className={cls("inline-block max-w-[85%] rounded-2xl p-3 shadow-lg", getQuerentBubbleColor(m))} data-testid={`message-${m.id}`}>
                  <div className={cls("text-[10px] mb-1", m.sender === "querent" ? "text-white/70" : "text-gray-500")}>
                    {m.sender === "querent"
                      ? (m.free || m.category === "free" ? "あなた(無料)" : "あなた")
                      : (m.category === "treatment" ? "占い師 [施術]" : m.category === "length_paying" ? "占い師 [有料]" : "占い師")
                    } {timefmt(m.created_at)}
                  </div>
                  {m.category === "treatment" && m.title && !m.is_locked && (
                    <div className={cls("text-[11px] font-bold mb-1 border-b pb-1", m.sender === "querent" ? "border-white/20" : "border-pink-200")}>{m.title}</div>
                  )}
                  {m.is_locked && m.category === "treatment" ? (
                    <div className="space-y-2">
                      {m.title && <div className="text-[11px] font-bold text-gray-900">{m.title}</div>}
                      <div className="text-xs text-gray-500 italic">[施術メッセージ: {m.cost_pt ?? 0}pt]</div>
                      <button
                        onClick={() => unlockTreatment(String(m.id), m.cost_pt ?? 0)}
                        disabled={unlockingId === String(m.id)}
                        className="text-[11px] bg-amber-500 text-gray-900 font-semibold px-3 py-1 rounded-lg hover-elevate active-elevate-2 disabled:opacity-50"
                        data-testid={`button-unlock-${m.id}`}
                      >
                        {unlockingId === String(m.id) ? "開封中..." : `開封する（${m.cost_pt ?? 0}pt消費）`}
                      </button>
                    </div>
                  ) : (
                    <p className={cls("whitespace-pre-wrap leading-relaxed", m.sender === "querent" ? "text-white" : "text-gray-900")}>{m.text}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="fixed bottom-[56px] left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)] px-4">
        {plan === "points" && (
          <div className="text-right mb-1 text-[11px] text-gray-500">
            ※ 1pt={YEN_PER_POINT}円 相当。あなたの占い師は <b>{getRankInfo(advisor.rank).jp}</b>（<b>1文字={getRankInfo(advisor.rank).mult}pt</b>）です。
          </div>
        )}
        {uploads.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {uploads.map((u, idx) => (
              <div key={idx} className="min-w-[140px] border border-pink-200 bg-pink-50 rounded-2xl p-2 text-xs flex items-center gap-2 relative text-gray-700">
                <Paperclip className="w-3 h-3 text-gray-500" />
                <span className="truncate max-w-[96px]" title={u.name}>{u.name}</span>
                <button onClick={() => removeUpload(idx)} className="absolute top-0 right-0 p-1 text-gray-400 hover:text-gray-700 text-sm leading-none"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        {inputError && <div className="text-[10px] text-red-400 mb-1" data-testid="text-input-error">{inputError}</div>}
        <div className="bg-white border border-pink-200 rounded-2xl p-2 flex items-end gap-2 shadow-xl">
          <textarea value={text} onChange={(e) => handleTextChange(e.target.value)}
            onFocus={() => { if (text.trim() === "" && uploads.length === 0) setShowTemplates(true); }}
            placeholder="ご相談内容を入力..." data-testid="input-chat-message"
            className="flex-1 bg-transparent outline-none resize-none text-sm max-h-28 min-h-[44px] text-gray-900 placeholder:text-gray-400" />
          {showTemplates && (
            <div className="absolute bottom-[56px] left-0 right-0 w-full bg-white border border-pink-200 rounded-xl p-2 space-y-1 shadow-xl z-30">
              <div className="text-[11px] text-gray-500 pl-2">無料テンプレを選択してすぐ相談</div>
              {FREE_TEMPLATES.map((t, i) => (
                <button key={i} className="w-full text-left text-xs bg-pink-50 border border-pink-200 rounded px-2 py-1 text-gray-700" onClick={() => applyTemplate(t)} data-testid={`button-template-${i}`}>
                  「{truncate(t, 20)}」を挿入
                </button>
              ))}
              <div className="text-right">
                <button className="text-[10px] text-gray-400" onClick={() => setShowTemplates(false)}>閉じる</button>
              </div>
            </div>
          )}
          <div className="relative">
            <IconBtn onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="w-4 h-4" />
            </IconBtn>
            <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={onFileChange} />
          </div>
          <button onClick={onSend} disabled={text.trim() === "" && uploads.length === 0}
            className="rounded-xl bg-pink-600 text-white px-5 py-2 h-10 text-sm font-semibold disabled:opacity-50" data-testid="button-send-message"
            title={isFromTemplate ? "無料テンプレ" : (plan === "subscription" && subscriptionActive ? "月額内" : `送信時 ${text.trim().length * getRankInfo(advisor?.rank || "SILVER").mult}pt 消費`)}>
            {isFromTemplate ? "無料送信" : "送信"}
          </button>
        </div>
      </div>
    </section>
  );
}

function BottomNav({ activeTab, setActiveTab, unreadCount = 0 }: { activeTab: string; setActiveTab: (tab: string) => void; unreadCount?: number }) {
  const items = [
    { id: "home", label: "ホーム", icon: HomeIcon },
    { id: "advisors", label: "占い師", icon: Users },
    { id: "chat", label: "相談", icon: MessageCircle },
    { id: "account", label: "登録/プラン", icon: Settings },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] bg-white/95 backdrop-blur border-t border-pink-200">
      <div className="mx-auto max-w-md grid grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button key={it.id} onClick={() => setActiveTab(it.id)} data-testid={`button-tab-${it.id}`}
              className={cls("py-3 flex flex-col items-center text-[11px]", activeTab === it.id ? "text-pink-600" : "text-gray-400")}>
              <div className="relative">
                <Icon className="w-5 h-5" />
                {it.id === "chat" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
                    data-testid="badge-unread-total">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </div>
              <div className="mt-1">{it.label}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function HomeTab({ advisors, favorites, onFav, onStartChat }: { advisors: Advisor[]; favorites: number[]; onFav: (id: number) => void; onStartChat: (id: number) => void }) {
  const [selectedGenre, setSelectedGenre] = useState(SAMPLE_GENRES[0]);
  const sortedAdvisors = useMemo(() => [...advisors].sort(() => Math.random() - 0.5), [advisors]);
  const filterAndSortByGenre = useMemo(() => sortedAdvisors.filter((a) => (a.tags || []).includes(selectedGenre) || a.headline.includes(selectedGenre)), [selectedGenre, sortedAdvisors]);

  return (
    <section className="space-y-6">
      <FeaturedAdvisors advisors={advisors} onStartChat={onStartChat} onFav={onFav} favorites={favorites} />
      <div className="h-0 border-t border-pink-200 mx-auto w-11/12" />
      <RankedCarousel title="総合ランキング TOP10" advisors={sortedAdvisors} onStartChat={onStartChat} onFav={onFav} favorites={favorites} limit={10} />
      <div className="h-0 border-t border-pink-200 mx-auto w-11/12" />
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2 text-sm">ジャンル別ランキング</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {SAMPLE_GENRES.map((g) => {
              const color = genreColor(g); const active = selectedGenre === g;
              return (
                <button key={g} onClick={() => setSelectedGenre(g)} data-testid={`button-genre-${g}`}
                  className={cls("text-xs rounded-full px-3 py-1 border transition-colors", active ? color.on : color.off)}>#{g}</button>
              );
            })}
          </div>
        </div>
        <RankedCarousel title={`${selectedGenre} ランキング TOP10`} advisors={filterAndSortByGenre} onStartChat={onStartChat} onFav={onFav} favorites={favorites}
          limit={10} emptyText={`「${selectedGenre}」に該当する占い師はいません。`} />
      </div>
      <RankedCarousel title="お気に入りリスト" advisors={advisors.filter((a) => favorites.includes(a.id))} onStartChat={onStartChat} onFav={onFav} favorites={favorites}
        limit={advisors.length} showRankBadge={false} emptyText="お気に入りの占い師を登録しましょう" />
    </section>
  );
}

function Account({ queInfoFromQuery }: { queInfoFromQuery: QuerentInfo | null }) {
  const [tab, setTab] = useState("plan");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [localInfo, setLocalInfo] = useState<QuerentInfo | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subMsg, setSubMsg] = useState<string | null>(null);

  useEffect(() => {
    if (queInfoFromQuery && !localInfo) setLocalInfo(queInfoFromQuery);
  }, [queInfoFromQuery]);

  useEffect(() => {
    if (queInfoFromQuery) setLocalInfo(queInfoFromQuery);
  }, [queInfoFromQuery?.subscription, queInfoFromQuery?.subscription_end_date]);

  const queInfo = localInfo;
  const setQueInfo = setLocalInfo;

  async function handleUpdateInfo() {
    if (!queInfo) return;
    try {
      setSubmitting(true); setSubmitMsg(null);
      await apiRequest("POST", "/api/edit_querent_info", {
        name: queInfo.name, tel_number: queInfo.tel_number, postal_code: queInfo.postal_code, address: queInfo.address,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/get_querent_info"] });
      setSubmitMsg("更新しました");
    } catch (e: any) { setSubmitMsg("更新に失敗しました"); }
    finally { setSubmitting(false); }
  }

  async function handleSubscribe() {
    try {
      setSubLoading(true); setSubMsg(null);
      await apiRequest("POST", "/api/subscribe", {});
      queryClient.invalidateQueries({ queryKey: ["/api/get_querent_info"] });
      setSubMsg("サブスクリプションを開始しました");
    } catch (e: any) {
      setSubMsg(e?.message || "契約に失敗しました");
    } finally { setSubLoading(false); }
  }

  async function handleCancelSubscription() {
    try {
      setSubLoading(true); setSubMsg(null);
      await apiRequest("POST", "/api/cancel_subscription", {});
      queryClient.invalidateQueries({ queryKey: ["/api/get_querent_info"] });
      setSubMsg("サブスクリプションを解約しました");
    } catch (e: any) {
      setSubMsg(e?.message || "解約に失敗しました");
    } finally { setSubLoading(false); }
  }

  async function handleSaveKarte() {
    if (!queInfo) return;
    try {
      await apiRequest("POST", "/api/edit_querent_karte", {
        birthdate: queInfo.birthdate, zodiac_sign: queInfo.zodiac_sign, birthplace: queInfo.birthplace, birthtime: queInfo.birthtime, worry_category: queInfo.worry_category, worry_message: queInfo.worry_message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/get_querent_info"] });
    } catch (e) { console.error("カルテ保存失敗", e); }
  }

  useEffect(() => {
    if (tab !== "karte" || !queInfo) return;
    const timer = setTimeout(handleSaveKarte, 1000);
    return () => clearTimeout(timer);
  }, [queInfo?.birthdate, queInfo?.zodiac_sign, queInfo?.birthplace, queInfo?.birthtime, queInfo?.worry_category, queInfo?.worry_message]);

  if (!queInfo) return <div className="text-gray-500 text-center py-8">プロフィール情報を読み込み中...</div>;

  return (
    <section className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "plan", label: "プラン" },
          { id: "signup", label: "登録情報" },
          { id: "karte", label: "カルテ" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`button-account-tab-${t.id}`}
            className={cls("px-3 py-2 rounded-lg text-xs", tab === t.id ? "bg-pink-600 text-white" : "bg-pink-50 border border-pink-200 text-gray-700")}>{t.label}</button>
        ))}
      </div>

      {tab === "plan" && (
        <div className="grid grid-cols-1 gap-3">
          {subMsg && (
            <div className={cls("text-xs px-3 py-2 rounded-lg border", subMsg.includes("解約") ? "text-amber-700 bg-amber-50 border-amber-300" : subMsg.includes("失敗") ? "text-red-700 bg-red-50 border-red-300" : "text-green-700 bg-green-50 border-green-300")} data-testid="text-sub-msg">
              {subMsg}
            </div>
          )}
          <div className={cls("border rounded-2xl p-4", queInfo.subscription ? "bg-emerald-50 border-emerald-300" : "bg-white border-pink-200")}>
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-4 h-4 text-pink-600" />
              <span className="font-semibold text-gray-900">月額サブスクコース</span>
              {queInfo.subscription && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">契約中</span>}
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">20,000<span className="text-sm font-normal text-gray-600">円/30日</span></div>
            <div className="mt-2 text-sm text-gray-600">全ての操作が定額内。ポイント消費なしで相談し放題。</div>
            <ul className="mt-2 space-y-1 text-sm text-gray-500">
              <li className="flex items-center gap-2"><span className="text-emerald-600">&#10003;</span> チャット送信時のポイント消費なし</li>
              <li className="flex items-center gap-2"><span className="text-emerald-600">&#10003;</span> 全ランクの占い師に定額で相談可能</li>
              <li className="flex items-center gap-2"><span className="text-emerald-600">&#10003;</span> 30日間の有効期間</li>
            </ul>
            {queInfo.subscription && queInfo.subscription_end_date && (
              <div className="mt-3 text-xs text-gray-500 bg-pink-50 rounded-lg px-3 py-2" data-testid="text-sub-end-date">
                有効期限: <b className="text-gray-900">{new Date(queInfo.subscription_end_date).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</b>
                <span className="ml-2">
                  (残り{Math.max(0, Math.ceil((new Date(queInfo.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}日)
                </span>
              </div>
            )}
            <div className="mt-3">
              {queInfo.subscription ? (
                <button onClick={handleCancelSubscription} disabled={subLoading} data-testid="button-cancel-subscription"
                  className="rounded-xl px-4 py-2 text-sm font-semibold bg-pink-50 border border-pink-200 text-gray-700 hover:bg-pink-100 disabled:opacity-50 transition-colors">
                  {subLoading ? "処理中..." : "解約する"}
                </button>
              ) : (
                <button onClick={handleSubscribe} disabled={subLoading} data-testid="button-subscribe"
                  className="rounded-xl px-4 py-2 text-sm font-semibold bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 disabled:opacity-50 transition-colors">
                  {subLoading ? "処理中..." : "このプランに申し込む（20,000円/30日）"}
                </button>
              )}
            </div>
          </div>
          <div className={cls("border rounded-2xl p-4", !queInfo.subscription ? "bg-white border-pink-200" : "bg-white border-pink-200")}>
            <div className="font-semibold text-gray-900">ポイント制</div>
            <div className="text-sm text-gray-600">1pt={YEN_PER_POINT}円。文字数xランク倍率で消費。</div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-700">残高: <b>{fmtPts(queInfo.point)}</b>（約{yen(queInfo.point)}）</span>
            </div>
            {!queInfo.subscription && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="rounded-xl px-4 py-2 text-sm font-semibold bg-pink-600 text-white" data-testid="button-buy-1000">1000pt購入(約{yen(1000)})</button>
                <button className="rounded-xl px-4 py-2 text-sm font-semibold bg-pink-600 text-white" data-testid="button-buy-3000">3000pt購入(約{yen(3000)})</button>
              </div>
            )}
            {queInfo.subscription && (
              <div className="mt-3 text-xs text-emerald-600">サブスク契約中のためポイント消費はありません</div>
            )}
          </div>
        </div>
      )}

      {tab === "signup" && (
        <div className="bg-white border border-pink-200 rounded-2xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">登録情報</h2>
          <Input label="名前" value={queInfo.name} onChange={(v) => setQueInfo({ ...queInfo, name: v })} />
          <Input label="メールアドレス" value={queInfo.email} onChange={(v) => setQueInfo({ ...queInfo, email: v })} type="email" />
          <Input label="電話番号" value={queInfo.tel_number} onChange={(v) => setQueInfo({ ...queInfo, tel_number: v })} />
          <div className="grid grid-cols-3 gap-2">
            <Input label="郵便番号" value={queInfo.postal_code} onChange={(v) => setQueInfo({ ...queInfo, postal_code: v })} />
            <div className="col-span-2"><Input label="住所" value={queInfo.address} onChange={(v) => setQueInfo({ ...queInfo, address: v })} /></div>
          </div>
          <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
            <div className="text-xs text-gray-600">
              {submitMsg && <span className="text-green-600">{submitMsg}</span>}
            </div>
            <button onClick={handleUpdateInfo} disabled={submitting} data-testid="button-update-info"
              className="px-4 py-2 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 disabled:opacity-50 text-sm text-gray-700">
              {submitting ? "送信中..." : "更新する"}
            </button>
          </div>
        </div>
      )}

      {tab === "karte" && (
        <div className="bg-white border border-pink-200 rounded-2xl p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">カルテ</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input label="生年月日" value={queInfo.birthdate} onChange={(v) => setQueInfo({ ...queInfo, birthdate: v })} placeholder="YYYY-MM-DD" />
            <Input label="星座" value={queInfo.zodiac_sign} onChange={(v) => setQueInfo({ ...queInfo, zodiac_sign: v })} placeholder="例: しし座" />
            <Input label="出生地" value={queInfo.birthplace} onChange={(v) => setQueInfo({ ...queInfo, birthplace: v })} />
            <Input label="出生時間" value={queInfo.birthtime} onChange={(v) => setQueInfo({ ...queInfo, birthtime: v })} placeholder="例: 14:30" />
          </div>
          <Select label="お悩みジャンル" value={queInfo.worry_category} onChange={(v) => setQueInfo({ ...queInfo, worry_category: v })} options={SAMPLE_GENRES} />
          <Textarea label="お悩み内容 (1000文字以内)" value={queInfo.worry_message}
            onChange={(v) => { if (v.length <= 1000) setQueInfo({ ...queInfo, worry_message: v }); }}
            hint={`${(queInfo.worry_message || "").length}/1000`} />
          <div className="text-right text-xs text-gray-500">保存は自動です</div>
        </div>
      )}
    </section>
  );
}

function LoggedOutView() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: advisors = [], isLoading: loading } = useQuery<Advisor[]>({
    queryKey: ["/api/get_fortuneteller_all"],
  });

  const filtered = advisors.filter((a) => !search || a.name.includes(search) || a.headline.includes(search));

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-30 bg-white border-b border-pink-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-lg font-bold tracking-wide" data-testid="text-app-title">
              <Sparkles className="w-5 h-5 inline-block mr-1 text-pink-600" />占いチャット
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setLocation("/querent_login")} data-testid="button-querent-login"
                className="text-[11px] bg-pink-50 border border-pink-200 px-3 py-1.5 rounded-lg hover:bg-pink-100 transition-colors text-gray-700">相談者ログイン</button>
              <button onClick={() => setLocation("/fortuneteller_login")} data-testid="button-fortuneteller-login"
                className="text-[11px] bg-pink-600 border border-pink-500 px-3 py-1.5 rounded-lg hover:bg-pink-700 transition-colors text-white">占い師ログイン</button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search"
            placeholder="占い師を検索..." className="w-full rounded-xl bg-pink-50 border border-pink-200 pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-pink-200 rounded-2xl p-4 animate-pulse">
              <div className="flex items-start gap-3"><div className="w-14 h-14 rounded-full bg-pink-100" /><div className="flex-1 space-y-2"><div className="h-4 bg-pink-100 rounded w-1/3" /><div className="h-3 bg-pink-100 rounded w-2/3" /></div></div>
            </div>
          ))}</div>
        ) : (
          <CardList advisors={filtered} onStartChat={(id) => setLocation("/querent_login")} onFav={() => {}} favorites={[]} emptyText="占い師が見つかりません" />
        )}
      </main>
    </div>
  );
}

export default function Top() {
  const { user, loading, refreshUser } = useAuth();
  const [, setLocation] = useLocation();

  const [plan, setPlan] = useState(() => storage.load("plan", "points"));
  const [points, setPoints] = useState(200);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(() => storage.load("favorites", []));
  const [threads, setThreads] = useState<ThreadsMap>({});
  const [activeTab, setActiveTab] = useState("home");
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<number | null>(() => storage.load("selectedAdvisorId", null));

  const { data: querentInfo = null } = useQuery<QuerentInfo>({
    queryKey: ["/api/get_querent_info"],
    enabled: !!user && user.role === "1",
  });

  useEffect(() => {
    if (querentInfo) {
      setPoints(querentInfo.point ?? 0);
      setSubscriptionActive(querentInfo.subscription ?? false);
      if (querentInfo.subscription) setPlan("subscription");
    }
  }, [querentInfo]);

  const { data: advisors = [], isLoading: loadingAdvisors } = useQuery<Advisor[]>({
    queryKey: ["/api/get_fortuneteller_all"],
  });

  const { data: unreadData } = useQuery<{ unread_count: number }>({
    queryKey: ["/api/unread_count"],
    enabled: !!user && user.role === "1",
    refetchInterval: 10000,
  });

  useEffect(() => storage.save("plan", plan), [plan]);
  useEffect(() => storage.save("favorites", favorites), [favorites]);
  useEffect(() => storage.save("selectedAdvisorId", selectedAdvisorId), [selectedAdvisorId]);

  const selectedAdvisor = useMemo(() => advisors.find((a) => a.id === selectedAdvisorId) || null, [selectedAdvisorId, advisors]);
  const startChat = (advisorId: number) => { setSelectedAdvisorId(advisorId); setActiveTab("chat"); };
  const toggleFavorite = (advisorId: number) => setFavorites((prev) => prev.includes(advisorId) ? prev.filter((id) => id !== advisorId) : [...prev, advisorId]);

  async function handleLogout() {
    await apiRequest("POST", "/api/logout", {});
    await refreshUser();
    setLocation("/");
  }

  if (loading) return <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center"><div className="text-gray-500">読み込み中...</div></div>;
  if (!user || user.role !== "1") return <LoggedOutView />;

  return (
    <div className="min-h-screen bg-[#fdf2f8] text-gray-900">
      <Header user={user} loading={loading} point={querentInfo?.point} subscriptionActive={querentInfo?.subscription} onGoPlan={() => setActiveTab("account")} onLogout={handleLogout} />
      <main className="px-4 pb-28">
        {activeTab === "home" && <HomeTab advisors={advisors} favorites={favorites} onFav={toggleFavorite} onStartChat={startChat} />}
        {activeTab === "advisors" && <Advisors advisorsFromTop={advisors} favorites={favorites} onFav={toggleFavorite} onStartChat={startChat} />}
        {activeTab === "chat" && <Chat plan={plan} points={points} setPoints={setPoints} subscriptionActive={subscriptionActive}
          advisor={selectedAdvisor} thread={selectedAdvisor ? threads[selectedAdvisor.id] : undefined} setThreads={setThreads} onBack={() => { setSelectedAdvisorId(null); }} querentInfo={querentInfo}
          advisors={advisors} onSelectAdvisor={startChat} />}
        {activeTab === "account" && <Account queInfoFromQuery={querentInfo} />}
      </main>
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} unreadCount={unreadData?.unread_count ?? 0} />
    </div>
  );
}
