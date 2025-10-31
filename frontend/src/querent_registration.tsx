import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Listbox, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { validateEmail, validatePhone, validateZipcode } from "./utils/validation";
import { getCookie } from "./utils/cookies";
import "./index.css";

const csrftoken = getCookie("csrftoken");

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "/api";

/* ====== 型付きの共通入力コンポーネント ====== */
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    required?: boolean;
    onChange: (v: string) => void;
};

function Input({ label, onChange, required, className, ...rest }: InputProps) {
    return (
        <label className="block text-sm">
            <div className="flex items-center gap-1">
                <span className="text-white/80">{label}</span>
                {required && (
                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                        必須
                    </span>
                )}
            </div>
            <input
                {...rest}
                onChange={(e) => onChange(e.target.value)}
                className={`mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 ${className ?? ""}`}
            />
        </label>
    );
}

type DarkSelectProps = {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
    required?: boolean; // ← 追加
};

export function DarkSelect({
    label,
    value,
    onChange,
    options,
    placeholder = "選択してください",
    required = false,
}: DarkSelectProps) {
    const selected = value || "";

    return (
        <label className="block text-sm">
            <div className="flex items-center gap-1">
                <span className="text-white/80">{label}</span>
                {required && (
                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                        必須
                    </span>
                )}
            </div>

            <Listbox value={selected} onChange={onChange}>
                <div className="relative mt-1">
                    {/* トリガーボタン */}
                    <Listbox.Button
                        className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-left text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-400"
                    >
                        <span className={selected ? "" : "text-white/50"}>
                            {selected || placeholder}
                        </span>
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3">▾</span>
                    </Listbox.Button>

                    {/* ポップアップ */}
                    <Transition
                        as={Fragment}
                        leave="transition ease-in duration-100"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <Listbox.Options className="absolute z-30 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-[#0d1a33] border border-white/15 py-1 text-sm shadow-xl focus:outline-none">
                            <Listbox.Option
                                key="__placeholder__"
                                value=""
                                className={({ active }) =>
                                    `cursor-pointer select-none px-3 py-2 text-white/70 ${active ? "bg-white/10" : ""
                                    }`
                                }
                            >
                                選択してください
                            </Listbox.Option>

                            {options.map((opt) => (
                                <Listbox.Option
                                    key={opt}
                                    value={opt}
                                    className={({ active, selected }) =>
                                        [
                                            "cursor-pointer select-none px-3 py-2",
                                            active ? "bg-white/10 text-white" : "text-white/90",
                                            selected ? "font-semibold bg-pink-500/20" : "",
                                        ].join(" ")
                                    }
                                >
                                    {opt}
                                </Listbox.Option>
                            ))}
                        </Listbox.Options>
                    </Transition>
                </div>
            </Listbox>
        </label>
    );
}

type TextareaProps = {
    label: string;
    value: string;
    onChange: (v: string) => void;
    hint?: string;
    required?: boolean;
    placeholder?: string;
};

function Textarea({ label, value, onChange, hint, required = false, placeholder }: TextareaProps) {
    return (
        <label className="block text-sm">
            <div className="flex items-center gap-1">
                <span className="text-white/80">{label}</span>
                {required && (
                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                        必須
                    </span>
                )}
            </div>
            <textarea
                rows={6}
                value={value}
                required={required}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
                placeholder={placeholder}
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
            />
            {hint && <div className="text-right text-[11px] text-white/60 mt-1">{hint}</div>}
        </label>
    );
}

/* 選択肢 */
const SAMPLE_GENRES = ["恋愛", "仕事", "人間関係", "金運", "健康"];
const ZODIAC_SIGN = ["牡羊座", "牡牛座", "双子座", "蟹座", "獅子座", "乙女座", "天秤座", "蠍座", "射手座", "山羊座", "水瓶座", "魚座"];

