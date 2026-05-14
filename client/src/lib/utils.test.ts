import { describe, it, expect } from "vitest";
import { cn } from "./utils";

// ─────────────────────────────────────────────
// cn（className ユーティリティ）
// ─────────────────────────────────────────────
describe("cn", () => {
  // 説明：単一のクラス文字列をそのまま返すこと
  // 条件：引数が "foo" 1つ
  it("単一クラスをそのまま返す", () => {
    expect(cn("foo")).toBe("foo");
  });

  // 説明：複数クラスをスペース区切りで結合すること
  // 条件：引数が "foo" と "bar"
  it("複数クラスをスペース区切りで結合する", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  // 説明：falsy な値（undefined, false, null）は無視されること
  // 条件：引数に undefined と false が含まれる
  it("falsy値を無視する", () => {
    expect(cn("foo", undefined, false, "bar")).toBe("foo bar");
  });

  // 説明：Tailwindの競合クラスは後勝ちでマージされること（tailwind-mergeの動作確認）
  // 条件：同じプロパティを持つ "p-4" と "p-2" を渡す
  it("Tailwindの競合クラスを後勝ちでマージする", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  // 説明：条件付きオブジェクト形式でクラスを適用できること
  // 条件：{ "text-red-500": true, "text-blue-500": false }
  it("オブジェクト形式の条件付きクラスを適用する", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });

  // 説明：引数が何もない場合は空文字を返すこと
  // 条件：引数なし
  it("引数なしのとき空文字を返す", () => {
    expect(cn()).toBe("");
  });
});
