// utils/validation.ts

/** メールアドレス形式のチェック */
export function validateEmail(v: string): string {
    if (!v) return "メールアドレスは必須です";
    if (!/^[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(v))
        return "正しい形式で入力してください";
    return "";
}

/** 電話番号チェック（ハイフンなし） */
export function validatePhone(v: string): string {
    if (!v) return "電話番号は必須です";
    if (!/^\d{10,11}$/.test(v)) return "10〜11桁の数字で入力してください";
    return "";
}

/** 郵便番号チェック（ハイフンなし） */
export function validateZipcode(v: string): string {
    if (!v) return "郵便番号は必須です";
    if (!/^\d{7}$/.test(v)) return "7桁の数字で入力してください";
    return "";
}
