// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCookie } from "./utils/cookies";
import "./index.css";

const csrftoken = getCookie("csrftoken");


const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "/api";

/** ===================== 定数/設定 ===================== */
const STRIPE_TEST_CHECKOUT_SUBSCRIPTION = "https://buy.stripe.com/test_XXXXXXXXXXXX"; // ダミー
const STRIPE_TEST_CHECKOUT_POINTS_1000 = "https://buy.stripe.com/test_YYYYYYYYYYYY"; // ダミー
const STRIPE_TEST_CHECKOUT_POINTS_3000 = "https://buy.stripe.com/test_ZZZZZZZZZZZZ"; // ダミー

// 1pt=1.5円
const YEN_PER_POINT = 1.5;

const RANK_TABLE = {
    S: { key: "PLATINUM", jp: "プラチナ", mult: 3, color: "from-slate-200 to-zinc-500" },
    A: { key: "GOLD", jp: "ゴールド", mult: 2, color: "from-amber-200 to-orange-500" },
    B: { key: "SILVER", jp: "シルバー", mult: 1, color: "from-neutral-200 to-gray-400" },
    PLATINUM: { key: "PLATINUM", jp: "プラチナ", mult: 3, color: "from-slate-200 to-zinc-500" },
    GOLD: { key: "GOLD", jp: "ゴールド", mult: 2, color: "from-amber-200 to-orange-500" },
    SILVER: { key: "SILVER", jp: "シルバー", mult: 1, color: "from-neutral-200 to-gray-400" },
};
const getRankInfo = (rank) => RANK_TABLE[rank] || RANK_TABLE.B;

const SAMPLE_GENRES = ["恋愛", "仕事", "人間関係", "金運", "健康"];
const FREE_TEMPLATES = [
    "初めまして. 相手との今後の関係について相談したいです.",
    "転職のタイミングと適職について見てください.",
    "今月の全体運と注意すべき点を教えてください.",
];


/** ===================== ユーティリティ・storage ===================== */
const storage = {
    load(key, fallback) {
        try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
    },
    save(key, v) { localStorage.setItem(key, JSON.stringify(v)); },
};
const yen = (pts) => `${Math.round(pts * YEN_PER_POINT).toLocaleString()}円`;
const fmtPts = (n) => `${Number(n).toLocaleString()} pt`;
const timefmt = (ms) => new Date(ms).toLocaleTimeString();
const cls = (...v) => v.filter(Boolean).join(" ");
const truncate = (text, length = 150) => {
    if (typeof text !== "string") return "";
    return text.length <= length ? text : text.slice(0, length) + "…";
};
const genreColor = (g) => {
    if (!g) return { on: "bg-white text-gray-900 border-white", off: "bg-white/10 border-white/15" };
    if (g.includes("恋")) return { on: "bg-pink-300 text-gray-900 border-pink-200", off: "bg-pink-500/10 border-pink-400/30 text-pink-100" };
    if (g.includes("仕")) return { on: "bg-blue-300 text-gray-900 border-blue-200", off: "bg-blue-500/10 border-blue-400/30 text-blue-100" };
    if (g.includes("人")) return { on: "bg-amber-300 text-gray-900 border-amber-200", off: "bg-amber-500/10 border-amber-400/30 text-amber-100" };
    if (g.includes("金")) return { on: "bg-yellow-300 text-gray-900 border-yellow-200", off: "bg-yellow-500/10 border-yellow-400/30 text-yellow-100" };
    if (g.includes("健")) return { on: "bg-emerald-300 text-gray-900 border-emerald-200", off: "bg-emerald-500/10 border-emerald-400/30 text-emerald-100" };
    return { on: "bg-white text-gray-900 border-white", off: "bg-white/10 border-white/15" };
};

