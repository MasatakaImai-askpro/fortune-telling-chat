import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { validateEmail, validatePassword } from "@/utils/validation";

const zodiacSigns = [
  "牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
  "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"
];
const worryCategories = [
  { value: "love", label: "恋愛" },
  { value: "work", label: "仕事" },
  { value: "money", label: "金運" },
  { value: "health", label: "健康" },
  { value: "human", label: "人間関係" },
  { value: "other", label: "その他" },
];

type Fields = {
  email: string; password: string; confirmPassword: string; name: string;
  address: string; birthdate: string;
  zodiacSign: string; birthplace: string; birthtime: string;
  worryCategory: string; worryMessage: string;
};

type InputFieldProps = {
  label: string;
  field: keyof Fields;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  error?: string;
  onChange: (field: keyof Fields, value: string) => void;
};

function InputField({ label, field, type = "text", placeholder = "", required = true, value, error, onChange }: InputFieldProps) {
  return (
    <label className="block text-sm">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-gray-700">{label}</span>
        {required && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>}
      </div>
      <input type={type} value={value} onChange={(e) => onChange(field, e.target.value)} placeholder={placeholder}
        data-testid={`input-${field}`}
        className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </label>
  );
}

export default function QuerentRegistration() {
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [fields, setFields] = useState<Fields>({
    email: "", password: "", confirmPassword: "", name: "",
    address: "", birthdate: "",
    zodiacSign: "牡羊座", birthplace: "", birthtime: "",
    worryCategory: "love", worryMessage: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function set(key: keyof Fields, value: string) {
    setFields((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    e.email = validateEmail(fields.email) || undefined;
    e.password = validatePassword(fields.password) || undefined;
    if (fields.password !== fields.confirmPassword) e.confirmPassword = "パスワードが一致しません";
    if (!fields.name) e.name = "表示名は必須です";
    if (!fields.address) e.address = "住所は必須です";
    if (!fields.birthdate) e.birthdate = "生年月日は必須です";

    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v));
    setErrors(clean);
    return Object.keys(clean).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      setSubmitting(true);
      setServerError(null);
      await apiRequest("POST", "/api/register_querent", {
        email: fields.email,
        password: fields.password,
        name: fields.name,
        address: fields.address,
        birthdate: fields.birthdate,
        zodiac_sign: fields.zodiacSign,
        birthplace: fields.birthplace,
        birthtime: fields.birthtime,
        worry_category: fields.worryCategory,
        worry_message: fields.worryMessage,
      });
      await refreshUser();
      setLocation("/");
    } catch (e: any) {
      setServerError(e.message ?? "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white text-gray-900 flex items-start justify-center p-6 pt-10">
      <div className="w-full max-w-md bg-white border border-pink-200 rounded-2xl p-6 shadow-lg space-y-5">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900" data-testid="text-page-title">相談者様 新規登録</div>
          <div className="text-xs text-gray-500 mt-1">お気軽にご登録ください</div>
        </div>
        {serverError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="text-error">
            {serverError}
          </div>
        )}
        <div className="space-y-3">
          <InputField label="メールアドレス" field="email" type="email" placeholder="you@example.com" value={fields.email} error={errors.email} onChange={set} />
          <InputField label="パスワード" field="password" type="password" placeholder="英字・数字を含む8文字以上" value={fields.password} error={errors.password} onChange={set} />
          <InputField label="パスワード(確認)" field="confirmPassword" type="password" placeholder="もう一度入力" value={fields.confirmPassword} error={errors.confirmPassword} onChange={set} />
          <InputField label="表示名" field="name" placeholder="占い太郎" value={fields.name} error={errors.name} onChange={set} />
          <InputField label="住所" field="address" placeholder="東京都渋谷区..." value={fields.address} error={errors.address} onChange={set} />
          <InputField label="生年月日" field="birthdate" type="date" value={fields.birthdate} error={errors.birthdate} onChange={set} />
          <label className="block text-sm">
            <span className="text-gray-700">星座</span>
            <select value={fields.zodiacSign} onChange={(e) => set("zodiacSign", e.target.value)} data-testid="select-zodiacSign"
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none">
              {zodiacSigns.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <InputField label="出生地" field="birthplace" placeholder="東京" required={false} value={fields.birthplace} error={errors.birthplace} onChange={set} />
          <InputField label="出生時間" field="birthtime" type="time" required={false} value={fields.birthtime} error={errors.birthtime} onChange={set} />
          <label className="block text-sm">
            <span className="text-gray-700">お悩みカテゴリ</span>
            <select value={fields.worryCategory} onChange={(e) => set("worryCategory", e.target.value)} data-testid="select-worryCategory"
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none">
              {worryCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">お悩みメッセージ</span>
            <textarea value={fields.worryMessage} onChange={(e) => set("worryMessage", e.target.value)} rows={3} data-testid="textarea-worryMessage"
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-none"
              placeholder="お悩みの詳細をご記入ください..." />
          </label>
        </div>
        <button onClick={handleSubmit} disabled={submitting} data-testid="button-register"
          className="w-full py-2.5 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "登録中..." : "登録する"}
        </button>
        <div className="text-center text-[11px] text-gray-600">
          すでに登録済みの方は
          <button className="ml-1 text-pink-600 hover:text-pink-700 underline underline-offset-2" data-testid="link-login"
            onClick={() => setLocation("/querent_login")}>ログインはこちら</button>
        </div>
      </div>
    </div>
  );
}
