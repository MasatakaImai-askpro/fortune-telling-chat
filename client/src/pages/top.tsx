import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Search, Star, Send, X, MessageCircle, LogOut, User, ChevronLeft, Sparkles } from "lucide-react";

type Advisor = {
  user_id: number;
  name: string;
  headline: string;
  intro: string;
  rank: string;
  profile_image: string;
  icon_image: string;
  is_recommended: boolean;
};

type Message = {
  id: string;
  sender: string;
  text: string;
  created_at: string;
  free: boolean;
  attachments: any[];
};

const RANK_COLORS: Record<string, string> = {
  PLATINUM: "bg-gradient-to-r from-cyan-400 to-blue-400 text-white",
  GOLD: "bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900",
  SILVER: "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900",
};

function RankBadge({ rank }: { rank: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RANK_COLORS[rank] ?? "bg-gray-600 text-white"}`}
      data-testid={`badge-rank-${rank}`}>
      {rank}
    </span>
  );
}

function AdvisorCard({ advisor, onSelect }: { advisor: Advisor; onSelect: (a: Advisor) => void }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 hover:bg-white/8 transition-colors cursor-pointer"
      onClick={() => onSelect(advisor)} data-testid={`card-advisor-${advisor.user_id}`}>
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-lg font-bold flex-shrink-0"
          data-testid={`avatar-advisor-${advisor.user_id}`}>
          {advisor.icon_image ? (
            <img src={advisor.icon_image} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            advisor.name.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate" data-testid={`text-advisor-name-${advisor.user_id}`}>{advisor.name}</span>
            <RankBadge rank={advisor.rank} />
            {advisor.is_recommended && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full" data-testid={`badge-recommended-${advisor.user_id}`}>
                おすすめ
              </span>
            )}
          </div>
          <p className="text-xs text-fuchsia-300/90 leading-relaxed" data-testid={`text-headline-${advisor.user_id}`}>{advisor.headline}</p>
          <p className="text-xs text-white/60 leading-relaxed line-clamp-2">{advisor.intro}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
          data-testid={`button-chat-${advisor.user_id}`}>
          <MessageCircle className="w-3.5 h-3.5" />
          <span>チャットする</span>
        </button>
      </div>
    </div>
  );
}

function ChatPanel({ advisor, onClose }: { advisor: Advisor; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (!user) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws?fortuneteller_id=${advisor.user_id}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "history" && data.messages) {
          setMessages(data.messages);
          setTimeout(scrollBottom, 50);
        } else if (data.type === "new_message" && data.message) {
          setMessages((prev) => [...prev, data.message]);
          setTimeout(scrollBottom, 50);
        } else if (data.type === "room_init") {
          // room assigned
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [advisor.user_id, user, scrollBottom]);

  function sendMessage() {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: "chat_message",
      sender: "querent",
      text: input.trim(),
      category: "free",
    }));
    setInput("");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c1a33]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0d1a33]">
        <button onClick={onClose} className="text-white/70 hover:text-white" data-testid="button-close-chat">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {advisor.icon_image ? (
            <img src={advisor.icon_image} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            advisor.name.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" data-testid="text-chat-advisor-name">{advisor.name}</div>
          <div className="text-[10px] text-white/50">{connected ? "接続中" : "接続中..."}</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar" data-testid="container-messages">
        {messages.length === 0 && (
          <div className="text-center text-white/40 text-sm pt-12" data-testid="text-no-messages">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-fuchsia-400/50" />
            <p>まだメッセージはありません</p>
            <p className="text-xs mt-1">最初のメッセージを送ってみましょう</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "querent" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
              m.sender === "querent"
                ? "bg-fuchsia-700/80 text-white rounded-br-md"
                : "bg-white/10 text-white/90 rounded-bl-md"
            }`} data-testid={`message-${m.id}`}>
              {m.text}
              <div className="text-[10px] text-white/40 mt-1 text-right">
                {new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-white/10 bg-[#0d1a33]">
        <div className="flex items-center gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} data-testid="input-chat-message"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="メッセージを入力..."
            className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-fuchsia-400 focus:outline-none" />
          <button onClick={sendMessage} data-testid="button-send-message"
            className="w-9 h-9 rounded-full bg-fuchsia-600 hover:bg-fuchsia-700 flex items-center justify-center transition-colors">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DMModal({ advisor, onClose, onSent }: { advisor: Advisor; onClose: () => void; onSent: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    if (!text.trim()) return;
    try {
      setSubmitting(true);
      await apiRequest("POST", "/api/send_dm", {
        fortuneteller_id: advisor.user_id,
        text: text.trim(),
      });
      onSent();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dm-modal-overlay" onClick={onClose}>
      <div className="dm-modal-content p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white" data-testid="text-dm-title">
            {advisor.name}さんにDM
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white" data-testid="button-close-dm"><X className="w-4 h-4" /></button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} data-testid="textarea-dm"
          className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:ring-2 focus:ring-fuchsia-400 focus:outline-none resize-none"
          placeholder="メッセージを入力..." />
        <button onClick={send} disabled={submitting || !text.trim()} data-testid="button-send-dm"
          className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "送信中..." : "送信する"}
        </button>
      </div>
    </div>
  );
}

export default function Top() {
  const { user, loading, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "recommended">("all");
  const [chatAdvisor, setChatAdvisor] = useState<Advisor | null>(null);
  const [dmAdvisor, setDmAdvisor] = useState<Advisor | null>(null);

  const { data: advisors, isLoading: advisorsLoading } = useQuery<Advisor[]>({
    queryKey: ["/api/get_fortuneteller_profiles"],
  });

  async function handleLogout() {
    await apiRequest("POST", "/api/logout", {});
    await refreshUser();
  }

  const filtered = (advisors ?? []).filter((a) => {
    const matchesSearch = !search || a.name.includes(search) || a.headline.includes(search) || a.intro.includes(search);
    const matchesTab = tab === "all" || a.is_recommended;
    return matchesSearch && matchesTab;
  });

  if (chatAdvisor) {
    return <ChatPanel advisor={chatAdvisor} onClose={() => setChatAdvisor(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#0c1a33] text-white">
      <header className="sticky top-0 z-30 bg-[#0d1a33] border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-bold tracking-wide" data-testid="text-app-title">
              <Sparkles className="w-5 h-5 inline-block mr-1 text-fuchsia-400" />
              占いチャット
            </div>
            <div className="flex items-center gap-2">
              {loading ? null : user ? (
                <>
                  <span className="text-xs text-white/60 hidden sm:inline" data-testid="text-user-email">{user.email}</span>
                  <button onClick={handleLogout} className="text-xs text-white/50 hover:text-white flex items-center gap-1" data-testid="button-logout">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setLocation("/querent_login")} data-testid="button-querent-login"
                    className="text-[11px] bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">
                    相談者ログイン
                  </button>
                  <button onClick={() => setLocation("/fortuneteller_login")} data-testid="button-fortuneteller-login"
                    className="text-[11px] bg-fuchsia-700/80 border border-fuchsia-600/50 px-3 py-1.5 rounded-lg hover:bg-fuchsia-700 transition-colors">
                    占い師ログイン
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search"
            placeholder="占い師を検索..."
            className="w-full rounded-xl bg-white/8 border border-white/15 pl-9 pr-3 py-2.5 text-sm placeholder:text-white/40 focus:ring-2 focus:ring-fuchsia-400 focus:outline-none" />
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab("all")} data-testid="button-tab-all"
            className={`tab-label ${tab === "all" ? "tab-selected" : ""}`}>
            全ての占い師
          </button>
          <button onClick={() => setTab("recommended")} data-testid="button-tab-recommended"
            className={`tab-label ${tab === "recommended" ? "tab-selected" : ""}`}>
            <Star className="w-3.5 h-3.5 inline-block mr-1" />おすすめ
          </button>
        </div>

        {advisorsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                    <div className="h-3 bg-white/10 rounded w-2/3" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/40 py-12" data-testid="text-no-advisors">
            <User className="w-10 h-10 mx-auto mb-3 text-white/20" />
            <p className="text-sm">占い師が見つかりません</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="container-advisors">
            {filtered.map((a) => (
              <AdvisorCard key={a.user_id} advisor={a} onSelect={(adv) => {
                if (user) {
                  setChatAdvisor(adv);
                } else {
                  setLocation("/querent_login");
                }
              }} />
            ))}
          </div>
        )}
      </main>

      {dmAdvisor && (
        <DMModal advisor={dmAdvisor} onClose={() => setDmAdvisor(null)} onSent={() => setDmAdvisor(null)} />
      )}
    </div>
  );
}
