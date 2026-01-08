import React, { useState } from "react";
// import ReactDOM from "react-dom/client";
import { useNavigate } from "react-router-dom";
import { getCookie } from "./utils/cookies";
import "./index.css";
import { useAuth } from "./AuthContext";

const csrftoken = getCookie("csrftoken");

export default function QuerentLogin() {
    const { refreshUser } = useAuth(); 
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const role = "1"
    const payload = { email, password, role };
    const navigate = useNavigate();

    async function handleLogin() {
        try {
            setSubmitting(true);
            setError(null);

            const res = await fetch("/api/user_login/", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                throw new Error("メールアドレスまたはパスワードが正しくありません。");
            }
            await refreshUser();
            const data = await res.json();
            const role = data.user_role
            switch(role){
                case "1":
                    console.log("権限は１");
                    break;
            }
            navigate("/");
        } catch (e: any) {
            setError(e.message ?? "ログインに失敗しました。");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#0c1a33] text-white flex items-start justify-center p-6 pt-16">
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
                {/* ヘッダー */}
                <div className="text-center space-y-2">
                    <div className="text-xl font-bold">相談者様ログイン</div>
                </div>

                {/* エラーメッセージ */}
                {error && (
                    <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                {/* フォーム */}
                <div className="space-y-4">
                    {/* メール */}
                    <label className="block text-sm">
                        <div className="flex items-center gap-1">
                            <span className="text-white/80">メールアドレス</span>
                            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                                必須
                            </span>
                        </div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                            placeholder="you@example.com"
                        />
                    </label>

                    {/* パスワード */}
                    <label className="block text-sm">
                        <div className="flex items-center gap-1">
                            <span className="text-white/80">パスワード</span>
                            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                                必須
                            </span>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="mt-1 w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50 focus:ring-2 focus:ring-pink-400 focus:outline-none"
                            placeholder="••••••••"
                        />
                        <div className="text-right mt-2">
                            <button
                                className="text-[11px] text-white/60 hover:text-white/80 underline underline-offset-2"
                                onClick={() => {
                                    // パスワードリセット導線に飛ばすなど
                                }}
                            >
                                パスワードをお忘れの方はこちら
                            </button>
                        </div>
                    </label>
                </div>

                {/* ボタンエリア */}
                <div className="space-y-4">
                    <button
                        onClick={handleLogin}
                        disabled={submitting}
                        className="w-full py-2 rounded-xl bg-fuchsia-700 text-white font-semibold hover:bg-fuchsia-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "認証中..." : "ログイン"}
                    </button>

                    <div className="text-center text-[11px] text-white/60 leading-relaxed">
                        まだ登録がお済みでない方は
                        <button
                            className="ml-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2"
                            onClick={() => navigate("/registration/querent")
                            }
                        >
                            新規登録はこちら
                        </button>
                    </div>
                </div>

                {/* 補助情報とかフッタ的な */}
                <div className="pt-2 border-t border-white/10 text-center">
                    <div className="text-[10px] text-white/40 leading-relaxed">
                        🔒 このページは相談者様専用の管理画面です。
                        <br />
                        占い師アカウントではログインできません。
                    </div>
                </div>
            </div>
        </div>
    );
}
