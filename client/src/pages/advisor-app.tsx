import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Send, ChevronLeft, MessageCircle, LogOut, Users, Settings, Sparkles, CreditCard, CheckSquare, Square, Search, Clock, CalendarOff, Image, UserCircle, Upload, AlertCircle, Banknote, ArrowDownToLine } from "lucide-react";

type Room = {
  id: string;
  querent_id: number;
  querent_name: string;
  fortuneteller_id: number;
  fortuneteller_name: string;
  last_message?: string;
  last_at?: string;
  unread_count?: number;
};

type Message = {
  id: string;
  sender: string;
  text: string | null;
  title?: string | null;
  category?: string;
  created_at: string;
  cost_pt?: number;
  is_locked?: boolean;
  free?: boolean;
};

type Profile = {
  user_id: number;
  name: string;
  headline: string;
  intro: string;
  rank: string;
  rank_label?: string;
  profile_image: string;
  icon_image: string;
  is_recommended: boolean;
  style: string;
  divination_methods: string[];
  regular_holidays: string;
  business_hours: string;
  long_intro: string;
  free_note: string;
};

type BankInfo = {
  name: string;
  branch_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
};

type Querent = {
  user_id: number;
  name: string;
  zodiac_sign: string;
  worry_category: string;
  worry_message: string;
  birthdate: string;
  points: number;
  is_subscription: boolean;
};

const FULLWIDTH_REGEX = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFF9F\u2000-\u206F\s\n\r、。！？「」『』（）・ー〜…―]+$/;
const isValidJapaneseText = (text: string) => text.trim() === "" || FULLWIDTH_REGEX.test(text);

function getBubbleColor(m: Message): string {
  if (m.sender === "fortuneteller") {
    if (m.category === "treatment") return "bg-amber-100 text-amber-900 rounded-br-md";
    if (m.category === "length_paying") return "bg-pink-100 text-pink-900 rounded-br-md";
    return "bg-emerald-100 text-emerald-900 rounded-br-md";
  }
  if (m.free || m.category === "free") return "bg-emerald-50 text-emerald-800 rounded-bl-md";
  if (m.category === "treatment") return "bg-amber-50 text-amber-800 rounded-bl-md";
  return "bg-gray-100 text-gray-800 rounded-bl-md";
}

