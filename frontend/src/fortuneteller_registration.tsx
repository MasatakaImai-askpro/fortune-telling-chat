import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Listbox, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { validateEmail, validatePhone, validateZipcode } from "./utils/validation";
import "./index.css";


const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "/api";

async function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/* ====== 型付きの共通入力コンポーネント ====== */
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    required?: boolean;
    onChange: (v: string) => void;
    hint?: string;
};

function Input({ label, onChange, required, hint, className, ...rest }: InputProps) {
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
                className={`mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none ${className ?? ""}`}
            />
            {hint && <div className="text-right text-[11px] text-white/60 mt-1">{hint}</div>}
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

/* ====== 画像アップロードコンポーネント ======
   - label: UI表示名
   - value: 現在の画像(base64 or URL)
   - onChange: 新しいbase64を親に渡す
   - shape: "square" | "round" でプレビュー形状を変える
*/
type ImageUploadProps = {
    label: string;
    required?: boolean;
    hint?: string;
    value: string;
    shape?: "square" | "round";
    onChange: (dataUrl: string) => void;
};

function ImageUpload({
    label,
    required,
    hint,
    value,
    shape = "square",
    onChange,
}: ImageUploadProps) {
    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) return;
        const dataUrl = await fileToDataURL(file);
        onChange(dataUrl);
    }

    return (
        <div className="text-sm">
            <div className="flex items-center gap-1 mb-1">
                <span className="text-white/80">{label}</span>
                {required && (
                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                        必須
                    </span>
                )}
            </div>

            <div className="flex items-start gap-4">
                {/* プレビュー */}
                <div
                    className={[
                        "bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden",
                        shape === "round"
                            ? "w-16 h-16 rounded-full"
                            : "w-24 h-32 rounded-xl",
                    ].join(" ")}
                >
                    {value ? (
                        <img
                            src={value}
                            alt="preview"
                            className={
                                shape === "round"
                                    ? "w-full h-full object-cover rounded-full"
                                    : "w-full h-full object-cover"
                            }
                        />
                    ) : (
                        <span className="text-[11px] text-white/40 text-center px-2">
                            No Image
                        </span>
                    )}
                </div>

                {/* ボタン + 注意文 */}
                <div className="flex-1 space-y-2">
                    <label className="inline-block">
                        <span className="px-3 py-2 my-10 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-[12px] text-white cursor-pointer select-none inline-block">
                            画像を選択
                        </span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFile}
                        />
                    </label>

                    {hint && (
                        <div className="text-[11px] text-white/60 leading-relaxed">
                            {hint}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


/* ====== 本体 ====== */
export default function FortunetellerRegistration() {
    type Profile = {
        name: string;
        email: string;
        headline: string;
        intro: string;
        profile_image: string;
        icon_image: string;
    };

    const [profile, setProfile] = useState<Profile>({
        name: "",
        email: "",
        headline: "",
        intro: "",
        profile_image: "",
        icon_image: "",
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
                password,
                email,
            }

            const res = await fetch(`${API_BASE}/create_fortune_user/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    function handleEmailChange(v:string){
        setEmail(v);
        setEmailError(validateEmail(v))
    }

    const nameError = profile.name ? "" : "名前を入力してください。"
    const hasErrors = !!(nameError);

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmError, setConfirmError] = useState("");

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
                <h2 className="text-lg font-semibold">占い師基本情報</h2>
                <Input label="名前" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} required />
                <Input label="メールアドレス" type="email" value={email} onChange={handleEmailChange} required />
                {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
                <Input 
                    label="紹介文（見出し・30文字以内）" 
                    value={profile.headline}
                    onChange={(v) => {
                        if(v.length <= 30) setProfile({ ...profile, headline: v }); 
                    }} 
                    hint={`${profile.headline.length}/30`}
                    required />
                <Textarea
                    label="紹介文 (詳細・1000文字以内)"
                    value={profile.intro}
                    onChange={(v) => {
                        if (v.length <= 1000) setProfile({ ...profile, intro: v });
                    }}
                    hint={`${profile.intro.length}/1000`}
                    required
                />
                <h2 className="text-lg font-semibold pt-2">プロフィール画像</h2>

                <ImageUpload
                    label="プロフィール写真（大きめに表示される顔写真など）"
                    required
                    hint="推奨：縦長OK / JPG・PNG / 2MB以下目安"
                    value={profile.profile_image}
                    shape="square"
                    onChange={(dataUrl) =>
                        setProfile({ ...profile, profile_image: dataUrl })
                    }
                />

                <ImageUpload
                    label="アイコン画像（丸く小さく表示されます）"
                    required
                    hint="推奨：正方形 / JPG・PNG / 2MB以下目安"
                    value={profile.icon_image}
                    shape="round"
                    onChange={(dataUrl) =>
                        setProfile({ ...profile, icon_image: dataUrl })
                    }
                />
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
