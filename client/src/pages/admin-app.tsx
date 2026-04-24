import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeftRight, Users, LogOut, Star, ChevronLeft, Edit2, Trash2, X, Check, Crown, Sparkles, Search, Image, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

type RankedAdvisor = {
  rank_position: number;
  user_id: number;
  name: string;
  headline: string;
  rank: string;
  rank_label: string;
  revenue: number;
  cashable: number;
  is_recommended: boolean;
  style: string;
  icon_image: string;
};

type TransferRequest = {
  id: number;
  fortuneteller_id: number;
  fortuneteller_name: string;
  amount: number;
  status: string;
  requested_at: string;
  approved_at: string | null;
  scheduled_transfer_date: string | null;
  transferred_at: string | null;
};

type AdminUser = {
  id: number;
  email: string;
  role: string;
  role_label: string;
  created_at: string;
  profile_name: string | null;
  rank: string | null;
  rank_label: string | null;
  points: number | null;
  is_subscription: boolean | null;
};

const rankLabel: Record<string, string> = {
  NORMAL: "ノーマル", BRONZE: "ブロンズ", SILVER: "シルバー", GOLD: "ゴールド",
  PLATINUM: "プラチナ", PLATINUM_PLUS: "プラチナ+",
  DIAMOND: "ダイヤモンド", DIAMOND_PLUS: "ダイヤモンド+",
};
const rankMult: Record<string, number> = {
  NORMAL: 6, BRONZE: 10, SILVER: 14, GOLD: 16,
  PLATINUM: 18, PLATINUM_PLUS: 20, DIAMOND: 22, DIAMOND_PLUS: 24,
};
const statusLabel: Record<string, string> = { pending: "申請中", approved: "承認済み", transferred: "送金済み" };
const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-700",
  transferred: "bg-emerald-100 text-emerald-700",
};

