import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { validateEmail, validatePassword } from "@/utils/validation";

type Fields = {
  email: string; password: string; confirmPassword: string;
  name: string; headline: string; intro: string;
};

export default function FortunetellerRegistration() {
  const { refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [fields, setFields] = useState<Fields>({
    email: "", password: "", confirmPassword: "",
    name: "", headline: "", intro: "",
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
    if (!fields.name) e.name = "名前は必須です";
    if (fields.name.length > 20) e.name = "20文字以内で入力してください";
    if (!fields.headline) e.headline = "キャッチコピーは必須です";
    if (fields.headline.length > 30) e.headline = "30文字以内で入力してください";
    if (!fields.intro) e.intro = "自己紹介は必須です";

    const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v));
    setErrors(clean);
    return Object.keys(clean).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    try {
      setSubmitting(true);
      setServerError(null);
      await apiRequest("POST", "/api/register_fortuneteller", {
        email: fields.email,
        password: fields.password,
        name: fields.name,
        headline: fields.headline,
        intro: fields.intro,
      });
      await refreshUser();
      setLocation("/fortuneteller_mypage");
    } catch (e: any) {
      setServerError(e.message ?? "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  function InputField({ label, field, type = "text", placeholder = "", maxLen }: { label: string; field: keyof Fields; type?: string; placeholder?: string; maxLen?: number }) {
    return (
      <label className="block text-sm">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-gray-700">{label}</span>
          <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
          {maxLen && <span className="text-[10px] text-gray-400 ml-auto">{fields[field].length}/{maxLen}</span>}
        </div>
        <input type={type} value={fields[field]} onChange={(e) => set(field, e.target.value)} placeholder={placeholder}
          data-testid={`input-${field}`} maxLength={maxLen}
          className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
        {errors[field] && <p className="text-red-500 text-xs mt-0.5">{errors[field]}</p>}
      </label>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white text-gray-900 flex items-start justify-center p-6 pt-10">
      <div className="w-full max-w-md bg-white border border-pink-200 rounded-2xl p-6 shadow-lg space-y-5">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900" data-testid="text-page-title">占い師 新規登録</div>
          <div className="text-xs text-gray-500 mt-1">占い師としてのプロフィール情報を入力してください</div>
        </div>
        {serverError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="text-error">
            {serverError}
          </div>
        )}
        <div className="space-y-3">
          <InputField label="メールアドレス" field="email" type="email" placeholder="you@example.com" />
          <InputField label="パスワード" field="password" type="password" placeholder="英字・数字を含む8文字以上" />
          <InputField label="パスワード(確認)" field="confirmPassword" type="password" placeholder="もう一度入力" />
          <InputField label="占い師名" field="name" placeholder="占いの花" maxLen={20} />
          <InputField label="キャッチコピー" field="headline" placeholder="あなたの未来を照らします" maxLen={30} />
          <label className="block text-sm">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-gray-700">自己紹介</span>
              <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
            </div>
            <textarea value={fields.intro} onChange={(e) => set("intro", e.target.value)} rows={4} data-testid="textarea-intro"
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none resize-none"
              placeholder="ご自身の占術スタイルや得意分野をご紹介ください..." />
            {errors.intro && <p className="text-red-500 text-xs mt-0.5">{errors.intro}</p>}
          </label>
        </div>
        <button onClick={handleSubmit} disabled={submitting} data-testid="button-register"
          className="w-full py-2.5 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "登録中..." : "登録する"}
        </button>
        <div className="text-center text-[11px] text-gray-600">
          すでに登録済みの方は
          <button className="ml-1 text-pink-600 hover:text-pink-700 underline underline-offset-2" data-testid="link-login"
            onClick={() => setLocation("/fortuneteller_login")}>ログインはこちら</button>
        </div>
      </div>
    </div>
  );
}