/** ===================== 小コンポーネント ===================== */
function Ribbon({ rank }) {
    const info = getRankInfo(rank);
    return <span className={cls("text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r", info.color)}>{info.jp}</span>;
}
function RankBadge({ rank }) {
    let color = "bg-white/10 text-white";
    if (rank === 1) color = "bg-yellow-500 text-gray-900 shadow-md shadow-yellow-800/50";
    else if (rank === 2) color = "bg-slate-300 text-gray-900 shadow-md shadow-slate-800/50";
    else if (rank === 3) color = "bg-amber-700 text-white shadow-md shadow-amber-900/50";
    return (
        <span className={cls("absolute top-1 left-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white/10 z-10", color)}>{rank}</span>
    );
}
function IconBtn({ children, onClick }) {
    return <button onClick={onClick} className="rounded-xl px-3 py-2 text-base bg-white/5 border border-white/10">{children}</button>;
}
function Attachment({ item, contrast }) {
    const base = contrast ? "opacity-95" : "opacity-90";
    if (item.type === "image") return <img src={item.url} alt={item.name} className={cls("rounded-xl max-h-48", base)} />;
    if (item.type === "video") return <video src={item.url} controls className={cls("rounded-xl max-h-48", base)} />;
    return <a href={item.url} target="_blank" rel="noreferrer" className={cls("underline break-all", base)}>{item.name}</a>;
}
function Input({ label, value, onChange, type = "text", placeholder }) {
    return (
        <label className="block text-sm">
            <span className="text-white/80">{label}</span>
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50" />
        </label>
    );
}
function Select({ label, value, onChange, options = [] }) {
    return (
        <label className="block text-sm">
            <span className="text-white/80">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm">
                <option value="">選択してください</option>
                {options.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
        </label>
    );
}
function Textarea({ label, value, onChange, hint }) {
    return (
        <label className="block text-sm">
            <span className="text-white/80">{label}</span>
            <textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50" />
            {hint && <div className="text-right text-[11px] text-white/60 mt-1">{hint}</div>}
        </label>
    );
}

/** ===================== レイアウト系 ===================== */
function Header({ plan, points, subscriptionActive, onGoPlan }) {
    return (
        <div className="px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center shadow-lg shadow-fuchsia-800/30 text-sm">🔮</div>
                    <div className="text-lg font-extrabold tracking-tight leading-tight">占いチャット</div>
                </div>
                <div className="text-xs bg-white/10 backdrop-blur rounded-full px-3 py-1 border border-white/10">
                    {points > 0 ? `ポイント ${points.toLocaleString()}` : (
                        <button onClick={onGoPlan} className="text-white/80 font-semibold">ログイン/新規登録</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function RankedCarousel({ title, advisors, onStartChat, onFav, favorites, limit = 10, emptyText, showRankBadge = true }) {
    const sortedAdvisors = useMemo(() => {
        if (advisors.length <= limit && !showRankBadge) return advisors;
        return [...advisors].sort(() => Math.random() - 0.5);
    }, [advisors, limit, showRankBadge]);
    const list = sortedAdvisors.slice(0, limit);

    if (!list || list.length === 0) {
        return (
            <div className="space-y-3">
                <h3 className="font-semibold text-white/90 mb-2">{title}</h3>
                <div className="text-sm text-white/60">{emptyText || "該当なし"}</div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-white/90 mb-2">{title}</h3>
            <div className="flex gap-3 overflow-x-auto snap-x no-scrollbar pr-2">
                {list.map((a, index) => (
                    <div key={a.id} className="snap-start min-w-[85%] bg-white/5 border border-white/10 rounded-2xl p-0 backdrop-blur shrink-0 relative">
                        {showRankBadge && <RankBadge rank={index + 1} />}
                        <div className="h-32 w-full rounded-t-2xl overflow-hidden">
                            <img src={a.profile_image} alt={a.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3">
                            <div className="flex items-start gap-3">
                                <img src={a.icon_image} alt={a.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium truncate flex items-center gap-2 text-base">{a.name} <Ribbon rank={a.rank} /></div>
                                    <div className="text-xs text-white/70 truncate">{a.headline}</div>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button className="rounded-xl py-2 text-sm font-semibold bg-white text-gray-900" onClick={() => onStartChat(a.id)}>相談する</button>
                                <button className={cls("rounded-xl py-2 text-sm font-semibold border border-white/20", favorites.includes(a.id) ? "bg-pink-500/20 text-pink-100" : "text-white/80")} onClick={() => onFav(a.id)}>
                                    {favorites.includes(a.id) ? "★ お気に入り" : "☆ お気に入り"}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FeaturedAdvisors({ advisors, onStartChat, onFav, favorites }) {
    // const featuredList = useMemo(() => FEATURED_ADVISORS_IDS.map((id) => advisors.find((a) => a.id === id)).filter(Boolean), [advisors]);
    const featuredList = useMemo(() => { 
        return advisors.filter((a) => a.is_recommended);
        },[advisors]) 

    if (featuredList.length === 0) return null;
    return (
        <div className="space-y-3">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">✨ おすすめ占い師</h3>
            <div className="grid grid-cols-3 gap-2">
                {featuredList.map((a) => (
                    <div key={a.id} className="text-center bg-white/5 border border-white/10 rounded-xl p-2 backdrop-blur relative">
                        <img src={a.icon_image} alt={a.name} className="w-12 h-12 mx-auto rounded-full object-cover ring-2 ring-pink-500/70" />
                        <div className="mt-2 text-xs font-semibold truncate leading-tight">{a.name}</div>
                        <div className="mt-0.5"><Ribbon rank={a.rank} /></div>
                        <button className="mt-2 w-full rounded-lg py-1 text-[10px] font-bold bg-pink-500 text-gray-900" onClick={() => onStartChat(a.id)}>相談</button>
                        <button className={cls("absolute top-1 right-1 text-sm", favorites.includes(a.id) ? "text-pink-400" : "text-white/50")} onClick={() => onFav(a.id)} title={favorites.includes(a.id) ? "お気に入り登録済み" : "お気に入り登録"}>
                            {favorites.includes(a.id) ? "★" : "☆"}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CardList({ title, advisors, onStartChat, onFav, favorites, emptyText }) {
    const [detailId, setDetailId] = useState(null);
    const adv = (id) => advisors.find((x) => x.id === id);
    return (
        <div>
            <h3 className="font-semibold text-white/90 mb-2">{title}</h3>
            {(!advisors || advisors.length === 0) ? (
                <div className="text-sm text-white/60">{emptyText || "該当なし"}</div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {advisors.map((a) => (
                        <div key={a.id} className="text-left bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur">
                            <img src={a.profile_image} alt={a.name} className="w-full h-28 object-cover" />
                            <div className="p-3">
                                <div className="flex items-start gap-3">
                                    <img src={a.icon_image} alt={a.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate flex items-center gap-2">{a.name} <Ribbon rank={a.rank} /></div>
                                        <div className="text-[11px] text-white/70 truncate">{a.tags.join("・")}</div>
                                        <div className="text-xs text-white/80 mt-1">{truncate(`${a.headline} — ${a.intro}`, 150)}</div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <button className="rounded-xl py-2 text-xs font-semibold bg-white text-gray-900" onClick={() => onStartChat(a.id)}>相談する</button>
                                    <button className={cls("rounded-xl py-2 text-xs font-semibold border border-white/20", favorites.includes(a.id) ? "bg-pink-500/20 text-pink-100" : "text-white/80")} onClick={() => onFav(a.id)}>
                                        {favorites.includes(a.id) ? "★ お気に入り" : "☆ お気に入り"}
                                    </button>
                                    <button className="rounded-xl py-2 text-xs font-semibold bg-white/10 border border-white/20" onClick={() => setDetailId(a.id)}>詳細を見る</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {detailId && (
                <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setDetailId(null)}>
                    <div className="w-full max-w-md bg-[#0d1a33] border border-white/10 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {adv(detailId) && (
                            <>
                                <img src={adv(detailId).profile_image} className="w-full h-32 object-cover" />
                                <div className="p-4">
                                    <div className="flex items-center gap-3">
                                        <img src={adv(detailId).icon_image} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20" />
                                        <div className="min-w-0">
                                            <div className="font-semibold truncate flex items-center gap-2">{adv(detailId).name} <Ribbon rank={adv(detailId).rank} /></div>
                                            <div className="text-[11px] text-white/70 truncate">{adv(detailId).tags.join("・")}</div>
                                        </div>
                                    </div>
                                    <h4 className="mt-3 font-semibold">{adv(detailId).headline}</h4>
                                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{(adv(detailId).intro || "").slice(0, 1000)}</p>
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <button className="rounded-xl py-2 text-xs font-semibold bg-white text-gray-900" onClick={() => { onStartChat(detailId); setDetailId(null); }}>この占い師に相談</button>
                                        <button className="rounded-xl py-2 text-xs font-semibold bg-white/10 border border-white/20" onClick={() => setDetailId(null)}>閉じる</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function Advisors({advisorsFromTop, favorites, onFav, onStartChat }) {
    const [q, setQ] = useState("");

    const lowerQ = q.toLowerCase();
    const filtered = advisorsFromTop.filter((a) => a.name.toLowerCase().includes(lowerQ) || a.tags.join(" ").toLowerCase().includes(lowerQ));
    return (
        <section className="space-y-3">
            <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-1 bg-[#0d1a33]/80 backdrop-blur">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・ジャンルで検索"
                    className="w-full rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/50" />
            </div>
            <CardList advisors={filtered} onStartChat={onStartChat} onFav={onFav} favorites={favorites} emptyText="該当する占い師が見つかりませんでした" />
        </section>
    );
}

/** ============== 送信確認モーダル ============== */
function ConfirmModal({ cost, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
            <div className="w-full max-w-sm bg-[#0d1a33] border border-white/10 rounded-2xl overflow-hidden p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-lg font-semibold text-pink-300">ポイント消費の確認</h4>
                <p className="text-white/90 leading-relaxed">
                    このメッセージを送信すると、<b className="text-lg text-pink-200">{fmtPts(cost)}</b>（約{yen(cost)}）を消費します。
                </p>
                <p className="text-sm text-white/70">残ポイント: <b>{fmtPts(storage.load("points", 0))}</b></p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button className="rounded-xl py-2 text-sm font-semibold bg-white/10 border border-white/20 text-white/80" onClick={onCancel}>キャンセル</button>
                    <button className="rounded-xl py-2 text-sm font-semibold bg-pink-500 text-gray-900" onClick={onConfirm}>送信して消費する</button>
                </div>
            </div>
        </div>
    );
}

/** ============== チャット ============== */
function Chat({ plan, points, setPoints, subscriptionActive, advisor, thread, saveThread, onBack }) {
    const [text, setText] = useState("");
    const [uploads, setUploads] = useState([]);
    const fileInputRef = useRef(null);
    const [showIntroFull, setShowIntroFull] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [costToConfirm, setCostToConfirm] = useState(null);

    const [roomLoading, setRoomLoading] = useState(true);
    const [room, setRoom] = useState(null);
    const socketRef = useRef(null);

    useEffect (() =>{
        if (!advisor) return;

        const fetchRoom = async () => {
            try{
                const res = await fetch(`${API_BASE}/get_room/?fortuneteller=${advisor.id}`,{
                    method:"GET",
                    headers:{
                        "Content-type": "application/json",
                        "X-CSRFToken": csrftoken
                    },
                    credentials: "include",
                });
                if (!res.ok) throw new Error ("failed");
                const data = await res.json();
                if (data && data.id){
                    setRoom({ id: data.id, messages: data.messages || [] });
                } else {
                    setRoom(null)
                };
            } catch (e){
                console.error(e);
                setRoom(null);
            } finally {
                setRoomLoading(false)
            }
        };
        fetchRoom();
    }, [advisor?.id])

    useEffect (() => {
        if (roomLoading) return;
        if (!advisor) return;

        const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";

        const wsUrl = room
            ? `${wsScheme}://${window.location.host}/ws/chat/${room.id}/`
            : `${wsScheme}://${window.location.host}/ws/chat/fortuneteller/${advisor.id}/`;

        const sock = new WebSocket(wsUrl);
        socketRef.current = sock;

        sock.onmessage = (event) => {
            const data = JSON.parse(event.data)
            
            if (data.type === "room_init"){
                setRoom((prev) => ({
                    id: data.room_id,
                    message: prev?.messages ?? []
                }));
            }
            if (data.type === "history"){
                setRoom((prev) => ({
                    id: data.room_id || room?.id,
                    messages: data.messages
                }));
            }
            if (data.type === "new_message"){
                setRoom((prev) => ({
                    ...(prev || {id: room?.id}),
                    messages: [...(prev?.messages || []), data.message],
                }))
            }
        };
        return () =>{
            sock.close();
        };
    },[roomLoading, advisor?.id, room?.id]);

    

    if (!advisor) return <section className="py-12 text-center text-white/70">まず占い師を選んでください（ホームまたは「占い師」から）。</section>;

    const addMsg = (msg) => {
        const t = thread || { advisorId: advisor.id, messages: [] };
        const updated = { ...t, messages: [...t.messages, msg] };
        saveThread(updated);
    };
    const executeSend = (cost) => {
        if (!(plan === "subscription" && subscriptionActive)) 
            setPoints((p) => p - cost);
        const message = {
            id: crypto.randomUUID(),
            role: "querent",
            text: text.trim(),
            attachments: uploads,
            createAt: Date.now(),
            free: cost === 0
        }
        addMsg(message)

        const payload = {
            type: "chat_message",
            text: text.trim(),
            attachments: uploads
        };

        if (!room) {
            payload.advisor_id = advisor.id
        }

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(payload));
        } else {
            console.warn("webSocket not open");
        }

        setText("");
        setUploads([]);
        setCostToConfirm(null);
        setShowTemplates(false);
        // addMsg({ id: crypto.randomUUID(), role: "user", text: text.trim(), attachments: uploads, createdAt: Date.now(), free: cost === 0 });
        // setText(""); setUploads([]); setCostToConfirm(null); setShowTemplates(false);
        // setTimeout(() => { addMsg({ id: crypto.randomUUID(), role: "advisor", text: demoReadingText(), createdAt: Date.now(), opened: true }); }, 500);
    };
    const onSend = ({ isFreeTemplate = false } = {}) => {
        const trimmed = text.trim();
        if (trimmed === "" && uploads.length === 0) return;
        const rankInfo = getRankInfo(advisor.rank);
        const cost = isFreeTemplate ? 0 : trimmed.length * rankInfo.mult;

        if (plan === "subscription" && subscriptionActive) { executeSend(0); return; }
        if (points < cost) { alert(`ポイントが不足しています。必要: ${cost}pt。ポイントを購入してください。`); return; }
        if (isFreeTemplate) { executeSend(0); return; }
        setCostToConfirm(cost);
    };
    const onConfirmSend = () => { if (costToConfirm !== null) executeSend(costToConfirm); };
    const onFileChange = (e) => {
        const files = e.target.files; if (!files || !files.length) return;
        const newUploads = Array.from(files).map((f) => {
            const url = URL.createObjectURL(f);
            let type = "file"; if (f.type.startsWith("image/")) type = "image"; else if (f.type.startsWith("video/")) type = "video";
            return { type, url, name: f.name };
        });
        setUploads(newUploads); e.target.value = "";
    };
    const handlePlusClick = () => { fileInputRef.current?.click(); };
    const removeUpload = (i) => setUploads((prev) => prev.filter((_, idx) => idx !== i));
    const applyTemplate = (t) => { setText(t); setShowTemplates(false); };
    const sendTemplateFree = (t) => { if (text.trim() === "" && uploads.length === 0) setText(t); onSend({ isFreeTemplate: true }); };

    const handleSend = () => {
    // ...今までと同じ。初回だけ advisor_id を送る
        const payload = {
            type: "chat_message",
            text: "こんにちは！",
            };
            if (!thread) {
            payload.advisor_id = advisor.id;
            }
            socketRef.current?.send(JSON.stringify(payload));
    };

    if (roomLoading) {
        return <div className="text-white/60 p-4">読み込み中…</div>;
    }

    return (
        <section className="pb-28">
            {costToConfirm !== null && (<ConfirmModal cost={costToConfirm} onConfirm={onConfirmSend} onCancel={() => setCostToConfirm(null)} />)}

            <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-0 bg-[#0d1a33]/80 backdrop-blur border-b border-white/10">
                <div className="flex items-center gap-3 py-1">
                    <img src={advisor.icon_image} className="w-10 h-10 rounded-full ring-2 ring-white/20 object-cover" />
                    <div className="min-w-0">
                        <div className="font-semibold leading-tight truncate">{advisor.name}</div>
                        <div className="text-[11px] text-white/70 flex items-center gap-2">
                            <Ribbon rank={advisor.rank} /> {plan === "subscription" && subscriptionActive ? <span className="text-emerald-300">月額内で使い放題</span> : <span>1文字={getRankInfo(advisor.rank).mult}pt / 1pt={YEN_PER_POINT}円</span>}
                        </div>
                    </div>
                    {onBack && <button className="ml-auto text-xs font-semibold rounded-xl px-3 py-1 bg-white/10 border border-white/20" onClick={onBack}>一覧へ</button>}
                </div>

                <div className="mt-2 mb-2 border-t border-white/10 pt-2">
                    <div className="rounded-2xl overflow-hidden border border-white/10">
                        <img src={advisor.profile_image} className="w-full h-28 object-cover" />
                        <div className="p-3">
                            <div className="text-sm font-semibold">{advisor.headline}</div>
                            <p className="text-xs text-white/80 mt-1 whitespace-pre-wrap">{truncate(advisor.intro, 150)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-3 space-y-3">
                {(thread?.messages ?? []).length === 0 ? (
                    <div className="text-center text-white/60 mt-8 text-sm">最初のご相談内容を送ってみましょう。（「＋」でファイル添付ができます）</div>
                ) : (
                    <ul className="space-y-3">
                        {thread.messages.map((m) => (
                            <li key={m.id} className={cls("px-2", m.role === "user" ? "text-right" : "text-left")}>
                                <div className={cls("inline-block max-w-[85%] rounded-2xl p-3 shadow-lg", m.role === "user" ? (m.free ? "bg-green-600" : "bg-gradient-to-br from-indigo-600 to-fuchsia-600") : "bg-white/8 border border-white/10")}>
                                    <div className={cls("text-[10px] mb-1", m.role === "user" ? "text-white/70" : "text-white/60")}>{m.role === "user" ? (m.free ? "あなた(無料)" : "あなた") : "占い師"}・{timefmt(m.createdAt)}</div>
                                    {m.attachments?.length > 0 && (
                                        <div className="space-y-2 mb-2">
                                            {m.attachments.map((a, idx) => <Attachment key={idx} item={a} contrast={m.role === "user"} />)}
                                        </div>
                                    )}
                                    <p className={cls("whitespace-pre-wrap leading-relaxed", m.role === "user" ? "text-white" : "text-white/90")}>{m.text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="fixed bottom-[56px] left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)] px-4">
                {plan === "points" && (
                    <div className="text-right mb-1 text-[11px] text-white/60">
                        ※ 1pt={YEN_PER_POINT}円 相当。あなたの占い師は <b>{getRankInfo(advisor.rank).jp}</b>（<b>1文字={getRankInfo(advisor.rank).mult}pt</b>）です。
                    </div>
                )}

                {uploads.length > 0 && (
                    <div className="mb-2 flex gap-2 overflow-x-auto">
                        {uploads.map((u, idx) => (
                            <div key={idx} className="min-w-[140px] border border-white/15 bg-white/5 rounded-2xl p-2 text-xs flex items-center gap-2 relative">
                                <span className="opacity-80">{u.type === "image" ? "🖼" : u.type === "video" ? "🎬" : "📎"}</span>
                                <span className="truncate max-w-[96px]" title={u.name}>{u.name}</span>
                                <button onClick={() => removeUpload(idx)} className="absolute top-0 right-0 p-1 text-white/50 hover:text-white text-sm leading-none">×</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-[#111a2e] border border-white/10 rounded-2xl p-2 flex items-end gap-2 shadow-xl">
                    <textarea
                        value={text}
                        onChange={(e) => { setText(e.target.value); if (showTemplates) setShowTemplates(false); }}
                        onFocus={() => { if (text.trim() === "" && uploads.length === 0) setShowTemplates(true); }}
                        placeholder="ご相談内容を入力…"
                        className="flex-1 bg-transparent outline-none resize-none text-sm max-h-28 min-h-[44px] placeholder:text-white/50"
                    />

                    {showTemplates && (
                        <div className="absolute bottom-[56px] left-0 right-0 w-full bg-[#0d1a33] border border-white/15 rounded-xl p-2 space-y-1 shadow-xl z-30">
                            <div className="text-[11px] text-white/60 pl-2">無料テンプレを選択してすぐ相談</div>
                            {FREE_TEMPLATES.map((t, i) => (
                                <button key={i} className="w-full text-left text-xs bg-white/5 border border-white/10 rounded px-2 py-1" onClick={() => applyTemplate(t)}>
                                    「{truncate(t, 20)}」を挿入
                                </button>
                            ))}
                            <button className="w-full text-center text-xs bg-emerald-600 rounded px-2 py-1 font-semibold" onClick={() => sendTemplateFree(FREE_TEMPLATES[0])}>
                                テンプレートですぐ送信 (無料)
                            </button>
                            <section>
                                {/* thread?.messages を表示 */}
                                <button onClick={handleSend}>送信</button>
                            </section>
                            <div className="text-right">
                                <button className="text-[10px] text-white/50" onClick={() => setShowTemplates(false)}>閉じる</button>
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <IconBtn onClick={handlePlusClick}>＋</IconBtn>
                        <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={onFileChange} onFocus={() => setShowTemplates(false)} />
                    </div>

                    <button
                        onClick={() => onSend({ isFreeTemplate: false })}
                        disabled={text.trim() === "" && uploads.length === 0}
                        className="rounded-xl bg-white text-gray-900 px-5 py-2 h-10 text-sm font-semibold disabled:opacity-50"
                        title={plan === "subscription" && subscriptionActive ? "月額内" : `送信時 ${text.trim().length * getRankInfo(advisor.rank).mult}pt 消費`}
                    >
                        送信
                    </button>
                </div>
            </div>
        </section>
    );
}

/** ============== BottomNav ============== */
function BottomNav({ activeTab, setActiveTab }) {
    const items = [
        { id: "home", label: "ホーム", icon: "🏠" },
        { id: "advisors", label: "占い師", icon: "🧙" },
        { id: "chat", label: "相談", icon: "💬" },
        { id: "account", label: "登録/プラン", icon: "💎" },
    ];
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] bg-[#0d1a33]/80 backdrop-blur border-t border-white/10">
            <div className="mx-auto max-w-md grid grid-cols-4">
                {items.map((it) => (
                    <button key={it.id} onClick={() => setActiveTab(it.id)} className={cls("py-3 flex flex-col items-center text-[11px]", activeTab === it.id ? "text-white" : "text-white/60")}>
                        <div className="text-base leading-none">{it.icon}</div>
                        <div className="mt-1">{it.label}</div>
                    </button>
                ))}
            </div>
        </nav>
    );
}

/** ===================== ルート App ===================== */
function Top() {
    const [plan, setPlan] = useState(() => storage.load("plan", "points")); // 'subscription' | 'points'
    const [points, setPoints] = useState(() => storage.load("points", 200));
    const [subscriptionActive, setSubscriptionActive] = useState(() => storage.load("subscriptionActive", false));
    const [favorites, setFavorites] = useState(() => storage.load("favorites", []));
    const [threads, setThreads] = useState(() => storage.load("threads", {})); // advisorId -> {messages}
    const [activeTab, setActiveTab] = useState("home");
    const [selectedAdvisorId, setSelectedAdvisorId] = useState(() => storage.load("selectedAdvisorId", null));

    const [profile, setProfile] = useState(() => storage.load("profile", { name: "", email: "", phone: "", zipcode: "", address: "" }));
    const [karte, setKarte] = useState(() => storage.load("karte", { birthdate: "", zodiac: "", birthplace: "", birthtime: "", genre: "", body: "" }));

    const [advisors, setAdvisors] = useState([]);
    const [loadingAdvisors, setLoadingAdvisors] = useState(true);
    const [errorAdvisors, setErrorAdvisors] = useState<string | null>(null);

    useEffect(() => {
        const fetchAdvisors = async () => {
            try {
                setLoadingAdvisors(true);
                setErrorAdvisors(null)
                const res = await fetch(`${API_BASE}/get_fortuneteller_all/`);
                if (!res.ok) {
                    throw new Error("failed to fetch advisors");
                }
                const data = await res.json();
                setAdvisors(data);
            } catch (err) {
                console.error("占い師データの取得に失敗しました", err);
                setErrorAdvisors("占い師リストの取得に失敗しました");
                setAdvisors([]);
            } finally {
                setLoadingAdvisors(false);
            }
        };
        fetchAdvisors();
    }, []);

    useEffect(() => storage.save("plan", plan), [plan]);
    useEffect(() => storage.save("points", points), [points]);
    useEffect(() => storage.save("subscriptionActive", subscriptionActive), [subscriptionActive]);
    useEffect(() => storage.save("favorites", favorites), [favorites]);
    useEffect(() => storage.save("threads", threads), [threads]);
    useEffect(() => storage.save("selectedAdvisorId", selectedAdvisorId), [selectedAdvisorId]);
    useEffect(() => storage.save("profile", profile), [profile]);
    useEffect(() => storage.save("karte", karte), [karte]);

    const selectedAdvisor = useMemo(() => advisors.find((a) => a.id === selectedAdvisorId) || null, [selectedAdvisorId]);
    const startChat = (advisorId) => { if (!threads[advisorId]) setThreads((prev) => ({ ...prev, [advisorId]: { advisorId, messages: [] } })); setSelectedAdvisorId(advisorId); setActiveTab("chat"); };
    const toggleFavorite = (advisorId) => setFavorites((prev) => prev.includes(advisorId) ? prev.filter((id) => id !== advisorId) : [...prev, advisorId]);

    return (
        <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#3a1777_0%,#13254a_45%,#0c1a33_100%)] text-white">
            <Header plan={plan} points={points} subscriptionActive={subscriptionActive} onGoPlan={() => setActiveTab("account")} />
            <main className="px-4 pb-28">
                {activeTab === "home" && (
                    <Home advisors={advisors} favorites={favorites} onFav={toggleFavorite} onStartChat={startChat} />
                )}
                {activeTab === "advisors" && (
                    <Advisors advisorsFromTop={advisors} favorites={favorites} onFav={toggleFavorite} onStartChat={startChat} />
                )}
                {activeTab === "chat" && (
                    <Chat
                        plan={plan} points={points} setPoints={setPoints}
                        subscriptionActive={subscriptionActive}
                        advisor={selectedAdvisor}
                        thread={selectedAdvisor ? threads[selectedAdvisor.id] : undefined}
                        saveThread={(t) => setThreads((prev) => ({ ...prev, [t.advisorId]: t }))}
                        onBack={() => setActiveTab("advisors")}
                    />
                )}
                {activeTab === "chat" && !selectedAdvisor && (
                    <div className="text-white/70 p-4">占い師を読み込み中です…</div>
                )}
                {activeTab === "account" && (
                    <Account
                        plan={plan} setPlan={setPlan}
                        points={points} setPoints={setPoints}
                        subscriptionActive={subscriptionActive} setSubscriptionActive={setSubscriptionActive}
                        profile={profile} setProfile={setProfile}
                        karte={karte} setKarte={setKarte}
                    />
                )}
            </main>

            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
}

/** ===================== その他：Home/Account/dummy ===================== */
function Home({ advisors, favorites, onFav, onStartChat }) {
    console.log("Home props.advisors length:", advisors.length);
    const [selectedGenre, setSelectedGenre] = useState(SAMPLE_GENRES[0]);
    const sortedAdvisors = useMemo(() => [...advisors].sort(() => Math.random() - 0.5), [advisors]);
    const filterAndSortByGenre = useMemo(() => sortedAdvisors.filter((a) => a.tags.includes(selectedGenre)), [selectedGenre, sortedAdvisors]);

    const GenreChipRow = () => (
        <div className="flex flex-wrap gap-2 mb-3">
            {SAMPLE_GENRES.map((g) => {
                const color = genreColor(g); const active = selectedGenre === g;
                return (
                    <button key={g} onClick={() => setSelectedGenre(g)}
                        className={cls("text-xs rounded-full px-3 py-1 border transition-colors", active ? color.on : color.off)}>#{g}</button>
                );
            })}
        </div>
    );

    return (
        <section className="space-y-6">
            <FeaturedAdvisors advisors={advisors} onStartChat={onStartChat} onFav={onFav} favorites={favorites} />
            <div className="h-0 border-t border-white/10 mx-auto w-11/12" />
            <RankedCarousel title="🔮 総合ランキング TOP10" advisors={sortedAdvisors} onStartChat={onStartChat} onFav={onFav} favorites={favorites} limit={10} />
            <div className="h-0 border-t border-white/10 mx-auto w-11/12" />
            <div className="space-y-3">
                <div>
                    <h3 className="font-semibold text-white/90 mb-2">🏷 ジャンル別ランキング</h3>
                    <GenreChipRow />
                </div>
                <RankedCarousel
                    title={`✨ ${selectedGenre} ランキング TOP10`}
                    advisors={filterAndSortByGenre}
                    onStartChat={onStartChat} onFav={onFav} favorites={favorites}
                    limit={10} emptyText={`「${selectedGenre}」に該当する占い師はいません。`}
                />
            </div>
            <RankedCarousel
                title="★ お気に入りリスト"
                advisors={advisors.filter((a) => favorites.includes(a.id))}
                onStartChat={onStartChat} onFav={onFav} favorites={favorites}
                limit={advisors.length} showRankBadge={false} emptyText="お気に入りの占い師を登録しましょう"
            />
        </section>
    );
}

function Account({ plan, setPlan, points, setPoints, subscriptionActive, setSubscriptionActive, profile, setProfile, karte, setKarte }) {
    const [tab, setTab] = useState("plan");

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (tab !== "karte") return;   
        if (!karte.birthdate && !karte.zodiac) return;

        const ctrl = new AbortController();

        (async () => {
            try {
                await fetch(`${API_BASE}/edit_querent_karte/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(karte),
                    signal: ctrl.signal
                });
                console.log("POSTできた")
            } catch (e) {
                if (e.name !== "AbortError") console.error("失敗", e);
            }
        })();

        return () => ctrl.abort();
    },[karte]);

    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);
    const [submitErr, setSubmitErr] = useState<string | null>(null);

    async function handleSignup(){
        try {
            setSubmitting(true);
            setSubmitMsg(null);
            setSubmitErr(null);

            const res = await fetch(`${API_BASE}/create_querent_user/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
            });
            if (!res.ok) throw new Error(`status ${res.status}`);
            const data = await res.json().catch(() => ({}));
            setSubmitMsg(data.message ?? "登録しました");
        } catch (e:any) {
            setSubmitMsg(e?.message ?? "登録に失敗しました");
        } finally {
            setSubmitting(false);
        }
    }
    return (
        <section className="space-y-4">
            <div className="flex gap-2">
                {[
                    { id: "plan", label: "プラン" },
                    { id: "signup", label: "会員登録" },
                    { id: "karte", label: "カルテ" },
                ].map((t) => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={cls("px-3 py-2 rounded-lg text-xs", tab === t.id ? "bg-white text-gray-900" : "bg-white/10 border border-white/15")}>{t.label}</button>
                ))}
            </div>

            {tab === "plan" && (
                <div className="grid grid-cols-1 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold">月額サブスク</div>
                                <div className="text-sm text-white/70">ポイント消費なし。相談し放題。</div>
                            </div>
                            <Ribbon rank={"S"} />
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="radio" checked={plan === "subscription"} onChange={() => setPlan("subscription")} /> このプランにする
                            </label>
                        </div>
                        <div className="mt-3 flex gap-2">
                            <button className={cls("rounded-xl px-4 py-2 text-sm font-semibold", subscriptionActive ? "bg-emerald-300 text-gray-900" : "bg-white text-gray-900")}
                                onClick={() => { if (!subscriptionActive) { window.open(STRIPE_TEST_CHECKOUT_SUBSCRIPTION, "_blank"); alert("デモ: StripeのテストCheckoutへ遷移します。決済後は下のボタンで有効化してください。"); } }}>
                                {subscriptionActive ? "契約中" : "Stripeで契約(テスト)"}
                            </button>
                            {!subscriptionActive && (<button className="rounded-xl px-3 py-2 text-xs bg-white/10 border border-white/20" onClick={() => setSubscriptionActive(true)}>← 決済済として有効化(デモ)</button>)}
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold">ポイント制</div>
                                <div className="text-sm text-white/70">1pt={YEN_PER_POINT}円。文字数×ランク倍率で消費。</div>
                            </div>
                            <Ribbon rank={"A"} />
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="radio" checked={plan === "points"} onChange={() => setPlan("points")} /> このプランにする
                            </label>
                            <span className="text-sm text-white/80">残高: <b>{fmtPts(points)}</b>（約{yen(points)}）</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <button className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-gray-900" onClick={() => { window.open(STRIPE_TEST_CHECKOUT_POINTS_1000, "_blank"); setPoints(points + 1000); }}>1000pt購入(約{yen(1000)})</button>
                            <button className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-gray-900" onClick={() => { window.open(STRIPE_TEST_CHECKOUT_POINTS_3000, "_blank"); setPoints(points + 3000); }}>3000pt購入(約{yen(3000)})</button>
                        </div>
                        <div className="mt-3 text-[11px] text-white/60">※ 実運用ではStripe Webhookで残高反映/サブスク状態をサーバーで管理してください。</div>
                        <div className="mt-4 text-xs text-white/70">価格例: 660円 ≒ 440pt</div>
                    </div>
                </div>
            )}

            {tab === "signup" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <h2 className="text-lg font-semibold">会員登録</h2>
                    <Input label="名前" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                    <Input label="メールアドレス" value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" />
                    <Input label="電話番号" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                    <div className="grid grid-cols-3 gap-2">
                        <Input label="郵便番号" value={profile.zipcode} onChange={(v) => setProfile({ ...profile, zipcode: v })} />
                        <div className="col-span-2"><Input label="住所" value={profile.address} onChange={(v) => setProfile({ ...profile, address: v })} /></div>
                    </div>
                                        <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-white/70">
                            {submitMsg && <span className="text-green-300">{submitMsg}</span>}
                            {submitErr && <span className="text-red-300">{submitErr}</span>}
                        </div>
                        <button
                            onClick={handleSignup}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50"
                        >
                            {submitting ? "送信中..." : "会員登録"}
                        </button>
                    </div>
                </div>
                
            )}

            {tab === "karte" && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <h2 className="text-lg font-semibold">カルテ</h2>
                    <div className="grid grid-cols-2 gap-2">
                        <Input label="生年月日" value={karte.birthdate} onChange={(v) => setKarte({ ...karte, birthdate: v })} placeholder="YYYY-MM-DD" />
                        <Input label="星座" value={karte.zodiac} onChange={(v) => setKarte({ ...karte, zodiac: v })} placeholder="例: しし座" />
                        <Input label="出生地" value={karte.birthplace} onChange={(v) => setKarte({ ...karte, birthplace: v })} />
                        <Input label="出生時間" value={karte.birthtime} onChange={(v) => setKarte({ ...karte, birthtime: v })} placeholder="例: 14:30" />
                    </div>
                    <Select label="お悩みジャンル" value={karte.genre} onChange={(v) => setKarte({ ...karte, genre: v })} options={SAMPLE_GENRES} />
                    <Textarea label="お悩み内容 (1000文字以内)" value={karte.body} onChange={(v) => { if (v.length <= 1000) setKarte({ ...karte, body: v }); }} hint={`${karte.body.length}/1000`} />
                    <div className="text-right text-xs text-white/70">保存は自動です</div>
                </div>
            )}

            <div className="text-center text-[11px] text-white/50">© {new Date().getFullYear()} Fortune Demo</div>
        </section>
    );
}

/** ============== ダミー鑑定文 ============== */
function demoReadingText() {
    const arr = [
        "あなたの直感が冴えています。焦らず、まずは目の前の小さな一歩を踏み出しましょう。",
        "心のバランスが回復しつつあります。深呼吸と短い散歩が運気を整えます。",
        "連絡は午前中が吉。素直な一言が大きな変化を生みます。",
        "変化の波が近づいています。迷った時は、最初に浮かんだ選択が正解です。",
    ];
    return arr[Math.floor(Math.random() * arr.length)];
}

export default Top;