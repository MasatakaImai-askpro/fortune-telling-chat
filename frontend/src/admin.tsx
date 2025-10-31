import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

type User = { id: number; username: string; email?: string };

// 環境変数。Viteなら `.env` に VITE_API_URL を入れておく(例: http://127.0.0.1:8000/api)
// もしくは Vite の proxy を使うなら "/api" にしてOK
const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "/api";

function AdminApp() {
    const [activeTab, setActiveTab] = useState("dashboard");

    // 設定タブで使う状態
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);
    const usersLoadedOnce = useRef(false); // 二重フェッチ防止
    const [message, setMessage] = useState<string | null>(null);

    // タブ変更で「設定」になったらユーザー一覧を取得
    useEffect(() => {
        if (activeTab !== "content" || usersLoadedOnce.current) return;

        const ctrl = new AbortController();
        (async () => {
            try {
            setLoadingUsers(true);
            const res = await fetch(`${API_BASE}/users/`, { signal: ctrl.signal });
            if (!res.ok) throw new Error(`status ${res.status}`);
            const data = await res.json();
            // Djangoが {"message": "..."} を返すだけなので message に格納
            if (data.message) setMessage(data.message);
            else setUsers(data); // 将来的にユーザー一覧を返す場合に備えて
            usersLoadedOnce.current = true;
            } catch (e: any) {
            if (e.name !== "AbortError") setUsersError(e.message);
            } finally {
            setLoadingUsers(false);
            }
        })();

        return () => ctrl.abort();
        }, [activeTab]);

    const tabs = [
        { id: "dashboard", label: "🏠 ダッシュボード" },
        { id: "customers", label: "👤 顧客管理" },
        { id: "advisors", label: "🧙 占い師管理" },
        { id: "sales", label: "💰 売上・振込" },
        { id: "content", label: "🛠️ 設定" }, // ← ここで API を叩く
    ];

    return (
        <div className="min-h-screen bg-[#0c1a33] text-white">
            {/* Header */}
            <div className="sticky top-0 z-20 p-4 border-b border-white/10 bg-[#0d1a33]">
                <div className="flex items-center justify-between pb-3">
                    <div className="text-xl font-bold text-pink-300">🔮 運営管理者ダッシュボード</div>
                    <button className="text-xs bg-white/10 rounded-full px-3 py-1 border border-white/20">ログアウト</button>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`tab-label rounded-lg px-4 py-2 text-sm border ${activeTab === tab.id
                                    ? "bg-white text-gray-900 font-semibold border-white"
                                    : "bg-white/5 text-white border-white/20"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                {activeTab === "dashboard" && (
                    <div>
                        <h3 className="text-2xl font-bold text-white/90">🏠 ダッシュボード (KPI)</h3>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-sm text-white/70">月間売上（円）</div>
                                <div className="text-2xl font-bold text-yellow-300 mt-1">¥1,250,000</div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                <div className="text-sm text-white/70">未対応振込申請</div>
                                <div className="text-2xl font-bold text-red-400 mt-1">3 件</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "customers" && <p>👤 顧客管理セクション</p>}
                {activeTab === "advisors" && <p>🧙 占い師管理セクション</p>}
                {activeTab === "sales" && <p>💰 売上・振込セクション</p>}

                {activeTab === "content" && (
                <div>
                    <h3 className="text-2xl font-bold text-white/90 mb-3">
                    🛠️ 設定セクション（テストAPI）
                    </h3>

                    {loadingUsers && <p>読み込み中...</p>}
                    {usersError && <p className="text-red-400">{usersError}</p>}

                    {!loadingUsers && !usersError && (
                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                        {/* Djangoからのレスポンスメッセージを表示 */}
                        <p className="text-white/80">
                        {users.length > 0
                            ? JSON.stringify(users) // usersが配列じゃなくオブジェクトでも表示できる
                            : message
                            ? message
                            : "データがありません"}
                        </p>
                    </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AdminApp />
    </React.StrictMode>
);
