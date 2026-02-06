import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Send, ChevronLeft, MessageCircle, LogOut, Users, Settings, Sparkles, CreditCard } from "lucide-react";

type Room = {
  id: string;
  querent_id: number;
  querent_name: string;
  last_message?: string;
  last_at?: string;
};

type Message = {
  id: string;
  sender: string;
  text: string;
  created_at: string;
  cost_pt?: number;
  is_locked?: boolean;
};

type Profile = {
  user_id: number;
  name: string;
  headline: string;
  intro: string;
  rank: string;
  profile_image: string;
  icon_image: string;
  is_recommended: boolean;
};

type BankInfo = {
  name: string;
  branch_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
};

function ChatView({ room, onBack }: { room: Room; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [msgCategory, setMsgCategory] = useState<"free" | "length_paying" | "healing">("free");
  const [healingPt, setHealingPt] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (!user) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws?room_id=${room.id}`);
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
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [room.id, user, scrollBottom]);

  function sendMessage() {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const payload: any = {
      type: "chat_message",
      sender: "fortuneteller",
      text: input.trim(),
      category: msgCategory,
    };
    if (msgCategory === "healing" && healingPt) {
      payload.point = parseInt(healingPt);
    }
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
    setHealingPt("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={onBack} className="text-white/70 hover:text-white" data-testid="button-back-rooms">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" data-testid="text-chat-querent">{room.querent_name}</div>
          <div className="text-[10px] text-white/50">{connected ? "接続中" : "接続中..."}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar" data-testid="container-ft-messages">
        {messages.length === 0 && (
          <div className="text-center text-white/40 text-sm pt-12">
            <MessageCircle className="w-8 h-8 mx-auto mb-3 text-fuchsia-400/50" />
            <p>メッセージはまだありません</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "fortuneteller" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
              m.sender === "fortuneteller"
                ? "bg-fuchsia-700/80 text-white rounded-br-md"
                : "bg-white/10 text-white/90 rounded-bl-md"
            }`} data-testid={`ft-message-${m.id}`}>
              {m.text}
              <div className="text-[10px] text-white/40 mt-1 text-right">
                {new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                {m.cost_pt ? ` (${m.cost_pt}pt)` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 bg-[#0d1a33]">
        <div className="flex items-center gap-1 px-3 pt-2">
          {(["free", "length_paying", "healing"] as const).map((cat) => (
            <button key={cat} onClick={() => setMsgCategory(cat)}
              data-testid={`button-category-${cat}`}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                msgCategory === cat
                  ? "bg-fuchsia-600 border-fuchsia-500 text-white"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
              }`}>
              {cat === "free" ? "無料" : cat === "length_paying" ? "文字課金" : "ヒーリング"}
            </button>
          ))}
          {msgCategory === "healing" && (
            <input type="number" value={healingPt} onChange={(e) => setHealingPt(e.target.value)} data-testid="input-healing-pt"
              placeholder="pt" className="w-16 text-[11px] rounded-lg bg-white/10 border border-white/20 px-2 py-1 text-center" />
          )}
        </div>
        <div className="flex items-center gap-2 p-3">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} data-testid="input-ft-message"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="メッセージを入力..."
            className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-fuchsia-400 focus:outline-none" />
          <button onClick={sendMessage} data-testid="button-ft-send"
            className="w-9 h-9 rounded-full bg-fuchsia-600 hover:bg-fuchsia-700 flex items-center justify-center transition-colors">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomList({ rooms, onSelect }: { rooms: Room[]; onSelect: (r: Room) => void }) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar" data-testid="container-rooms">
      {rooms.length === 0 ? (
        <div className="text-center text-white/40 text-sm pt-12">
          <Users className="w-8 h-8 mx-auto mb-3 text-fuchsia-400/50" />
          <p>相談者からのメッセージはまだありません</p>
        </div>
      ) : (
        rooms.map((r) => (
          <div key={r.id} onClick={() => onSelect(r)}
            className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
            data-testid={`room-${r.id}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {r.querent_name?.charAt(0) ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{r.querent_name}</div>
              {r.last_message && <div className="text-xs text-white/50 truncate">{r.last_message}</div>}
            </div>
            {r.last_at && (
              <div className="text-[10px] text-white/30 flex-shrink-0">
                {new Date(r.last_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ProfileSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/my_fortuneteller_profile"],
  });
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [intro, setIntro] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setHeadline(profile.headline);
      setIntro(profile.intro);
    }
  }, [profile]);

  async function save() {
    try {
      setSaving(true);
      await apiRequest("PATCH", "/api/my_fortuneteller_profile", { name, headline, intro });
      queryClient.invalidateQueries({ queryKey: ["/api/my_fortuneteller_profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <div className="text-sm font-bold text-white/80" data-testid="text-settings-title">プロフィール設定</div>
      <label className="block text-sm">
        <span className="text-white/60">占い師名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} data-testid="input-profile-name"
          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-400 focus:outline-none" />
      </label>
      <label className="block text-sm">
        <span className="text-white/60">キャッチコピー</span>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={30} data-testid="input-profile-headline"
          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-400 focus:outline-none" />
      </label>
      <label className="block text-sm">
        <span className="text-white/60">自己紹介</span>
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={5} data-testid="textarea-profile-intro"
          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-400 focus:outline-none resize-none" />
      </label>
      <button onClick={save} disabled={saving} data-testid="button-save-profile"
        className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50">
        {saving ? "保存中..." : saved ? "保存しました" : "保存する"}
      </button>
    </div>
  );
}

function BankSettings() {
  const { data: bank } = useQuery<BankInfo>({ queryKey: ["/api/my_bank_info"] });
  const queryClient = useQueryClient();
  const [fields, setFields] = useState({ name: "", branch_name: "", account_type: "普通", account_number: "", account_holder_name: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (bank) setFields({ name: bank.name || "", branch_name: bank.branch_name || "", account_type: bank.account_type || "普通", account_number: bank.account_number || "", account_holder_name: bank.account_holder_name || "" });
  }, [bank]);

  async function save() {
    try {
      setSaving(true);
      await apiRequest("PATCH", "/api/my_bank_info", fields);
      queryClient.invalidateQueries({ queryKey: ["/api/my_bank_info"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <div className="text-sm font-bold text-white/80" data-testid="text-bank-title">振込先口座設定</div>
      {[
        { label: "銀行名", key: "name" as const },
        { label: "支店名", key: "branch_name" as const },
        { label: "口座番号", key: "account_number" as const },
        { label: "口座名義", key: "account_holder_name" as const },
      ].map(({ label, key }) => (
        <label key={key} className="block text-sm">
          <span className="text-white/60">{label}</span>
          <input value={fields[key]} onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
            data-testid={`input-bank-${key}`}
            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-400 focus:outline-none" />
        </label>
      ))}
      <label className="block text-sm">
        <span className="text-white/60">口座種別</span>
        <select value={fields.account_type} onChange={(e) => setFields((p) => ({ ...p, account_type: e.target.value }))}
          data-testid="select-bank-type"
          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-fuchsia-400 focus:outline-none">
          <option value="普通" className="bg-gray-800">普通</option>
          <option value="当座" className="bg-gray-800">当座</option>
        </select>
      </label>
      <button onClick={save} disabled={saving} data-testid="button-save-bank"
        className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50">
        {saving ? "保存中..." : saved ? "保存しました" : "保存する"}
      </button>
    </div>
  );
}

export default function AdvisorApp() {
  const { user, loading, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"chat" | "profile" | "bank">("chat");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["/api/my_rooms"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== "2")) {
      setLocation("/fortuneteller_login");
    }
  }, [user, loading, setLocation]);

  async function handleLogout() {
    await apiRequest("POST", "/api/logout", {});
    await refreshUser();
    setLocation("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1a33] flex items-center justify-center">
        <div className="text-white/50 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0c1a33] text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d1a33]">
        <div className="text-sm font-bold" data-testid="text-advisor-app-title">
          <Sparkles className="w-4 h-4 inline-block mr-1 text-fuchsia-400" />
          占い師管理
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50 hidden sm:inline" data-testid="text-ft-email">{user?.email}</span>
          <button onClick={handleLogout} className="text-xs text-white/50 hover:text-white" data-testid="button-ft-logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {tab === "chat" && selectedRoom ? (
          <ChatView room={selectedRoom} onBack={() => setSelectedRoom(null)} />
        ) : tab === "chat" ? (
          <RoomList rooms={rooms ?? []} onSelect={setSelectedRoom} />
        ) : tab === "profile" ? (
          <ProfileSettings />
        ) : (
          <BankSettings />
        )}
      </div>

      <nav className="flex border-t border-white/10 bg-[#0d1a33]">
        {([
          { key: "chat" as const, icon: MessageCircle, label: "チャット" },
          { key: "profile" as const, icon: Settings, label: "プロフィール" },
          { key: "bank" as const, icon: CreditCard, label: "口座設定" },
        ]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => { setTab(key); setSelectedRoom(null); }}
            data-testid={`tab-${key}`}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
              tab === key ? "text-fuchsia-400" : "text-white/40 hover:text-white/60"
            }`}>
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
