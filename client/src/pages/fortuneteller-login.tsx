import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

export default function FortunetellerLogin() {
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
      const resp = await apiRequest("POST", "/api/user_login", { email, password, role: "2" });
      const data = await resp.json();
      if (data.user_role === "9") {
        window.location.href = "/admin";
        return;
      }
      await refreshUser();
      setLocation("/fortuneteller_mypage");
    } catch (e: any) {
      setError(e.message?.includes("401") ? "メールアドレスまたはパスワードが正しくありません。" : (e.message ?? "ログインに失敗しました。"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#3a1777_0%,#13254a_45%,#0c1a33_100%)] text-white flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="text-xl font-bold" data-testid="text-page-title">占い師ログイン</div>
          <div className="text-xs text-white/60 leading-relaxed">管理画面へのログインはこちらから</div>
        </div>
        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" data-testid="text-error">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <label className="block text-sm">
            <div className="flex items-center gap-1">
              <span className="text-white/80">メールアドレス</span>
              <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
              placeholder="you@example.com" />
          </label>
          <label className="block text-sm">
            <div className="flex items-center gap-1">
              <span className="text-white/80">パスワード</span>
              <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" data-testid="input-password"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
              placeholder="••••••••" />
          </label>
        </div>
        <div className="space-y-4">
          <button onClick={handleLogin} disabled={submitting} data-testid="button-login"
            className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "認証中..." : "ログイン"}
          </button>
          <div className="text-center text-[11px] text-white/60 leading-relaxed">
            まだ登録がお済みでない方は
            <button className="ml-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2" data-testid="link-register"
              onClick={() => setLocation("/registration/fortuneteller")}>
              新規登録はこちら
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