function ChatView({ room, onBack }: { room: Room; onBack: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [treatmentTitle, setTreatmentTitle] = useState("");
  const [treatmentPt, setTreatmentPt] = useState<number>(1000);
  const [connected, setConnected] = useState(false);
  const [msgCategory, setMsgCategory] = useState<"free" | "length_paying" | "treatment">("free");
  const [inputError, setInputError] = useState("");
  const [unlockNotification, setUnlockNotification] = useState<number | null>(null);
  const [showAdvisorTemplates, setShowAdvisorTemplates] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: advisorTemplates = [] } = useQuery<AdvisorTemplate[]>({ queryKey: ["/api/my_templates"] });
  const { data: advisorMenus = [] } = useQuery<AdvisorMenu[]>({ queryKey: ["/api/my_menus"] });
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    apiRequest("POST", `/api/rooms/${room.id}/mark_read`, {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/unread_count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my_rooms"] });
    }).catch(() => {});
  }, [room.id, queryClient]);

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
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "mark_read" }));
          }
        } else if (data.type === "new_message" && data.message) {
          setMessages((prev) => [...prev, data.message]);
          if (data.message.subscription_bonus && data.message.sender === "fortuneteller") {
            alert(`サブスク会員への初回対応ボーナス: +${data.message.subscription_bonus}pt を獲得しました！`);
            queryClient.invalidateQueries({ queryKey: ["/api/my_cashable"] });
          }
          setTimeout(scrollBottom, 50);
        } else if (data.type === "message_unlocked") {
          setMessages((prev) => prev.map((m) => m.id === data.message_id ? { ...m, is_locked: false } : m));
          setUnlockNotification(data.cost_pt ?? 0);
          setTimeout(() => setUnlockNotification(null), 3000);
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [room.id, user, scrollBottom]);

  function handleInputChange(value: string) {
    setInput(value);
    if (value && !isValidJapaneseText(value)) {
      setInputError("全角ひらがな・カタカナ・漢字のみ入力可能です");
    } else {
      setInputError("");
    }
  }

  function handleTitleChange(value: string) {
    if (value && !isValidJapaneseText(value)) return;
    setTreatmentTitle(value);
  }

  function sendMessage() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (msgCategory === "treatment") {
      if (treatmentPt <= 0) return;
      const payload: any = {
        type: "chat_message",
        sender: "fortuneteller",
        text: null,
        category: "treatment",
        title: treatmentTitle.trim() || null,
        cost_pt: treatmentPt,
      };
      wsRef.current.send(JSON.stringify(payload));
      setTreatmentTitle("");
      setTreatmentPt(1000);
      return;
    }
    if (!input.trim()) return;
    if (!isValidJapaneseText(input.trim())) {
      setInputError("全角ひらがな・カタカナ・漢字のみ入力可能です");
      return;
    }
    const payload: any = {
      type: "chat_message",
      sender: "fortuneteller",
      text: input.trim(),
      category: msgCategory,
    };
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
    setInputError("");
  }

  return (
    <div className="flex flex-col h-full relative">
      {unlockNotification !== null && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-bounce">
          🔓 相談者がメッセージをアンロックしました (+{unlockNotification}pt)
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-pink-200">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800" data-testid="button-back-rooms">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate text-gray-900" data-testid="text-chat-querent">{room.querent_name}</div>
          <div className="text-[10px] text-gray-400">{connected ? "接続中" : "接続中..."}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-pink-50/50" data-testid="container-ft-messages">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-12">
            <MessageCircle className="w-8 h-8 mx-auto mb-3 text-pink-300" />
            <p>メッセージはまだありません</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "fortuneteller" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${getBubbleColor(m)}`} data-testid={`ft-message-${m.id}`}>
              {m.category === "treatment" && m.title && (
                <div className="text-[11px] font-bold mb-1 border-b border-gray-300 pb-1" data-testid={`ft-msg-title-${m.id}`}>
                  {m.title}
                </div>
              )}
              {m.is_locked ? (
                <div className="text-xs italic text-gray-500">[施術 - 開封待ち: {m.cost_pt ?? 0}pt]</div>
              ) : (
                m.text
              )}
              <div className="text-[10px] text-gray-400 mt-1 text-right">
                {new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                {m.cost_pt ? ` (${m.cost_pt}pt)` : ""}
                {m.category === "treatment" && " [施術]"}
                {m.category === "length_paying" && " [有料]"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-pink-200 bg-white">
        <div className="flex items-center gap-1 px-3 pt-2">
          {(["free", "length_paying", "treatment"] as const).map((cat) => (
            <button key={cat} onClick={() => setMsgCategory(cat)}
              data-testid={`button-category-${cat}`}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                msgCategory === cat
                  ? cat === "treatment" ? "bg-amber-600 border-amber-500 text-white" : "bg-pink-600 border-pink-500 text-white"
                  : "bg-pink-50 border-pink-200 text-gray-500 hover:text-gray-700"
              }`}>
              {cat === "free" ? "無料" : cat === "length_paying" ? "文字課金" : "施術"}
            </button>
          ))}
        </div>
        {msgCategory === "treatment" ? (
          <div className="px-3 pt-2 pb-3 space-y-2">
            {advisorMenus.length > 0 ? (
              <>
                <div className="text-[10px] text-gray-500 font-semibold">メニューから選択</div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {["treatment", "divination"].map((menuType) => {
                    const typeMenus = advisorMenus.filter((m) => m.menu_type === menuType);
                    if (typeMenus.length === 0) return null;
                    return (
                      <div key={menuType}>
                        <div className="text-[9px] text-gray-400 mb-0.5">{menuType === "treatment" ? "施術" : "鑑定"}</div>
                        <div className="flex flex-wrap gap-1">
                          {typeMenus.map((m) => (
                            <button key={m.id} onClick={() => { setTreatmentTitle(m.name); setTreatmentPt(m.required_pt); }}
                              className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${treatmentPt === m.required_pt && treatmentTitle === m.name ? "bg-amber-500 border-amber-400 text-white" : "bg-pink-50 border-pink-200 text-gray-700 hover:bg-amber-50"}`}>
                              {m.name} ({m.required_pt.toLocaleString()}pt)
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[10px] text-gray-400">または手動入力</div>
              </>
            ) : (
              <div className="text-[10px] text-gray-400">メニューは「プロフィール→メニュー」から設定できます</div>
            )}
            <input type="text" value={treatmentTitle} onChange={(e) => handleTitleChange(e.target.value)} data-testid="input-treatment-title"
              placeholder="施術・鑑定タイトル（任意）" maxLength={100}
              className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-amber-400 focus:outline-none" />
            <div className="grid grid-cols-3 gap-1.5">
              {[500, 1000, 2000, 3000, 5000, 10000].map((pt) => (
                <button key={pt} onClick={() => setTreatmentPt(pt)} data-testid={`button-treatment-pt-${pt}`}
                  className={`rounded-xl py-1.5 text-xs font-semibold border transition-colors ${treatmentPt === pt && !advisorMenus.some((m) => m.required_pt === pt && m.name === treatmentTitle) ? "bg-amber-500 border-amber-400 text-white" : "bg-pink-50 border-pink-200 text-gray-700 hover:bg-amber-50"}`}>
                  {pt.toLocaleString()}pt
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-amber-600 font-semibold" data-testid="text-treatment-cost">
                {treatmentTitle ? <span>{treatmentTitle}: </span> : null}<b>{treatmentPt.toLocaleString()}pt</b>
              </div>
              <button onClick={sendMessage} data-testid="button-ft-send-treatment"
                disabled={treatmentPt <= 0}
                className="rounded-xl px-4 py-1.5 text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <Send className="w-3 h-3" /> 送信
              </button>
            </div>
          </div>
        ) : (
          <>
            {showAdvisorTemplates && advisorTemplates.length > 0 && (
              <div className="px-3 pt-2 pb-1 border-t border-pink-100 max-h-32 overflow-y-auto">
                <div className="text-[10px] text-gray-500 mb-1 font-semibold">テンプレートから選択</div>
                <div className="space-y-1">
                  {advisorTemplates.map((t) => (
                    <button key={t.id} onClick={() => { setInput(t.text); setShowAdvisorTemplates(false); }}
                      className="w-full text-left text-xs px-2 py-1.5 rounded-lg bg-pink-50 border border-pink-200 text-gray-800 hover:bg-pink-100 transition-colors truncate">
                      {t.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inputError && <div className="text-[10px] text-red-600 px-3 pt-1" data-testid="text-ft-input-error">{inputError}</div>}
            <div className="flex items-center gap-2 p-3">
              {advisorTemplates.length > 0 && (
                <button onClick={() => setShowAdvisorTemplates((v) => !v)} data-testid="button-ft-show-templates"
                  title="テンプレート"
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border transition-colors flex-shrink-0 ${showAdvisorTemplates ? "bg-pink-600 border-pink-500 text-white" : "bg-pink-50 border-pink-200 text-gray-500"}`}>
                  📝
                </button>
              )}
              <input type="text" value={input} onChange={(e) => handleInputChange(e.target.value)} data-testid="input-ft-message"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="メッセージを入力..."
                className="flex-1 rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
              <button onClick={sendMessage} data-testid="button-ft-send"
                disabled={!!inputError || !input.trim()}
                className="w-9 h-9 rounded-full bg-pink-600 flex items-center justify-center transition-colors disabled:opacity-50 hover-elevate active-elevate-2">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RoomList({ rooms, onSelect }: { rooms: Room[]; onSelect: (r: Room) => void }) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar" data-testid="container-rooms">
      {rooms.length === 0 ? (
        <div className="text-center text-gray-400 text-sm pt-12">
          <Users className="w-8 h-8 mx-auto mb-3 text-pink-300" />
          <p>相談者からのメッセージはまだありません</p>
        </div>
      ) : (
        rooms.map((r) => (
          <div key={r.id} onClick={() => onSelect(r)}
            className="flex items-center gap-3 px-4 py-3 border-b border-pink-100 hover:bg-pink-50 cursor-pointer transition-colors"
            data-testid={`room-${r.id}`}>
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {r.querent_name?.charAt(0) ?? "?"}
              {(r.unread_count ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid={`badge-unread-room-${r.id}`}>
                  {r.unread_count}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-gray-900">{r.querent_name}</div>
              {r.last_message && <div className="text-xs text-gray-500 truncate">{r.last_message}</div>}
            </div>
            {r.last_at && (
              <div className="text-[10px] text-gray-400 flex-shrink-0">
                {new Date(r.last_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const STYLE_OPTIONS = ["優しく回答", "じっくり聞きます", "即対応いたします", "ハッキリ回答", "リードします", "寄り添います", "明るく、元気に"];
const METHOD_OPTIONS = ["タロット・オラクルカード", "四柱推命", "霊視・霊聴・オーラ", "手相", "占星術", "九星気学", "チャネリング", "ツインレイ鑑定", "カウンセリング", "その他"];

function ProfileSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/my_fortuneteller_profile"],
  });
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [intro, setIntro] = useState("");
  const [style, setStyle] = useState("");
  const [divinationMethods, setDivinationMethods] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState("");
  const [iconImage, setIconImage] = useState("");
  const [regularHolidays, setRegularHolidays] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [longIntro, setLongIntro] = useState("");
  const [freeNote, setFreeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [iconError, setIconError] = useState("");
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setHeadline(profile.headline);
      setIntro(profile.intro);
      setStyle(profile.style || "");
      setDivinationMethods(profile.divination_methods || []);
      setProfileImage(profile.profile_image || "");
      setIconImage(profile.icon_image || "");
      setRegularHolidays(profile.regular_holidays || "");
      setBusinessHours(profile.business_hours || "");
      setLongIntro(profile.long_intro || "");
      setFreeNote(profile.free_note || "");
    }
  }, [profile]);

  function toggleMethod(m: string) {
    setDivinationMethods((prev) =>
      prev.includes(m) ? prev.filter((v) => v !== m) : [...prev, m]
    );
  }

  async function uploadImage(file: File, type: "icon" | "banner") {
    const setUploading = type === "icon" ? setUploadingIcon : setUploadingBanner;
    const setError = type === "icon" ? setIconError : setBannerError;
    const setImage = type === "icon" ? setIconImage : setProfileImage;
    setError("");

    const maxSize = type === "icon" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(type === "icon" ? "2MB以下の画像を選択してください" : "5MB以下の画像を選択してください");
      return;
    }

    const img = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    URL.revokeObjectURL(objectUrl);

    if (w === 0 || h === 0) {
      setError("画像を読み込めませんでした");
      return;
    }

    const ratio = w / h;
    if (type === "icon" && (ratio < 0.9 || ratio > 1.1)) {
      setError(`正方形（1:1）の画像を使用してください（現在: ${ratio.toFixed(2)}）`);
      return;
    }
    if (type === "banner" && (ratio < 1.5 || ratio > 2.0)) {
      setError(`横長（16:9〜2:1）の画像を使用してください（現在: ${ratio.toFixed(2)}）`);
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      const resp = await fetch("/api/upload_image", { method: "POST", body: formData, credentials: "include" });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "アップロードに失敗しました");
        return;
      }
      setImage(data.url);
    } catch (e: any) {
      setError(e.message || "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      await apiRequest("PATCH", "/api/my_fortuneteller_profile", {
        name, headline, intro, style, divination_methods: divinationMethods,
        profile_image: profileImage, icon_image: iconImage,
        regular_holidays: regularHolidays, business_hours: businessHours, long_intro: longIntro,
        free_note: freeNote,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my_fortuneteller_profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/get_fortuneteller_all"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="text-sm font-bold text-gray-800" data-testid="text-settings-title">プロフィール設定</div>
      <div className="space-y-2">
        <span className="text-gray-600 text-sm flex items-center gap-1.5"><Image className="w-3.5 h-3.5" />バナー画像</span>
        {profileImage && <img src={profileImage} alt="" className="w-full h-24 object-cover rounded-xl border border-pink-200" data-testid="img-profile-banner-preview" />}
        {!profileImage && <div className="w-full h-24 rounded-xl border border-pink-200 bg-pink-50 flex items-center justify-center text-xs text-gray-400">バナー未設定</div>}
        <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <span>🔒</span> 画像は管理者のみ変更可能です
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-gray-600 text-sm flex items-center gap-1.5"><UserCircle className="w-3.5 h-3.5" />アイコン画像</span>
        {iconImage
          ? <img src={iconImage} alt="" className="w-14 h-14 object-cover rounded-full border border-pink-200" data-testid="img-profile-icon-preview" />
          : <div className="w-14 h-14 rounded-full border border-pink-200 bg-pink-50 flex items-center justify-center text-xs text-gray-400">未設定</div>}
        <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <span>🔒</span> 画像は管理者のみ変更可能です
        </div>
      </div>
      <label className="block text-sm">
        <span className="text-gray-600">占い師名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} data-testid="input-profile-name"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">キャッチコピー</span>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={30} data-testid="input-profile-headline"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">自己紹介（短文）</span>
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} data-testid="textarea-profile-intro"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-none" />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">紹介文（詳細ページ用・10,000文字以内）</span>
        <textarea value={longIntro} onChange={(e) => { if (e.target.value.length <= 10000) setLongIntro(e.target.value); }} rows={8} data-testid="textarea-profile-long-intro"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-y" />
        <span className="text-[11px] text-gray-400 mt-1 block">{longIntro.length.toLocaleString()} / 10,000文字</span>
      </label>
      <label className="block text-sm">
        <span className="text-gray-600">フリーメモ（3,000文字以内・相談者には非公開）</span>
        <textarea value={freeNote} onChange={(e) => { if (e.target.value.length <= 3000) setFreeNote(e.target.value); }} rows={5} data-testid="textarea-profile-free-note"
          placeholder="自分用のメモや備考など自由に記入できます"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-y" />
        <span className="text-[11px] text-gray-400 mt-1 block">{freeNote.length.toLocaleString()} / 3,000文字</span>
      </label>
      <label className="block text-sm">
        <span className="text-gray-600 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />営業時間</span>
        <input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} maxLength={100} placeholder="例: 10:00〜22:00" data-testid="input-profile-hours"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
      </label>
      <label className="block text-sm">
        <span className="text-gray-600 flex items-center gap-1.5"><CalendarOff className="w-3.5 h-3.5" />定休日</span>
        <input value={regularHolidays} onChange={(e) => setRegularHolidays(e.target.value)} maxLength={100} placeholder="例: 毎週水曜日" data-testid="input-profile-holidays"
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
      </label>
      <div className="space-y-1.5">
        <span className="text-gray-600 text-xs">スタイル</span>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              data-testid={`button-style-${s}`}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                style === s
                  ? "bg-purple-100 border-purple-300 text-purple-700"
                  : "bg-pink-50 border-pink-200 text-gray-600 hover:text-gray-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-gray-600 text-xs">占術（複数選択可）</span>
        <div className="flex flex-wrap gap-2">
          {METHOD_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              data-testid={`button-method-${m}`}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                divinationMethods.includes(m)
                  ? "bg-cyan-100 border-cyan-300 text-cyan-700"
                  : "bg-pink-50 border-pink-200 text-gray-600 hover:text-gray-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={saving} data-testid="button-save-profile"
        className="w-full py-2 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50">
        {saving ? "保存中..." : saved ? "保存しました" : "保存する"}
      </button>
    </div>
  );
}

type AdvisorMenu = { id: number; menu_type: "treatment" | "divination"; name: string; required_pt: number; sort_order: number };
type AdvisorTemplate = { id: number; text: string; sort_order: number };

function MenuSettings() {
  const queryClient = useQueryClient();
  const { data: menus = [], isLoading } = useQuery<AdvisorMenu[]>({ queryKey: ["/api/my_menus"] });
  const [newType, setNewType] = useState<"treatment" | "divination">("treatment");
  const [newName, setNewName] = useState("");
  const [newPt, setNewPt] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPt, setEditPt] = useState("");
  const [saving, setSaving] = useState(false);

  async function addMenu() {
    if (!newName.trim() || !newPt) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/my_menus", { menu_type: newType, name: newName.trim(), required_pt: parseInt(newPt) });
      queryClient.invalidateQueries({ queryKey: ["/api/my_menus"] });
      setNewName(""); setNewPt("");
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/my_menus/${id}`, { name: editName.trim(), required_pt: parseInt(editPt) });
      queryClient.invalidateQueries({ queryKey: ["/api/my_menus"] });
      setEditId(null);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function deleteMenu(id: number) {
    await apiRequest("DELETE", `/api/my_menus/${id}`, {});
    queryClient.invalidateQueries({ queryKey: ["/api/my_menus"] });
  }

  if (isLoading) return <div className="text-gray-400 text-sm py-4">読み込み中...</div>;

  return (
    <div className="space-y-4 pt-3">
      <div className="text-sm font-bold text-gray-800">メニュー設定</div>
      <div className="bg-white border border-pink-200 rounded-2xl p-4 space-y-3">
        <div className="text-xs text-gray-500 font-semibold">新しいメニューを追加</div>
        <div className="space-y-2">
          <select value={newType} onChange={(e) => setNewType(e.target.value as any)}
            className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-400">
            <option value="treatment">施術メニュー</option>
            <option value="divination">鑑定メニュー</option>
          </select>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="メニュー名（例: タロット鑑定）" maxLength={50}
            className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-400" />
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-600 flex-shrink-0">必要ポイント</label>
            <input value={newPt} onChange={(e) => setNewPt(e.target.value.replace(/\D/g, ""))} placeholder="例: 1000" maxLength={6}
              className="flex-1 rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-400" />
            <span className="text-xs text-gray-500 flex-shrink-0">pt</span>
          </div>
          <button onClick={addMenu} disabled={saving || !newName.trim() || !newPt}
            className="w-full rounded-xl py-2.5 text-sm font-semibold bg-pink-600 text-white disabled:opacity-50 transition-colors hover:bg-pink-700">
            {saving ? "追加中..." : "メニューを追加"}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {["treatment", "divination"].map((type) => {
          const typedMenus = menus.filter((m) => m.menu_type === type);
          return (
            <div key={type}>
              <div className="text-xs font-semibold text-gray-600 mb-1">{type === "treatment" ? "🌟 施術メニュー" : "🔮 鑑定メニュー"}</div>
              {typedMenus.length === 0 && <div className="text-xs text-gray-400 pl-2">メニューがありません</div>}
              {typedMenus.map((m) => (
                <div key={m.id} className="bg-white border border-pink-200 rounded-xl p-2.5 mb-1.5">
                  {editId === m.id ? (
                    <div className="space-y-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50}
                        placeholder="メニュー名" className="w-full rounded-lg bg-pink-50 border border-pink-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-pink-400" />
                      <div className="flex items-center gap-2">
                        <input value={editPt} onChange={(e) => setEditPt(e.target.value.replace(/\D/g, ""))} maxLength={6}
                          placeholder="ポイント数" className="flex-1 rounded-lg bg-pink-50 border border-pink-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-pink-400" />
                        <span className="text-xs text-gray-500 flex-shrink-0">pt</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(m.id)} disabled={saving}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-500 text-white font-semibold disabled:opacity-50">
                          {saving ? "保存中..." : "保存"}
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-700">取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-xs text-gray-900">{m.name}</span>
                      <span className="text-xs text-pink-600 font-semibold">{m.required_pt.toLocaleString()}pt</span>
                      <button onClick={() => { setEditId(m.id); setEditName(m.name); setEditPt(m.required_pt.toString()); }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-pink-50 border border-pink-200 text-gray-600">編集</button>
                      <button onClick={() => deleteMenu(m.id)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600">削除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemplateSettings() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useQuery<AdvisorTemplate[]>({ queryKey: ["/api/my_templates"] });
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  async function addTemplate() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/my_templates", { text: newText.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/my_templates"] });
      setNewText("");
    } catch (e: any) { alert(e.message || "追加に失敗しました"); } finally { setSaving(false); }
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/my_templates/${id}`, { text: editText.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/my_templates"] });
      setEditId(null);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function deleteTemplate(id: number) {
    await apiRequest("DELETE", `/api/my_templates/${id}`, {});
    queryClient.invalidateQueries({ queryKey: ["/api/my_templates"] });
  }

  async function moveUp(idx: number) {
    if (idx === 0) return;
    const newIds = templates.map((t) => t.id);
    [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
    await apiRequest("POST", "/api/my_templates/reorder", { ids: newIds });
    queryClient.invalidateQueries({ queryKey: ["/api/my_templates"] });
  }

  async function moveDown(idx: number) {
    if (idx === templates.length - 1) return;
    const newIds = templates.map((t) => t.id);
    [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
    await apiRequest("POST", "/api/my_templates/reorder", { ids: newIds });
    queryClient.invalidateQueries({ queryKey: ["/api/my_templates"] });
  }

  if (isLoading) return <div className="text-gray-400 text-sm py-4">読み込み中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-gray-800">テンプレート管理</div>
        <div className="text-xs text-gray-400">{templates.length}/100件</div>
      </div>
      <div className="bg-white border border-pink-200 rounded-2xl p-3 space-y-2">
        <textarea value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="テンプレートのテキストを入力（最大500文字）" maxLength={500} rows={2}
          className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-xs text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-pink-400" />
        <button onClick={addTemplate} disabled={saving || !newText.trim() || templates.length >= 100}
          className="w-full rounded-xl py-1.5 text-xs font-semibold bg-pink-600 text-white disabled:opacity-50">追加する</button>
      </div>
      <div className="space-y-1.5">
        {templates.map((t, idx) => (
          <div key={t.id} className="bg-white border border-pink-200 rounded-xl p-2.5 space-y-1.5">
            {editId === t.id ? (
              <div className="space-y-1.5">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={500} rows={2}
                  className="w-full rounded-lg bg-pink-50 border border-pink-200 px-2 py-1.5 text-xs resize-none focus:outline-none" />
                <div className="flex gap-1.5">
                  <button onClick={() => saveEdit(t.id)} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500 text-white">保存</button>
                  <button onClick={() => setEditId(null)} className="text-xs px-2.5 py-1 rounded-lg bg-gray-200 text-gray-700">取消</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} className="text-gray-400 disabled:opacity-30 hover:text-pink-600 text-[10px] leading-none">▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === templates.length - 1} className="text-gray-400 disabled:opacity-30 hover:text-pink-600 text-[10px] leading-none">▼</button>
                </div>
                <p className="flex-1 text-xs text-gray-800 leading-relaxed">{t.text}</p>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditId(t.id); setEditText(t.text); }}
                    className="text-[10px] px-2 py-1 rounded-lg bg-pink-50 border border-pink-200 text-gray-600">編集</button>
                  <button onClick={() => deleteTemplate(t.id)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600">削除</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {templates.length === 0 && <div className="text-xs text-gray-400 text-center py-4">テンプレートがありません</div>}
      </div>
    </div>
  );
}

const worryCategoryLabel: Record<string, string> = {
  love: "恋愛", work: "仕事", money: "金運", health: "健康", human: "人間関係", other: "その他",
};

const QUERENT_FILTERS = [
  { value: "all", label: "全員" },
  { value: "new", label: "新規" },
  { value: "revisit", label: "再訪問" },
  { value: "past", label: "過去のお客様" },
  { value: "dig", label: "掘り起こし" },
  { value: "unread", label: "開封済み" },
  { value: "login30", label: "ログイン30分以内" },
  { value: "subscriber", label: "サブスク会員" },
];

function QuerentListView() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { data: querents, isLoading } = useQuery<Querent[]>({
    queryKey: ["/api/all_querents", filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/all_querents?filter=${filterStatus}`, { credentials: "include" });
      if (!res.ok) throw new Error("取得失敗");
      return res.json();
    },
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = (querents ?? []).filter((q) => {
    return !searchTerm || q.name.includes(searchTerm) || q.worry_message.includes(searchTerm);
  });

  function toggleSelect(userId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((q) => q.user_id)));
    }
  }

  async function handleSend() {
    if (selected.size === 0 || !messageText.trim()) return;
    try {
      setSending(true);
      await apiRequest("POST", "/api/send_bulk_message", {
        querent_ids: Array.from(selected),
        text: messageText.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my_rooms"] });
      setSent(true);
      setMessageText("");
      setSelected(new Set());
      setTimeout(() => setSent(false), 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-pink-200">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="名前・お悩みで検索..."
              data-testid="input-querent-search"
              className="w-full rounded-xl bg-pink-50 border border-pink-200 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
          {QUERENT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilterStatus(f.value); setSelected(new Set()); }}
              data-testid={`filter-${f.value}`}
              className={`text-[11px] px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                filterStatus === f.value
                  ? "bg-pink-600 border-pink-500 text-white"
                  : "bg-pink-50 border-pink-200 text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <button onClick={toggleSelectAll} className="flex items-center gap-1 hover:text-gray-700 transition-colors" data-testid="button-select-all">
            {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 text-pink-600" /> : <Square className="w-4 h-4" />}
            <span>{selected.size === filtered.length && filtered.length > 0 ? "全解除" : "全選択"}</span>
          </button>
          <span data-testid="text-selected-count">{selected.size}名選択中 / {filtered.length}名</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" data-testid="container-querent-list">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 text-sm pt-12">
            <Users className="w-8 h-8 mx-auto mb-3 text-pink-300" />
            <p>該当する相談者がいません</p>
          </div>
        ) : (
          filtered.map((q) => (
            <div
              key={q.user_id}
              onClick={() => toggleSelect(q.user_id)}
              className={`flex items-start gap-3 px-4 py-3 border-b border-pink-100 cursor-pointer transition-colors ${
                selected.has(q.user_id) ? "bg-pink-50" : "hover:bg-pink-50/50"
              }`}
              data-testid={`querent-row-${q.user_id}`}
            >
              <div className="pt-0.5">
                {selected.has(q.user_id) ? (
                  <CheckSquare className="w-5 h-5 text-pink-600" />
                ) : (
                  <Square className="w-5 h-5 text-gray-300" />
                )}
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {q.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900" data-testid={`text-querent-name-${q.user_id}`}>{q.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">{q.zodiac_sign}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-800">
                    {worryCategoryLabel[q.worry_category] || q.worry_category}
                  </span>
                  {q.is_subscription && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800" data-testid={`badge-sub-${q.user_id}`}>
                      サブスク
                    </span>
                  )}
                </div>
                {q.worry_message && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate" data-testid={`text-querent-worry-${q.user_id}`}>{q.worry_message}</div>
                )}
                <div className="text-[10px] text-gray-400 mt-0.5">
                  生年月日: {q.birthdate} / {q.points}pt
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {(selected.size > 0 || sent) && (
        <div className="border-t border-pink-200 bg-white p-3 space-y-2">
          {sent && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2" data-testid="text-sent-success">
              メッセージを送信しました
            </div>
          )}
          {selected.size > 0 && (
            <>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{selected.size}名に送信</span>
                <span className="ml-auto">{messageText.length}/150</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => { if (e.target.value.length <= 150) setMessageText(e.target.value); }}
                  placeholder="メッセージを入力（150文字以内）..."
                  data-testid="input-bulk-message"
                  className="flex-1 rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !messageText.trim()}
                  data-testid="button-send-bulk"
                  className="w-9 h-9 rounded-full bg-pink-600 hover:bg-pink-700 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type CashableInfo = {
  total_revenue: number;
  rank: string;
  rank_label: string;
  total_cashable: number;
  withdrawn: number;
  available_points: number;
  yen_amount: number;
  transfer_fee: number;
  net_amount: number;
};

type WithdrawalRecord = {
  id: number;
  amount: number;
  yen_amount: number;
  transfer_fee: number;
  net_amount: number;
  status: string;
  requested_at: string;
  approved_at: string | null;
  scheduled_transfer_date: string | null;
  transferred_at: string | null;
};

function WithdrawalTab() {
  const queryClient = useQueryClient();
  const { data: bank } = useQuery<BankInfo>({ queryKey: ["/api/my_bank_info"] });
  const { data: cashable } = useQuery<CashableInfo>({ queryKey: ["/api/my_cashable"] });
  const { data: withdrawals } = useQuery<WithdrawalRecord[]>({ queryKey: ["/api/my_withdrawals"] });

  const [fields, setFields] = useState({ name: "", branch_name: "", account_type: "普通", account_number: "", account_holder_name: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    if (bank) setFields({ name: bank.name || "", branch_name: bank.branch_name || "", account_type: bank.account_type || "普通", account_number: bank.account_number || "", account_holder_name: bank.account_holder_name || "" });
  }, [bank]);

  async function saveBank() {
    try {
      setSaving(true);
      await apiRequest("PATCH", "/api/my_bank_info", fields);
      queryClient.invalidateQueries({ queryKey: ["/api/my_bank_info"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function applyWithdrawal() {
    try {
      setApplying(true);
      setApplyError("");
      await apiRequest("POST", "/api/apply_withdrawal", {});
      queryClient.invalidateQueries({ queryKey: ["/api/my_cashable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my_withdrawals"] });
      setShowConfirm(false);
      alert("振込申請を受け付けました");
    } catch (e: any) {
      const msg = e?.message || "申請に失敗しました";
      setApplyError(msg);
    } finally {
      setApplying(false);
    }
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending": return "申請中";
      case "approved": return "承認済";
      case "transferred": return "振込完了";
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "approved": return "bg-blue-100 text-blue-700";
      case "transferred": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const bankComplete = fields.name && fields.account_number && fields.account_holder_name;

  return (
    <div className="p-4 space-y-5 pb-8">
      <div className="flex items-center gap-2 mb-1">
        <ArrowDownToLine className="w-4 h-4 text-pink-600" />
        <div className="text-sm font-bold text-gray-800" data-testid="text-withdrawal-title">振込申請</div>
      </div>

      {cashable && (
        <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 space-y-3" data-testid="section-cashable">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">ランク</span>
            <span className="text-sm font-bold text-pink-600" data-testid="text-rank">{cashable.rank_label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">申請可能ポイント</span>
            <span className="text-lg font-bold text-gray-900" data-testid="text-available-points">{cashable.available_points.toLocaleString()} pt</span>
          </div>
          <div className="border-t border-pink-200 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">換算額 ({cashable.available_points.toLocaleString()} pt x 1.5円)</span>
              <span className="text-gray-700" data-testid="text-yen-amount">{cashable.yen_amount.toLocaleString()}円</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">振込手数料</span>
              <span className="text-red-500" data-testid="text-transfer-fee">-{cashable.transfer_fee.toLocaleString()}円</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold border-t border-pink-200 pt-2">
              <span className="text-gray-700">振込額</span>
              <span className="text-pink-600" data-testid="text-net-amount">{cashable.net_amount.toLocaleString()}円</span>
            </div>
          </div>

          {!showConfirm ? (
            <button
              onClick={() => { setShowConfirm(true); setApplyError(""); }}
              disabled={cashable.available_points <= 0 || cashable.net_amount <= 0 || !bankComplete}
              data-testid="button-apply-withdrawal"
              className="w-full py-2.5 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!bankComplete ? "口座情報を先に保存してください" : cashable.available_points <= 0 ? "申請可能なポイントがありません" : "全ポイントを振込申請する"}
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-pink-300 bg-white p-3">
              <div className="text-xs text-gray-700 text-center">
                <span className="font-bold">{cashable.available_points.toLocaleString()} pt</span> を申請します。<br />
                振込額: <span className="font-bold text-pink-600">{cashable.net_amount.toLocaleString()}円</span> (手数料1,000円差引)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  data-testid="button-cancel-withdrawal"
                  className="flex-1 py-2 rounded-xl border border-pink-200 text-gray-600 text-sm hover:bg-pink-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={applyWithdrawal}
                  disabled={applying}
                  data-testid="button-confirm-withdrawal"
                  className="flex-1 py-2 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50"
                >
                  {applying ? "申請中..." : "申請する"}
                </button>
              </div>
              {applyError && <div className="text-xs text-red-500 text-center" data-testid="text-apply-error">{applyError}</div>}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-pink-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Banknote className="w-4 h-4 text-gray-600" />
          <div className="text-sm font-bold text-gray-800" data-testid="text-bank-title">振込先口座</div>
        </div>
        {[
          { label: "銀行名", key: "name" as const },
          { label: "支店名", key: "branch_name" as const },
          { label: "口座番号", key: "account_number" as const },
          { label: "口座名義", key: "account_holder_name" as const },
        ].map(({ label, key }) => (
          <label key={key} className="block text-sm">
            <span className="text-gray-600">{label}</span>
            <input value={fields[key]} onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
              data-testid={`input-bank-${key}`}
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
          </label>
        ))}
        <label className="block text-sm">
          <span className="text-gray-600">口座種別</span>
          <select value={fields.account_type} onChange={(e) => setFields((p) => ({ ...p, account_type: e.target.value }))}
            data-testid="select-bank-type"
            className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none">
            <option value="普通">普通</option>
            <option value="当座">当座</option>
          </select>
        </label>
        <button onClick={saveBank} disabled={saving} data-testid="button-save-bank"
          className="w-full py-2 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50">
          {saving ? "保存中..." : saved ? "保存しました" : "口座を保存する"}
        </button>
      </div>

      {withdrawals && withdrawals.length > 0 && (
        <div className="rounded-xl border border-pink-200 bg-white p-4 space-y-3">
          <div className="text-sm font-bold text-gray-800" data-testid="text-history-title">申請履歴</div>
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg bg-pink-50 px-3 py-2 text-xs" data-testid={`withdrawal-${w.id}`}>
                <div className="space-y-0.5">
                  <div className="text-gray-700 font-medium">{w.amount.toLocaleString()} pt → {w.net_amount.toLocaleString()}円</div>
                  <div className="text-gray-400">{new Date(w.requested_at).toLocaleDateString("ja-JP")}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor(w.status)}`} data-testid={`status-${w.id}`}>
                  {statusLabel(w.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTabView() {
  const [profileTab, setProfileTab] = useState<"profile" | "menus" | "templates">("profile");
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex gap-1 px-4 pt-3 pb-1">
        {([
          { id: "profile" as const, label: "プロフィール" },
          { id: "menus" as const, label: "メニュー" },
          { id: "templates" as const, label: "テンプレート" },
        ]).map((t) => (
          <button key={t.id} onClick={() => setProfileTab(t.id)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${profileTab === t.id ? "bg-pink-600 border-pink-500 text-white" : "bg-pink-50 border-pink-200 text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {profileTab === "profile" && <ProfileSettings />}
        {profileTab === "menus" && <MenuSettings />}
        {profileTab === "templates" && <TemplateSettings />}
      </div>
    </div>
  );
}

type GlobalNotification = { room_id: string; querent_name: string; cost_pt: number };

export default function AdvisorApp() {
  const { user, loading, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"chat" | "querents" | "profile" | "bank">("chat");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
  const globalWsRef = useRef<WebSocket | null>(null);

  const queryClient = useQueryClient();

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["/api/my_rooms"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: unreadData } = useQuery<{ unread_count: number }>({
    queryKey: ["/api/unread_count"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  const totalUnread = unreadData?.unread_count ?? 0;

  useEffect(() => {
    if (!loading && (!user || user.role !== "2")) {
      setLocation("/fortuneteller_login");
    }
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user || user.role !== "2") return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws?fortuneteller_id=${user.id}`);
    globalWsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "unlock_notification") {
          setGlobalNotification({ room_id: data.room_id, querent_name: data.querent_name, cost_pt: data.cost_pt ?? 0 });
          queryClient.invalidateQueries({ queryKey: ["/api/my_cashable"] });
          setTimeout(() => setGlobalNotification(null), 8000);
        }
      } catch {}
    };
    return () => { ws.close(); };
  }, [user?.id]);

  function handleNavigateToRoom(roomId: string) {
    setGlobalNotification(null);
    const room = (rooms ?? []).find((r) => r.id === roomId);
    if (room) {
      setTab("chat");
      setSelectedRoom(room);
    } else {
      setTab("chat");
      queryClient.invalidateQueries({ queryKey: ["/api/my_rooms"] });
    }
  }

  async function handleLogout() {
    await apiRequest("POST", "/api/logout", {});
    await refreshUser();
    setLocation("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 relative">
      {globalNotification && (
        <div className="absolute top-14 left-2 right-2 z-50 bg-amber-500 text-white rounded-2xl shadow-xl p-3 flex items-start gap-3" data-testid="banner-unlock-notification">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold">🔓 {globalNotification.querent_name} さんがメッセージをアンロックしました</div>
            {globalNotification.cost_pt > 0 && <div className="text-[10px] mt-0.5 opacity-90">+{globalNotification.cost_pt.toLocaleString()}pt</div>}
          </div>
          <button onClick={() => handleNavigateToRoom(globalNotification.room_id)}
            className="flex-shrink-0 bg-white text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
            チャットを開く
          </button>
          <button onClick={() => setGlobalNotification(null)} className="flex-shrink-0 text-white/80 hover:text-white text-xs">✕</button>
        </div>
      )}
      <header className="flex items-center justify-between px-4 py-3 border-b border-pink-200 bg-white">
        <div className="text-sm font-bold text-gray-900" data-testid="text-advisor-app-title">
          <Sparkles className="w-4 h-4 inline-block mr-1 text-pink-600" />
          占い師管理
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:inline" data-testid="text-ft-email">{user?.email}</span>
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-800" data-testid="button-ft-logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "chat" && selectedRoom ? (
          <ChatView room={selectedRoom} onBack={() => setSelectedRoom(null)} />
        ) : tab === "chat" ? (
          <RoomList rooms={rooms ?? []} onSelect={setSelectedRoom} />
        ) : tab === "querents" ? (
          <QuerentListView />
        ) : tab === "profile" ? (
          <ProfileTabView />
        ) : (
          <div className="flex-1 overflow-y-auto"><WithdrawalTab /></div>
        )}
      </div>

      <nav className="flex border-t border-pink-200 bg-white">
        {([
          { key: "chat" as const, icon: MessageCircle, label: "チャット" },
          { key: "querents" as const, icon: Users, label: "相談者一覧" },
          { key: "profile" as const, icon: Settings, label: "プロフィール" },
          { key: "bank" as const, icon: Banknote, label: "振込申請" },
        ]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => { setTab(key); setSelectedRoom(null); }}
            data-testid={`tab-${key}`}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
              tab === key ? "text-pink-600" : "text-gray-400 hover:text-gray-600"
            }`}>
            <div className="relative">
              <Icon className="w-5 h-5" />
              {key === "chat" && totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1" data-testid="badge-unread-total">
                  {totalUnread}
                </span>
              )}
            </div>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
