import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { KeyRound, ArrowLeft, CheckCircle } from "lucide-react";

export default function PasswordReset() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, setLocation] = useLocation();

  async function handleReset() {
    if (!newPassword) {
      setError("新しいパスワードを入力してください。");
      return;
    }
    if (newPassword.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const resp = await apiRequest("POST", "/api/password_reset", { token, new_password: newPassword });
      const data = await resp.json();
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "パスワードリセットに失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#3a1777_0%,#13254a_45%,#0c1a33_100%)] text-white flex items-start justify-center p-6 pt-16">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 text-center">
          <div className="text-red-300 text-sm">無効なリセットリンクです。</div>
          <button className="text-[11px] text-white/60 hover:text-white/80 transition-colors flex items-center gap-1 mx-auto"
            data-testid="link-back-login" onClick={() => setLocation("/querent_login")}>
            <ArrowLeft className="w-3 h-3" />
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,#3a1777_0%,#13254a_45%,#0c1a33_100%)] text-white flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <KeyRound className="w-10 h-10 mx-auto text-fuchsia-400" />
          <div className="text-xl font-bold" data-testid="text-page-title">パスワード再設定</div>
          <div className="text-xs text-white/60 leading-relaxed">
            新しいパスワードを入力してください。
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" data-testid="text-error">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-3 flex items-start gap-2" data-testid="text-success">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>パスワードが正常にリセットされました。新しいパスワードでログインしてください。</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLocation("/querent_login")} data-testid="link-querent-login"
                className="flex-1 py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm">
                相談者ログイン
              </button>
              <button onClick={() => setLocation("/fortuneteller_login")} data-testid="link-fortuneteller-login"
                className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/15 transition-colors text-sm">
                占い師ログイン
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              <div className="flex items-center gap-1">
                <span className="text-white/80">新しいパスワード</span>
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
              </div>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" data-testid="input-new-password"
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                placeholder="6文字以上" />
            </label>
            <label className="block text-sm">
              <div className="flex items-center gap-1">
                <span className="text-white/80">新しいパスワード（確認）</span>
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
              </div>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" data-testid="input-confirm-password"
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                placeholder="もう一度入力" />
            </label>
            <button onClick={handleReset} disabled={submitting} data-testid="button-reset"
              className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "リセット中..." : "パスワードをリセット"}
            </button>
          </div>
        )}

        {!success && (
          <div className="text-center">
            <button className="text-[11px] text-white/60 hover:text-white/80 transition-colors flex items-center gap-1 mx-auto"
              data-testid="link-back-login" onClick={() => window.history.back()}>
              <ArrowLeft className="w-3 h-3" />
              戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
