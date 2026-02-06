import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { validateEmail, validatePhone, validateZipcode, validatePassword } from "@/utils/validation";

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
  telNumber: string; postalCode: string; address: string; birthdate: string;
  zodiacSign: string; birthplace: string; birthtime: string;
  worryCategory: string; worryMessage: string;
};

export default function QuerentRegistration() {
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [fields, setFields] = useState<Fields>({
    email: "", password: "", confirmPassword: "", name: "",
    telNumber: "", postalCode: "", address: "", birthdate: "",
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
    e.telNumber = validatePhone(fields.telNumber) || undefined;
    e.postalCode = validateZipcode(fields.postalCode) || undefined;
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
        tel_number: fields.telNumber,
        postal_code: fields.postalCode,
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

  function InputField({ label, field, type = "text", placeholder = "", required = true }: { label: string; field: keyof Fields; type?: string; placeholder?: string; required?: boolean }) {
    return (
      <label className="block text-sm">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-white/80">{label}</span>
          {required && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>}
        </div>
        <input type={type} value={fields[field]} onChange={(e) => set(field, e.target.value)} placeholder={placeholder}
          data-testid={`input-${field}`}
          className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
        {errors[field] && <p className="text-red-400 text-xs mt-0.5">{errors[field]}</p>}
      </label>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#3a1777_0%,#13254a_45%,#0c1a33_100%)] text-white flex items-start justify-center p-6 pt-10">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="text-center">
          <div className="text-xl font-bold" data-testid="text-page-title">相談者様 新規登録</div>
          <div className="text-xs text-white/50 mt-1">お気軽にご登録ください</div>
        </div>
        {serverError && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" data-testid="text-error">
            {serverError}
          </div>
        )}
        <div className="space-y-3">
          <InputField label="メールアドレス" field="email" type="email" placeholder="you@example.com" />
          <InputField label="パスワード" field="password" type="password" placeholder="英字・数字を含む8文字以上" />
          <InputField label="パスワード(確認)" field="confirmPassword" type="password" placeholder="もう一度入力" />
          <InputField label="表示名" field="name" placeholder="占い太郎" />
          <InputField label="電話番号" field="telNumber" type="tel" placeholder="09012345678" />
          <InputField label="郵便番号" field="postalCode" placeholder="1234567" />
          <InputField label="住所" field="address" placeholder="東京都渋谷区..." />
          <InputField label="生年月日" field="birthdate" type="date" />
          <label className="block text-sm">
            <span className="text-white/80">星座</span>
            <select value={fields.zodiacSign} onChange={(e) => set("zodiacSign", e.target.value)} data-testid="select-zodiacSign"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none">
              {zodiacSigns.map((z) => <option key={z} value={z} className="bg-gray-800">{z}</option>)}
            </select>
          </label>
          <InputField label="出生地" field="birthplace" placeholder="東京" required={false} />
          <InputField label="出生時間" field="birthtime" type="time" required={false} />
          <label className="block text-sm">
            <span className="text-white/80">お悩みカテゴリ</span>
            <select value={fields.worryCategory} onChange={(e) => set("worryCategory", e.target.value)} data-testid="select-worryCategory"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none">
              {worryCategories.map((c) => <option key={c.value} value={c.value} className="bg-gray-800">{c.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-white/80">お悩みメッセージ</span>
            <textarea value={fields.worryMessage} onChange={(e) => set("worryMessage", e.target.value)} rows={3} data-testid="textarea-worryMessage"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-none"
              placeholder="お悩みの詳細をご記入ください..." />
          </label>
        </div>
        <button onClick={handleSubmit} disabled={submitting} data-testid="button-register"
          className="w-full py-2.5 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "登録中..." : "登録する"}
        </button>
        <div className="text-center text-[11px] text-white/60">
          すでに登録済みの方は
          <button className="ml-1 text-amber-300 hover:text-amber-200 underline underline-offset-2" data-testid="link-login"
            onClick={() => setLocation("/querent_login")}>ログインはこちら</button>
        </div>
      </div>
    </div>
  );
}