/* ====== 本体 ====== */
export default function QuerentRegistration() {
    type Profile = {
        name: string;
        email: string;
        phone: string;
        zipcode: string;
        address: string;
    };
    type Karte = {
        birthdate: string;
        zodiac: string;
        birthplace: string;
        birthtime: string;
        genre: string;
        body: string;
    };

    const [profile, setProfile] = useState<Profile>({
        name: "",
        email: "",
        phone: "",
        zipcode: "",
        address: "",
    });
    const [karte, setKarte] = useState<Karte>({
        birthdate: "",
        zodiac: "",
        birthplace: "",
        birthtime: "",
        genre: "",
        body: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);
    const [submitErr, setSubmitErr] = useState<string | null>(null);

    async function handleSignup() {
        try {
            setSubmitting(true);
            setSubmitMsg(null);
            setSubmitErr(null);

            const payload = {
                ...profile,
                ...karte,
                confirm,
                email,
                phone,
                zipcode
            }

            const res = await fetch(`${API_BASE}/create_querent_user/`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`status ${res.status}`);
            const data = await res.json().catch(() => ({}));
            setSubmitMsg(data.message ?? "登録しました");
        } catch (e: any) {
            setSubmitErr(e?.message ?? "登録に失敗しました");
        } finally {
            setSubmitting(false);
        }
    }

    // 入力項目のバリデーション
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");

    function handleEmailChange(v: string) {
        setEmail(v);
        setEmailError(validateEmail(v))
    }

    const [phone, setPhone] = useState("");
    const [phoneError, setPhoneError] = useState("")

    function handlePhoneChange(v: string) {
        setPhone(v);
        setPhoneError(validatePhone(v))
    }

    const [zipcode, setZipcode] = useState("");
    const [zipcodeError, setZipcodeError] = useState("");

    function handleZipcodeChange(v: string) {
        setZipcode(v);
        setZipcodeError(validateZipcode(v))
    }

    const nameError = profile.name ? "" : "名前を入力してください。"
    const addressError = profile.address ? "" : "住所を入力してください。"
    const birthdateError = karte.birthdate ? "" : "生年月日を入力してください。"
    const zodiacError = karte.zodiac ? "" : "星座を選択してください。"
    const birthplaceError = karte.birthplace ? "" : "出生地を入力してください。"
    const birthtimeError = karte.birthtime ? "" : "出生時間を選択してください。"
    const genreError = karte.genre ? "" : "お悩みジャンルを選択してください。"
    const bodyError = karte.body ? "" : "お悩み内容を入力してください。"


    const hasErrors = !!(nameError || addressError || birthdateError || zodiacError || birthplaceError || birthtimeError || genreError || bodyError);

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmError, setConfirmError] = useState("");

    // 例: パスワード最低条件（お好みで調整）
    function validatePassword(v: string) {
        if (!v) return "パスワードは必須です";
        if (v.length < 8) return "8文字以上で入力してください";
        if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "英字と数字を含めてください";
        return "";
    }

    function handlePasswordChange(v: string) {
        setPassword(v);
        const err = validatePassword(v);
        setPasswordError(err);
        // 確認欄が埋まっていれば一致チェックも即時
        if (confirm) setConfirmError(v === confirm ? "" : "パスワードが一致しません");
    }

    function handleConfirmChange(v: string) {
        setConfirm(v);
        setConfirmError(v === password ? "" : "パスワードが一致しません");
    }

    return (
        <div className="min-h-screen bg-[#0c1a33] text-white flex justify-center p-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 w-full">
                <h2 className="text-lg font-semibold">相談者様基本情報</h2>
                <Input label="名前" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} required />
                <Input label="メールアドレス" type="email" value={email} onChange={handleEmailChange} required />
                {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
                <Input label="電話番号(ハイフンなし)" value={phone} onChange={handlePhoneChange} required />
                {phoneError && <p className="text-red-400 text-xs mt-1">{phoneError}</p>}
                <div className="grid grid-cols-3 gap-2">
                    <Input label="郵便番号(ハイフンなし)" value={zipcode} onChange={handleZipcodeChange} required />
                    {zipcodeError && <p className="text-red-400 text-xs mt-1">{zipcodeError}</p>}
                    <div className="col-span-2">
                        <Input label="住所" value={profile.address} onChange={(v) => setProfile({ ...profile, address: v })} required />
                    </div>
                </div>
                <h2 className="text-lg font-semibold mt-4">パスワード</h2>
                <Input
                    label="パスワード"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                />
                {passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}

                <Input
                    label="パスワード（確認用）"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={handleConfirmChange}
                    required
                />
                {confirmError && <p className="text-red-400 text-xs mt-1">{confirmError}</p>}

                <h2 className="text-lg font-semibold">カルテ</h2>
                <div className="grid grid-cols-2 gap-2">
                    <Input label="生年月日" type="date" value={karte.birthdate} onChange={(v) => setKarte({ ...karte, birthdate: v })} placeholder="YYYY-MM-DD" required />
                    <DarkSelect label="星座" value={karte.zodiac} onChange={(v) => setKarte({ ...karte, zodiac: v })} options={ZODIAC_SIGN} required />
                    <Input label="出生地" value={karte.birthplace} onChange={(v) => setKarte({ ...karte, birthplace: v })} required />
                    <Input label="出生時間" type="time" value={karte.birthtime} onChange={(v) => setKarte({ ...karte, birthtime: v })} placeholder="例: 14:30" required />
                </div>
                <DarkSelect label="お悩みジャンル" value={karte.genre} onChange={(v) => setKarte({ ...karte, genre: v })} options={SAMPLE_GENRES} required />
                <Textarea
                    label="お悩み内容 (1000文字以内)"
                    value={karte.body}
                    onChange={(v) => {
                        if (v.length <= 1000) setKarte({ ...karte, body: v });
                    }}
                    hint={`${karte.body.length}/1000`}
                    required
                />

                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-white/70">
                        {submitMsg && <span className="text-green-300">{submitMsg}</span>}
                        {submitErr && <span className="text-red-300">{submitErr}</span>}
                    </div>
                    <button
                        onClick={handleSignup}
                        disabled={hasErrors || submitting}
                        className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50"
                    >
                        {submitting ? "送信中..." : "会員登録"}
                    </button>
                </div>
            </div>
        </div>
    );
}