function RecommendTab() {
  const queryClient = useQueryClient();
  const { data: advisors, isLoading } = useQuery<RankedAdvisor[]>({ queryKey: ["/api/admin/ranking"] });
  const [saving, setSaving] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function toggleRecommended(userId: number, current: boolean) {
    setSaving(userId);
    try {
      await apiRequest("PATCH", `/api/admin/ranking/${userId}`, {
        is_recommended: !current,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ranking"] });
    } catch (e: any) {
      alert(e.message || "更新に失敗しました");
    } finally {
      setSaving(null);
    }
  }

  const filtered = useMemo(() => {
    if (!advisors) return [];
    if (!searchTerm.trim()) return advisors;
    const q = searchTerm.toLowerCase();
    return advisors.filter((a) => a.name.toLowerCase().includes(q) || a.headline.toLowerCase().includes(q));
  }, [advisors, searchTerm]);

  const recommendedCount = useMemo(() => (advisors ?? []).filter((a) => a.is_recommended).length, [advisors]);

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-500">読み込み中...</div>;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="px-4 py-3 border-b border-pink-200 space-y-2">
        <h2 className="text-base font-bold flex items-center gap-2" data-testid="text-recommend-title">
          <Sparkles className="w-5 h-5 text-pink-600" />
          おすすめ管理
        </h2>
        <p className="text-[11px] text-gray-500">相談者トップページに表示される「おすすめの占い師」を設定します。</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-gray-500">現在 <span className="font-bold text-pink-600" data-testid="text-recommend-count">{recommendedCount}</span> 名がおすすめ</span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="名前・ヘッドラインで検索"
            data-testid="input-recommend-search"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-pink-50 border border-pink-200 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="divide-y divide-pink-100">
        {filtered.map((a) => (
          <div key={a.user_id} className="px-4 py-3 flex items-center gap-3" data-testid={`recommend-row-${a.user_id}`}>
            {a.icon_image ? (
              <img src={a.icon_image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-pink-400">{a.name.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{a.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-800">{a.rank_label || rankLabel[a.rank] || a.rank}</span>
              </div>
              <div className="text-xs text-gray-500 truncate">{a.headline}</div>
            </div>
            <button
              onClick={() => toggleRecommended(a.user_id, a.is_recommended)}
              disabled={saving === a.user_id}
              data-testid={`button-toggle-recommend-${a.user_id}`}
              className={`flex-shrink-0 text-[11px] px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                a.is_recommended
                  ? "bg-pink-600 border-pink-500 text-white"
                  : "bg-pink-50 border-pink-200 text-gray-500"
              }`}
            >
              <Star className="w-3 h-3 inline mr-1" />
              {a.is_recommended ? "おすすめ中" : "おすすめにする"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransfersTab() {
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useQuery<TransferRequest[]>({ queryKey: ["/api/admin/transfer_requests"] });
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleApprove(id: number) {
    if (!scheduledDate) { alert("振込予定日を指定してください"); return; }
    setSaving(true);
    try {
      await apiRequest("POST", `/api/admin/transfer_requests/${id}/approve`, {
        scheduled_transfer_date: scheduledDate,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer_requests"] });
      setApprovingId(null);
      setScheduledDate("");
    } catch (e: any) {
      alert(e.message || "承認に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-500">読み込み中...</div>;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="px-4 py-3 border-b border-pink-200">
        <h2 className="text-base font-bold flex items-center gap-2" data-testid="text-transfers-title">
          <ArrowLeftRight className="w-5 h-5 text-blue-400" />
          振込申請の承認
        </h2>
        <p className="text-[11px] text-gray-500 mt-1">承認して振込予定日を登録。期日を過ぎると自動的に送金済みになります。</p>
      </div>
      {(requests ?? []).length === 0 ? (
        <div className="text-center text-gray-400 text-sm pt-12">振込申請はありません</div>
      ) : (
        <div className="divide-y divide-pink-100">
          {(requests ?? []).map((r) => (
            <div key={r.id} className="px-4 py-3 space-y-2" data-testid={`transfer-row-${r.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{r.fortuneteller_name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${statusColor[r.status] || "bg-pink-50 text-gray-600"}`}>
                  {statusLabel[r.status] || r.status}
                </span>
                <span className="text-sm font-bold text-amber-600">{r.amount.toLocaleString()}円</span>
              </div>
              <div className="text-[10px] text-gray-400 space-y-0.5">
                <div>申請日: {new Date(r.requested_at).toLocaleDateString("ja-JP")}</div>
                {r.approved_at && <div>承認日: {new Date(r.approved_at).toLocaleDateString("ja-JP")}</div>}
                {r.scheduled_transfer_date && <div>振込予定日: {new Date(r.scheduled_transfer_date).toLocaleDateString("ja-JP")}</div>}
                {r.transferred_at && <div>送金日: {new Date(r.transferred_at).toLocaleDateString("ja-JP")}</div>}
              </div>
              {r.status === "pending" && (
                approvingId === r.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                      data-testid={`input-transfer-date-${r.id}`}
                      className="text-[11px] rounded-lg bg-pink-50 border border-pink-200 px-2 py-1 text-gray-900" />
                    <button onClick={() => handleApprove(r.id)} disabled={saving} data-testid={`button-confirm-approve-${r.id}`}
                      className="text-[11px] px-3 py-1 rounded-lg bg-emerald-600 text-white hover-elevate active-elevate-2 disabled:opacity-50">
                      承認する
                    </button>
                    <button onClick={() => { setApprovingId(null); setScheduledDate(""); }} data-testid={`button-cancel-approve-${r.id}`}
                      className="text-[11px] px-2 py-1 rounded-lg bg-pink-50 text-gray-700 hover-elevate active-elevate-2">
                      取消
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setApprovingId(r.id)} data-testid={`button-approve-${r.id}`}
                    className="text-[11px] px-3 py-1 rounded-lg bg-blue-600 text-white hover-elevate active-elevate-2">
                    承認する
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserManagementTab() {
  const queryClient = useQueryClient();
  const { data: allUsers, isLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRank, setEditRank] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editSub, setEditSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = (allUsers ?? []).filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (searchTerm && !u.email.includes(searchTerm) && !(u.profile_name || "").includes(searchTerm)) return false;
    return true;
  });

  function startEdit(u: AdminUser) {
    setEditingUser(u);
    setEditName(u.profile_name || "");
    setEditEmail(u.email);
    setEditRank(u.rank || "");
    setEditPoints(u.points != null ? String(u.points) : "");
    setEditSub(u.is_subscription ?? false);
  }

  async function saveEdit() {
    if (!editingUser) return;
    setSaving(true);
    try {
      const body: any = { email: editEmail };
      if (editingUser.role === "2") {
        body.profile_name = editName;
        body.rank = editRank;
      }
      if (editingUser.role === "1") {
        body.profile_name = editName;
        body.points = parseInt(editPoints) || 0;
        body.is_subscription = editSub;
      }
      await apiRequest("PATCH", `/api/admin/users/${editingUser.id}`, body);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
    } catch (e: any) {
      alert(e.message || "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("このユーザーを退会処理しますか？この操作は取り消せません。")) return;
    setDeletingId(id);
    try {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    } catch (e: any) {
      alert(e.message || "退会処理に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-500">読み込み中...</div>;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="px-4 py-3 border-b border-pink-200 space-y-2">
        <h2 className="text-base font-bold flex items-center gap-2" data-testid="text-users-title">
          <Users className="w-5 h-5 text-emerald-400" />
          ユーザー管理
        </h2>
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="メール・名前で検索..." data-testid="input-admin-user-search"
          className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[{ value: "all", label: "全て" }, { value: "1", label: "相談者" }, { value: "2", label: "占い師" }, { value: "9", label: "管理者" }].map((f) => (
            <button key={f.value} onClick={() => setFilterRole(f.value)} data-testid={`filter-role-${f.value}`}
              className={`text-[11px] px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                filterRole === f.value
                  ? "bg-pink-600 border-pink-500 text-white"
                  : "bg-pink-50 border-pink-200 text-gray-500 hover:text-gray-700"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400">{filtered.length}件</div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-pink-200 rounded-2xl w-full max-w-sm p-4 space-y-3" data-testid="modal-edit-user">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">ユーザー編集 (ID: {editingUser.id})</h3>
              <button onClick={() => setEditingUser(null)} data-testid="button-close-edit-modal">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-gray-600 block mb-1">メールアドレス</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} data-testid="input-edit-email"
                  className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
              </div>
              {(editingUser.role === "1" || editingUser.role === "2") && (
                <div>
                  <label className="text-[11px] text-gray-600 block mb-1">名前</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="input-edit-name"
                    className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
                </div>
              )}
              {editingUser.role === "2" && (
                <div>
                  <label className="text-[11px] text-gray-600 block mb-1">ランク（1文字あたりの消費pt）</label>
                  <div className="grid grid-cols-2 gap-1">
                    {["NORMAL", "BRONZE", "SILVER", "GOLD", "PLATINUM", "PLATINUM_PLUS", "DIAMOND", "DIAMOND_PLUS"].map((r) => (
                      <button key={r} onClick={() => setEditRank(r)} data-testid={`button-edit-rank-${r}`}
                        className={`text-[10px] px-2 py-1.5 rounded-lg border transition-colors text-left ${
                          editRank === r ? "bg-pink-600 border-pink-500 text-white" : "bg-pink-50 border-pink-200 text-gray-600"
                        }`}>
                        {rankLabel[r]} <span className="opacity-70">{rankMult[r]}pt</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {editingUser.role === "1" && (
                <>
                  <div>
                    <label className="text-[11px] text-gray-600 block mb-1">ポイント</label>
                    <input type="number" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} data-testid="input-edit-points"
                      className="w-full rounded-xl bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-pink-400 focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-600">サブスク会員:</label>
                    <button onClick={() => setEditSub(!editSub)} data-testid="button-edit-sub"
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                        editSub ? "bg-amber-600 border-amber-500 text-white" : "bg-pink-50 border-pink-200 text-gray-500"
                      }`}>
                      {editSub ? "有効" : "無効"}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveEdit} disabled={saving} data-testid="button-save-user"
                className="text-[11px] px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover-elevate active-elevate-2 disabled:opacity-50">
                保存
              </button>
              <button onClick={() => setEditingUser(null)} data-testid="button-cancel-edit"
                className="text-[11px] px-4 py-1.5 rounded-lg bg-pink-50 text-gray-700 hover-elevate active-elevate-2">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-pink-100">
        {filtered.map((u) => (
          <div key={u.id} className="px-4 py-3 flex items-center gap-3" data-testid={`user-row-${u.id}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{
              background: u.role === "9" ? "linear-gradient(135deg, #dc2626, #f59e0b)" : u.role === "2" ? "linear-gradient(135deg, #7c3aed, #ec4899)" : "linear-gradient(135deg, #3b82f6, #06b6d4)",
            }}>
              {u.role === "9" ? <Crown className="w-4 h-4" /> : (u.profile_name || u.email).charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" data-testid={`text-user-name-${u.id}`}>{u.profile_name || u.email}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  u.role === "9" ? "bg-red-100 text-red-700" : u.role === "2" ? "bg-pink-100 text-pink-800" : "bg-blue-100 text-blue-700"
                }`}>{u.role_label}</span>
                {u.rank && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-pink-50 text-gray-600">{u.rank_label || rankLabel[u.rank] || u.rank}</span>}
                {u.is_subscription && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">サブスク</span>}
              </div>
              <div className="text-[10px] text-gray-300 truncate">{u.email}</div>
              {u.points != null && <div className="text-[10px] text-gray-300">{u.points}pt</div>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {u.role !== "9" && (
                <>
                  <button onClick={() => startEdit(u)} data-testid={`button-edit-user-${u.id}`}
                    className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(u.id)} disabled={deletingId === u.id} data-testid={`button-delete-user-${u.id}`}
                    className="p-1.5 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = "recommend" | "transfers" | "users" | "images" | "stripe";

type SyncResult = {
  id: number;
  querentId: number;
  stripeSubId: string;
  dbStatus: string;
  stripeStatus: string;
  action: string;
};

function StripeSyncTab() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [error, setError] = useState("");

  async function runSync() {
    setRunning(true);
    setError("");
    setResults(null);
    try {
      const res = await apiRequest("POST", "/api/admin/sync_subscriptions", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "同期に失敗しました");
      setResults(data.results);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const fixed = results?.filter((r) => r.action !== "none" && r.action !== "error") ?? [];
  const errored = results?.filter((r) => r.action === "error") ?? [];
  const mismatch = results?.filter((r) => r.action !== "none") ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4">
        <h2 className="font-bold text-gray-900 mb-1 text-sm">Stripe サブスクリプション同期</h2>
        <p className="text-xs text-gray-500 mb-3">
          DB上の全サブスクリプションとStripe側の状態を照合します。<br />
          「DBは解約済みだがStripeはアクティブ」のものは自動でStripe側をキャンセルします。<br />
          「DBはアクティブだがStripeはキャンセル済み」のものはDB側を解約状態に更新します。
        </p>
        {error && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        <button
          onClick={runSync}
          disabled={running}
          data-testid="button-stripe-sync"
          className="flex items-center gap-2 bg-pink-600 text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 hover:bg-pink-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "同期中..." : "Stripe同期を実行"}
        </button>
      </div>

      {results !== null && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white border border-pink-200 rounded-xl p-3">
              <div className="text-lg font-bold text-gray-900">{results.length}</div>
              <div className="text-[10px] text-gray-500">確認済み</div>
            </div>
            <div className={`border rounded-xl p-3 ${fixed.length > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-pink-200"}`}>
              <div className={`text-lg font-bold ${fixed.length > 0 ? "text-amber-600" : "text-gray-900"}`}>{fixed.length}</div>
              <div className="text-[10px] text-gray-500">修正済み</div>
            </div>
            <div className={`border rounded-xl p-3 ${errored.length > 0 ? "bg-red-50 border-red-300" : "bg-white border-pink-200"}`}>
              <div className={`text-lg font-bold ${errored.length > 0 ? "text-red-600" : "text-gray-900"}`}>{errored.length}</div>
              <div className="text-[10px] text-gray-500">エラー</div>
            </div>
          </div>

          {mismatch.length === 0 && errored.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              すべてのサブスクリプションは正常です。不整合は見つかりませんでした。
            </div>
          )}

          {mismatch.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">修正されたレコード</div>
              {mismatch.map((r) => (
                <div key={r.id} className="bg-white border border-amber-200 rounded-xl p-3 text-xs space-y-0.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    相談者ID: {r.querentId}
                  </div>
                  <div className="text-gray-500 truncate">Stripe ID: {r.stripeSubId}</div>
                  <div className="flex gap-3">
                    <span className="text-gray-700">DB: <b>{r.dbStatus}</b></span>
                    <span className="text-gray-700">Stripe: <b>{r.stripeStatus}</b></span>
                  </div>
                  <div className={`font-semibold ${r.action === "stripe_cancelled" ? "text-blue-600" : r.action === "db_cancelled" ? "text-orange-600" : "text-red-600"}`}>
                    実行: {r.action === "stripe_cancelled" ? "Stripe側をキャンセル" : r.action === "db_cancelled" ? "DB側を解約に更新" : r.action}
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.filter(r => r.action === "none").length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 py-1">正常なレコードを表示 ({results.filter(r => r.action === "none").length}件)</summary>
              <div className="mt-2 space-y-1">
                {results.filter(r => r.action === "none").map((r) => (
                  <div key={r.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-1.5">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span className="text-gray-500">相談者 {r.querentId}</span>
                    <span className="ml-auto text-gray-400">{r.dbStatus} / Stripe:{r.stripeStatus}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

type FTProfile = {
  user_id: number;
  name: string;
  profile_image: string;
  icon_image: string;
  rank: string;
};

function ImageManagementTab() {
  const queryClient = useQueryClient();
  const { data: advisors, isLoading } = useQuery<FTProfile[]>({ queryKey: ["/api/admin/fortunetellers"] });
  const [selectedAdvisor, setSelectedAdvisor] = useState<FTProfile | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const bannerRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File, type: "banner" | "icon", userId: number) {
    setUploading(type);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("image_type", type);
      const res = await fetch(`/api/admin/fortunetellers/${userId}/upload_image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fortunetellers"] });
      if (selectedAdvisor) {
        setSelectedAdvisor((prev) => prev ? { ...prev, [type === "icon" ? "icon_image" : "profile_image"]: data.url } : null);
      }
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(null);
    }
  }

  if (isLoading) return <div className="text-gray-500 text-sm p-4">読み込み中...</div>;

  if (selectedAdvisor) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <button onClick={() => { setSelectedAdvisor(null); setUploadError(""); }} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-pink-600">
          <ChevronLeft className="w-4 h-4" /> 一覧に戻る
        </button>
        <div className="text-base font-bold text-gray-900">{selectedAdvisor.name}</div>

        <div className="bg-white border border-pink-200 rounded-2xl p-4 space-y-3">
          <div className="font-semibold text-sm text-gray-800">バナー画像</div>
          {selectedAdvisor.profile_image
            ? <img src={selectedAdvisor.profile_image} alt="" className="w-full h-28 object-cover rounded-xl border border-pink-200" />
            : <div className="w-full h-28 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-sm text-gray-400">バナー未設定</div>}
          <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "banner", selectedAdvisor.user_id); e.target.value = ""; }} />
          <button onClick={() => bannerRef.current?.click()} disabled={!!uploading}
            className="w-full py-2 rounded-xl bg-pink-600 text-white text-sm font-semibold disabled:opacity-50">
            {uploading === "banner" ? "アップロード中..." : "バナー画像を変更"}
          </button>
          <div className="text-[10px] text-gray-400">推奨: 横長（16:9〜2:1）/ 最大5MB / JPEG, PNG, WebP</div>
        </div>

        <div className="bg-white border border-pink-200 rounded-2xl p-4 space-y-3">
          <div className="font-semibold text-sm text-gray-800">アイコン画像</div>
          {selectedAdvisor.icon_image
            ? <img src={selectedAdvisor.icon_image} alt="" className="w-16 h-16 rounded-full object-cover border border-pink-200 mx-auto" />
            : <div className="w-16 h-16 rounded-full bg-pink-50 border border-pink-200 flex items-center justify-center text-sm text-gray-400 mx-auto">未設定</div>}
          <input ref={iconRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "icon", selectedAdvisor.user_id); e.target.value = ""; }} />
          <button onClick={() => iconRef.current?.click()} disabled={!!uploading}
            className="w-full py-2 rounded-xl bg-pink-600 text-white text-sm font-semibold disabled:opacity-50">
            {uploading === "icon" ? "アップロード中..." : "アイコン画像を変更"}
          </button>
          <div className="text-[10px] text-gray-400">推奨: 正方形（1:1）/ 最大2MB / JPEG, PNG, WebP</div>
        </div>

        {uploadError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</div>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <div className="text-sm font-bold text-gray-800">占い師プロフィール画像管理</div>
      <div className="text-xs text-gray-500">占い師を選択して画像を設定してください</div>
      {(advisors ?? []).map((a) => (
        <button key={a.user_id} onClick={() => setSelectedAdvisor(a)}
          className="w-full flex items-center gap-3 bg-white border border-pink-200 rounded-2xl p-3 hover:bg-pink-50 transition-colors text-left">
          {a.icon_image
            ? <img src={a.icon_image} alt="" className="w-10 h-10 rounded-full object-cover border border-pink-200 flex-shrink-0" />
            : <div className="w-10 h-10 rounded-full bg-pink-50 border border-pink-200 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{a.name.charAt(0)}</div>}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">{a.name}</div>
            <div className="text-xs text-gray-400">
              {a.icon_image ? "✓ アイコン設定済み" : "✗ アイコン未設定"} /{" "}
              {a.profile_image ? "✓ バナー設定済み" : "✗ バナー未設定"}
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

export default function AdminApp() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("recommend");

  useEffect(() => {
    if (!loading && (!user || user.role !== "9")) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!user || user.role !== "9") return null;

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/logout");
      window.location.href = "/";
    } catch {}
  }

  const tabs: { key: Tab; label: string; icon: typeof Sparkles }[] = [
    { key: "recommend", label: "おすすめ", icon: Sparkles },
    { key: "transfers", label: "振込申請", icon: ArrowLeftRight },
    { key: "users", label: "ユーザー", icon: Users },
    { key: "images", label: "画像管理", icon: Image },
    { key: "stripe", label: "Stripe同期", icon: RefreshCw },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white text-gray-900 flex flex-col max-w-lg mx-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-pink-200">
        <h1 className="text-base font-bold" data-testid="text-admin-title">管理者ダッシュボード</h1>
        <button onClick={handleLogout} data-testid="button-admin-logout"
          className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <LogOut className="w-4 h-4" /> ログアウト
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "recommend" && <RecommendTab />}
        {tab === "transfers" && <TransfersTab />}
        {tab === "users" && <UserManagementTab />}
        {tab === "images" && <ImageManagementTab />}
        {tab === "stripe" && <StripeSyncTab />}
      </div>

      <nav className="border-t border-pink-200 bg-white flex justify-around py-2 safe-area-bottom" data-testid="nav-admin-bottom">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} data-testid={`tab-admin-${t.key}`}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors ${
                active ? "text-pink-600" : "text-gray-400 hover:text-gray-700"
              }`}>
              <Icon className="w-5 h-5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
