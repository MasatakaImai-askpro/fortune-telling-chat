// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./use-toast";

// ─────────────────────────────────────────────
// useToast フック
// ─────────────────────────────────────────────
describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 説明：初期状態ではトーストリストが空であること
  // 条件：フックを初期化した直後
  it("初期状態でtoastsが空配列であること", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  // 説明：toast() を呼ぶとトーストがリストに追加されること
  // 条件：title と description を指定して toast() を呼ぶ
  it("toast()を呼ぶとtoastsにアイテムが追加される", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "テスト", description: "メッセージ" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("テスト");
    expect(result.current.toasts[0].description).toBe("メッセージ");
  });

  // 説明：3秒後にトーストが自動で消えること（setTimeout による自動削除）
  // 条件：toast() を呼んだ後、3000ms 経過させる
  it("3000ms後にトーストが自動削除される", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "自動削除テスト" });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  // 説明：dismiss() を呼ぶと指定した ID のトーストが削除されること
  // 条件：toast() を呼んで追加後、そのIDで dismiss() を呼ぶ
  it("dismiss()を呼ぶと指定IDのトーストが削除される", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "削除対象" });
    });

    const id = result.current.toasts[0].id;

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  // 説明：複数のトーストを追加した場合、それぞれ異なるIDが振られること
  // 条件：toast() を連続して2回呼ぶ
  it("複数のトーストにはそれぞれ異なるIDが付与される", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "1つ目" });
      result.current.toast({ title: "2つ目" });
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });
});
