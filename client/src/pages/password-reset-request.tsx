import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Mail, ArrowLeft } from "lucide-react";

export default function PasswordResetRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  async function handleSubmit() {
    if (!email) {
      setError("メールアドレスを入力してください。");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setResetUrl(null);
      setMessage(null);
      const resp = await apiRequest("POST", "/api/password_reset_request", { email });
      const data = await resp.json();
      setMessage(data.message);
      if (data.reset_url) {
        setResetUrl(data.reset_url);
      }
    } catch (e: any) {
      setError(e.message ?? "リクエストに失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white text-gray-900 flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-md bg-white border border-pink-200 rounded-2xl p-6 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <Mail className="w-10 h-10 mx-auto text-pink-500" />
          <div className="text-xl font-bold text-gray-900" data-testid="text-page-title">パスワードリマインダー</div>
          <div className="text-xs text-gray-500 leading-relaxed">
            ご登録のメールアドレスを入力してください。<br />パスワードリセット用のリンクを発行します。
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="text-error">
            {error}
          </div>
        )}

        {message && !resetUrl && (
          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2" data-testid="text-message">
            {message}
          </div>
        )}

        {resetUrl && (
          <div className="space-y-3">
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2" data-testid="text-success">
              {message}
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
              <div className="text-[10px] text-gray-500 mb-1">リセットリンク（30分間有効）:</div>
              <button
                onClick={() => setLocation(resetUrl)}
                className="text-xs text-pink-600 underline underline-offset-2 break-all hover:text-pink-700 transition-colors"
                data-testid="link-reset-url">
                {window.location.origin}{resetUrl}
              </button>
            </div>
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              メール送信サービスが未設定のため、リンクを画面上に表示しています。上のリンクをクリックしてパスワードをリセットしてください。
            </div>
          </div>
        )}

        {!resetUrl && (
          <div className="space-y-4">
            <label className="block text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-700">メールアドレス</span>
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">必須</span>
              </div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email"
                className="mt-1 w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                placeholder="you@example.com"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </label>
            <button onClick={handleSubmit} disabled={submitting} data-testid="button-submit"
              className="w-full py-2 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "送信中..." : "リセットリンクを発行"}
            </button>
          </div>
        )}

        <div className="text-center">
          <button className="text-[11px] text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 mx-auto"
            data-testid="link-back-login"
            onClick={() => window.history.back()}>
            <ArrowLeft className="w-3 h-3" />
            ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
