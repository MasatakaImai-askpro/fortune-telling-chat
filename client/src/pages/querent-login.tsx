import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

export default function QuerentLogin() {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  async function handleLogin() {
    try {
      setSubmitting(true);
      setError(null);
      const resp = await apiRequest("POST", "/api/user_login", { email, password, role: "1" });
      const data = await resp.json();
      if (data.user_role === "9") {
        window.location.href = "/admin";
        return;
      }
      await refreshUser();
      setLocation("/");
    } catch (e: any) {
      setError(e.message?.includes("401") ? "メールアドレスまたはパスワードが正しくありません。" : (e.message ?? "ログインに失敗しました。"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white text-gray-900 flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-md bg-white border border-pink-200 rounded-2xl p-6 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="text-xl font-bold text-gray-900" data-testid="text-page-title">相談者様ログイン</div>
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="text-error">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <label className="block text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-700">メールアドレス</span>
              <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email"
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none"
              placeholder="you@example.com" />
          </label>
          <label className="block text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-700">パスワード</span>
              <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" data-testid="input-password"
              className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none"
              placeholder="••••••••" />
          </label>
        </div>
        <div className="space-y-4">
          <button onClick={handleLogin} disabled={submitting} data-testid="button-login"
            className="w-full py-2 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "認証中..." : "ログイン"}
          </button>
          <div className="text-center">
            <button className="text-[11px] text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors" data-testid="link-forgot-password"
              onClick={() => setLocation("/password_reset_request")}>
              パスワードをお忘れの方はこちら
            </button>
          </div>
          <div className="text-center text-[11px] text-gray-600 leading-relaxed">
            まだ登録がお済みでない方は
            <button className="ml-1 text-[11px] font-semibold text-pink-600 hover:text-pink-700 underline underline-offset-2" data-testid="link-register"
              onClick={() => setLocation("/registration/querent")}>
              新規登録はこちら
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
