import React, { useMemo, useState, useEffect } from "react";
import { getCookie } from "./utils/cookies";
import "./index.css"; // Tailwind 読み込み（必須）

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "/api";
const csrftoken = getCookie("csrftoken");

type Tab = "chat" | "profile" | "sales";

function TabButton({
    id,
    label,
    active,
    onClick,
}: {
    id: Tab;
    label: React.ReactNode;
    active: boolean;
    onClick: (id: Tab) => void;
}) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`tab-label rounded-full px-4 py-2 text-sm ${active ? "tab-selected" : ""
                }`}
        >
            {label}
        </button>
    );
}

export default function AdvisorApp() {
    const [active, setActive] = useState<Tab>("chat");
    const [sejutsuOpen, setSejutsuOpen] = useState(false);
    const [dmOpen, setDmOpen] = useState(false);
    const [dmText, setDmText] = useState("");
    const [dmTargets, setDmTargets] = useState<string[]>(["557"]); // デモ
    const tabs = useMemo(
        () => [
            { id: "chat" as const, label: "💬 チャット対応" },
            { id: "profile" as const, label: "✏️ プロフィール設定" },
            { id: "sales" as const, label: "💰 売上申請" },
        ],
        []
    );

    const toggleTarget = (id: string) =>
        setDmTargets((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    const sendDm = () => {
        if (!dmTargets.length) return alert("送信対象を選択してください。");
        if (!dmText.trim()) return alert("DMメッセージを入力してください。");
        alert(
            `DMを${dmTargets.length}名に送信しました。\n\n[送信先]: ${dmTargets.join(
                ", "
            )}\n[メッセージ]: ${dmText.slice(0, 50)}...`
        );
        setDmText("");
        setDmOpen(false);
    };

    type UserInfo = {
        name: string;
        rank: string;
        headline: string;
        intro: string;
        };

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(true);
    const [errorUserInfo, setErrorUserInfo] = useState<string | null>(null);
    const [accountType, setAccountType] = useState('普通');

    useEffect(() => {
        const fetchUserInfo = async() => {
            try {
                setLoadingUserInfo(true);
                setErrorUserInfo(null);
                const res = await fetch(`${API_BASE}/get_fortuneteller_info/`, {
                    method: "GET",
                    credentials: "include",
                });
                if (!res.ok){
                    throw new Error("failed to fetch info");
                }
                const data = await res.json();
                setUserInfo(data);
            } catch (e) {
                console.error("データ取得失敗",e);
                setErrorUserInfo("プロフィールデータを取得できませんでした。");
                setUserInfo([]);
            } finally {
                setLoadingUserInfo(false)
            ;}
        };
        fetchUserInfo();
    }, []);

    // 基本情報編集
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);
    const [submitErr, setSubmitErr] = useState<string | null>(null);

    async function fortuneProSubmission(){
        try {
            setSubmitting(true);
            setSubmitMsg(null);
            setSubmitErr(null);

            const res = await fetch(`${API_BASE}/edit_fortuneteller_pro/`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                },
                credentials: "include",
                body: JSON.stringify(userInfo),
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

    // 口座情報取得・編集
    type BankInfo = {
        name: string;
        branch_name: string;
        account_type: string;
        account_number: string;
        account_holder_name: string; 
        };

    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const [loadingBankInfo, setLoadingBankInfo] = useState(true);
    const [errorBankInfo, setErrorBankInfo] = useState<string | null>(null);

    useEffect(() => {
        const fetchBankInfo = async() => {
            try {
                setLoadingBankInfo(true);
                setErrorBankInfo(null);
                const res = await fetch(`${API_BASE}/get_fortuneteller_bank_info/`, {
                    method: "GET",
                    credentials: "include",
                });
                if (!res.ok){
                    throw new Error("failed to fetch info");
                }
                const data = await res.json();
                setBankInfo(data);
            } catch (e) {
                console.error("データ取得失敗",e);
                setErrorBankInfo("口座情報をを取得できませんでした。");
                setBankInfo([]);
            } finally {
                setLoadingBankInfo(false)
            ;}
        };
        fetchBankInfo();
    }, []);

    const [bankSubmitting, setBankSubmitting] = useState(true);
    const [bankSubMsg, setBankSubMsg] = useState<string | null>(null);
    const [bankSubErr, setBankSubErr] = useState<string | null>(null);

    async function fortuneBankSubmittion(){
        try{
            setBankSubmitting(true)
            setBankSubMsg(null)
            setBankSubErr(null)
            const res = await fetch(`${API_BASE}/edit_fortuneteller_bank_info/`,{
                method:"PUT",
                headers:{
                    "Content-type": "application/json",
                    "X-CSRFToken": csrftoken 
                },
                credentials: "include",
                body: JSON.stringify(bankInfo)
            })
            if (!res.ok) throw new Error(`status ${res.status}`);
            const data = await res.json().catch(() => ({}))
            setBankSubMsg(data.message ?? "口座情報を更新しました。")
        } catch (e:any){
            setBankSubErr(e?.message?? "口座情報の更新に失敗しました。管理者に問い合わせてください")
        } finally {
            setBankSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#3a1777_0%,#13254a_45%,#0c1a33_100%)] text-white pb-12">
            {/* Header */}
            <div className="logged-in-header sticky top-0 z-20">
                <div className="flex items-center justify-between pb-3">
                    <div className="text-lg font-bold">{userInfo?.name ?? ""}管理画面</div>
                    <button className="text-xs bg-white/10 rounded-full px-3 py-1 border border-white/20">
                        ログアウト
                    </button>
                </div>

                <div className="flex gap-3">
                    {tabs.map((t) => (
                        <TabButton
                            key={t.id}
                            id={t.id}
                            label={t.label}
                            active={active === t.id}
                            onClick={setActive}
                        />
                    ))}
                </div>
            </div>

            {/* Screens */}
            <div className="space-y-6">
                {/* ---- チャット対応 ---- */}
                {active === "chat" && (
                    <div id="content-chat" className="space-y-6">
                        <div className="space-y-4 p-4">
                            <h3 className="text-xl font-bold border-b border-white/20 pb-2">
                                💬 チャット対応
                            </h3>
                        </div>

                        <div className="px-4">
                            <button
                                onClick={() => setDmOpen(true)}
                                className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm"
                            >
                                一括DMを作成・送信 (選択顧客対象)
                            </button>
                        </div>

                        <div id="inbox-content" className="space-y-4 p-4 pt-0">
                            <h4 className="text-lg font-bold">Inbox (2件)</h4>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="relative text-left p-4 bg-white/5 border border-white/10 rounded-xl space-y-1 hover:bg-white/10 transition-colors cursor-pointer">
                                    <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-lg">相談者 #557</div>
                                        <div className="text-xs text-white/60">19:00 PM</div>
                                    </div>
                                    <div className="text-sm truncate text-white/80">
                                        冷却期間は3ヶ月ほどで、別れた原因は私の仕事の忙しさです。
                                    </div>
                                </div>

                                <div className="text-left p-4 bg-white/5 border border-white/10 rounded-xl space-y-1 hover:bg-white/10 transition-colors cursor-pointer">
                                    <div className="flex justify-between items-center">
                                        <div className="font-semibold text-lg">相談者 #618</div>
                                        <div className="text-xs text-white/60">17:30 PM</div>
                                    </div>
                                    <div className="text-sm truncate text-white/80">
                                        転職で迷っています。A社とB社のどちらが良いか、見ていただけますか？
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* チャットルーム */}
                        <div id="chatroom-design" className="mt-8">
                            <h4 className="text-lg font-bold px-4 mb-3">チャットルームデザイン</h4>
                            <div className="flex flex-col h-[70vh] bg-white/5 border border-white/10 rounded-2xl m-4">
                                <div className="p-4 border-b border-white/10 sticky top-0 bg-white/5 rounded-t-2xl z-10">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-bold truncate">相談者 #557 への返信</h3>
                                        <button className="text-xs bg-white/10 rounded-lg px-3 py-1 border border-white/20 shrink-0">
                                            Inboxに戻る
                                        </button>
                                    </div>
                                    <button className="mt-2 w-full text-xs bg-white/10 rounded-lg px-3 py-1 border border-white/20 text-white/80">
                                        ▶︎ カルテ情報を表示 (ジャンル: 恋愛 / 生年月日: 1990-01-01)
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] rounded-2xl p-3 shadow-lg bg-indigo-600">
                                            <div className="text-[10px] mb-1 text-white/70">
                                                相談者 #557・19:00 PM
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed text-white">
                                                初めまして。彼との復縁の可能性について知りたいです。
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-start">
                                        <div className="unopened-msg max-w-[80%]">
                                            <p className="text-sm font-semibold">【霊澄からの特別メッセージ】</p>
                                            <p className="text-xs mt-1">
                                                このメッセージは未開封です。開封には <strong>300 pt</strong> が必要です。
                                            </p>
                                            <button className="mt-2 py-1 px-3 bg-yellow-500 text-gray-900 rounded-full text-xs font-bold">
                                                メッセージを開封
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] rounded-2xl p-3 shadow-lg bg-indigo-600">
                                            <div className="text-[10px] mb-1 text-white/70">
                                                相談者 #557・19:30 PM
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed text-white">
                                                冷却期間は3ヶ月ほどで、別れた原因は私の仕事の忙しさです。
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
                                    {sejutsuOpen && (
                                        <div id="sejutsu-settings" className="sejutsu-panel mb-3 block">
                                            <h5 className="font-semibold text-amber-300 mb-2">
                                                ✨ 施術メッセージ設定
                                            </h5>
                                            <div className="flex items-center gap-2 mb-2">
                                                <label className="text-sm flex-shrink-0">ポイント設定:</label>
                                                <input
                                                    type="number"
                                                    defaultValue={500}
                                                    className="w-20 rounded-lg bg-black/30 border border-amber-400/50 px-2 py-1 text-sm text-yellow-300"
                                                />
                                                <span className="text-sm">pt</span>
                                            </div>
                                            <label className="block text-xs text-white/70">
                                                ファイルや画像も添付可能です。このメッセージは顧客側でポイントを消費して開封されます。
                                            </label>
                                            <button
                                                onClick={() => setSejutsuOpen(false)}
                                                className="mt-3 py-1 px-3 text-xs bg-white/20 rounded-lg"
                                            >
                                                設定を閉じる
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <textarea
                                            placeholder="ご鑑定の返信を入力..."
                                            className="flex-1 bg-black/10 outline-none resize-none text-sm max-h-28 min-h-[44px] placeholder:text-white/50 rounded-xl px-3 py-2"
                                        />
                                        <div className="flex flex-col gap-2">
                                            <button className="rounded-xl bg-pink-500 text-white px-5 py-2 text-sm font-semibold hover:bg-pink-600 transition-colors">
                                                返信 (通常)
                                            </button>
                                            <button className="rounded-xl bg-indigo-500 text-white px-5 py-2 text-sm font-semibold hover:bg-indigo-600 transition-colors">
                                                鑑定結果送信 (文字数課金)
                                            </button>
                                            <button
                                                onClick={() => setSejutsuOpen(true)}
                                                className="rounded-xl bg-amber-500 text-gray-900 px-5 py-2 text-sm font-semibold hover:bg-amber-600 transition-colors"
                                            >
                                                施術メッセージ送信
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ---- プロフィール設定 ---- */}
                {active === "profile" && (
                    <div id="content-profile" className="space-y-4 p-4">
                        <h3 className="text-xl font-bold border-b border-white/20 pb-2">
                            ✏️ プロフィール設定
                        </h3>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <h4 className="text-lg font-semibold text-pink-300">
                                顧客向け公開情報
                            </h4>
                            <label className="block text-sm">
                                <span className="text-white/80">名前</span>
                                <input
                                    type="text"
                                    value={ userInfo?.name || ""}
                                    onChange={(e) =>
                                        setUserInfo((prev) => ({
                                        ...(prev ?? {} as UserInfo),
                                        name: e.target.value
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="text-white/80">ランク (変更不可)</span>
                                <input
                                    type="text"
                                    value={ userInfo?.rank || ""}
                                    disabled
                                    className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="text-white/80">見出し (Headline) - 30文字以内</span>
                                <input
                                    type="text"
                                    value={ userInfo?.headline || ""}
                                    onChange={(e) =>
                                        setUserInfo((prev) => ({
                                        ...(prev ?? {} as UserInfo),
                                        headline: e.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="text-white/80">紹介文 (Intro) - 1000文字以内</span>
                                <textarea
                                    rows={6}
                                    value={ userInfo?.intro || ""}
                                    onChange={(e) =>
                                        setUserInfo((prev) => ({
                                            ...(prev ?? {} as UserInfo),
                                            intro: e.target.value,
                                        }))
                                    }
                                    className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                />
                            </label>
                            <div className="text-xs text-white/70">
                                {submitMsg && <span className="text-green-300">{submitMsg}</span>}
                                {submitErr && <span className="text-red-300">{submitErr}</span>}
                            </div>
                            <button
                                onClick={fortuneProSubmission}
                                disabled={submitting}
                                className="w-full py-2 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-200 transition-colors"
                            >
                                {submitting ? "送信中..." : "公開情報更新"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ---- 売上申請 ---- */}
                {active === "sales" && (
                    <div id="content-sales" className="space-y-4 p-4">
                        <h3 className="text-xl font-bold border-b border-white/20 pb-2">
                            💰 売上・振込申請
                        </h3>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <h4 className="text-lg font-semibold text-pink-300">現在の売上状況</h4>
                            <div className="flex justify-between text-sm">
                                <div className="text-white/70">総売上（累計）:</div>
                                <div className="font-bold text-white">30,000円</div>
                            </div>
                            <div className="flex justify-between text-lg font-bold">
                                <div className="text-white/70">振込可能残高:</div>
                                <div className="text-yellow-300">25,000円</div>
                            </div>
                            <div className="text-xs text-white/60 pt-2 border-t border-white/10">
                                ※ 1pt = 1.0円換算 (デモ)
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <h4 className="text-lg font-semibold text-amber-300">振込先口座情報</h4>
                            <p className="text-sm text-white/70">
                                振込申請を行うには、銀行口座情報を登録してください。
                            </p>
                            <div className="space-y-1">
                                <label className="block text-xs">
                                    <span className="text-white/80">銀行名</span>
                                    <input
                                        type="text"
                                        value={ bankInfo?.name || ""}
                                        onChange={(e) =>
                                            setBankInfo((prev) => ({
                                                ...(prev ?? {} as BankInfo),
                                                name: e.target.value
                                            }))
                                        }
                                        className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                    />
                                </label>
                                <label className="block text-xs">
                                    <span className="text-white/80">支店名</span>
                                    <input
                                        type="text"
                                        value={ bankInfo?.branch_name || ""}
                                        onChange={(e) =>
                                            setBankInfo((prev) => ({
                                                ...(prev ?? {} as BankInfo),
                                                branch_name: e.target.value
                                            }))
                                        }
                                        className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                    />
                                </label>
                                <label className="block text-xs">
                                    <span className="text-white/80">口座種別</span>
                                    <select
                                        value={ bankInfo?.account_type}
                                        onChange={(e) =>
                                            setBankInfo((prev) => ({
                                                ...(prev ?? {} as BankInfo),
                                                account_type: e.target.value
                                            }))
                                        }
                                        className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white/80"
                                    >
                                        <option value="普通">普通</option>
                                        <option value="当座">当座</option>
                                        <option value="貯蓄">貯蓄</option>
                                    </select>
                                </label>
                                <label className="block text-xs">
                                    <span className="text-white/80">口座番号</span>
                                    <input
                                        type="text"
                                        maxlength={7}
                                        pattern="\d*"
                                        value={ bankInfo?.account_number || ""}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;
                                            const numericValue = inputValue.replace(/[^0-9]/g, ''); 
                                            const limitedValue = numericValue.slice(0, 7);
                                            setBankInfo((prev) => ({
                                                ...(prev ?? {} as BankInfo), 
                                                account_number: limitedValue 
                                            }));
                                        }}
                                        className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                    />
                                </label>
                                <label className="block text-xs">
                                    <span className="text-white/80">口座名義（カナ）</span>
                                    <input
                                        type="text"
                                        value={ bankInfo?.account_holder_name }
                                        onChange={(e) =>
                                            setBankInfo((prev) => ({
                                                ...(prev ?? {} as BankInfo),
                                                account_holder_name: e.target.value
                                            }))
                                        }

                                        className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                                    />
                                </label>
                            </div>
                            <div className="text-xs text-white/70">
                                {errorBankInfo && <span className="text-red-300">{errorBankInfo}</span>}
                                {bankSubMsg && <span className="text-green-300">{bankSubMsg}</span>}
                                {bankSubErr && <span className="text-red-300">{bankSubErr}</span>}
                            </div>
                            <button
                                onClick={fortuneBankSubmittion}
                                // disabled={bankSubmitting}
                                className="w-full py-2 rounded-xl bg-white/20 text-white font-semibold hover:bg-white/30 transition-colors text-sm"
                            >
                                {/* {bankSubmitting ? "送信中..." : "口座情報編集"} */}
                                口座情報更新
                            </button>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                            <h4 className="text-lg font-semibold">振込申請</h4>
                            <p className="text-sm text-white/80">
                                振込可能残高の<strong>全額 (25,000円)</strong> を申請します。
                            </p>
                            <button className="w-full py-2 rounded-xl bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-colors">
                                全額 (25,000円) を申請
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* DM モーダル */}
            {dmOpen && (
                <div className="dm-modal-overlay flex">
                    <div className="dm-modal-content">
                        <div className="p-4 border-b border-white/10">
                            <h4 className="text-lg font-bold">DM送信対象の選択</h4>
                            <p className="text-xs text-white/60 mt-1">
                                トーク履歴のある顧客を最大30件表示します。
                            </p>
                        </div>

                        <div className="dm-customer-list px-4 py-3 space-y-2">
                            {[
                                { id: "557", label: "相談者 #557 (最終: 1日前)" },
                                { id: "618", label: "相談者 #618 (最終: 3日前)" },
                                { id: "801", label: "相談者 #801 (最終: 1週間前)" },
                            ].map((c) => (
                                <label
                                    key={c.id}
                                    className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer"
                                >
                                    <span className="text-sm">{c.label}</span>
                                    <input
                                        type="checkbox"
                                        checked={dmTargets.includes(c.id)}
                                        onChange={() => toggleTarget(c.id)}
                                        className="h-4 w-4 text-fuchsia-600 rounded border-gray-300 focus:ring-fuchsia-500"
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="p-4 border-t border-white/10 space-y-3">
                            <textarea
                                value={dmText}
                                onChange={(e) => setDmText(e.target.value)}
                                placeholder="DMメッセージを入力..."
                                className="w-full rounded-lg bg-black/30 border border-white/20 px-3 py-2 text-sm resize-none"
                                rows={3}
                            />
                            <div className="flex justify-between gap-3">
                                <button
                                    onClick={() => setDmOpen(false)}
                                    className="flex-1 py-2 rounded-xl bg-white/10 text-white font-semibold"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={sendDm}
                                    className="flex-1 py-2 rounded-xl bg-fuchsia-600 text-white font-semibold"
                                >
                                    選択した顧客へ送信
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
