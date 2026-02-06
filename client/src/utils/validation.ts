export function validateEmail(v: string): string {
  if (!v) return "メールアドレスは必須です";
  if (!/^[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(v))
    return "正しい形式で入力してください";
  return "";
}

export function validatePhone(v: string): string {
  if (!v) return "電話番号は必須です";
  if (!/^\d{10,11}$/.test(v)) return "10〜11桁の数字で入力してください";
  return "";
}

export function validateZipcode(v: string): string {
  if (!v) return "郵便番号は必須です";
  if (!/^\d{7}$/.test(v)) return "7桁の数字で入力してください";
  return "";
}

export function validatePassword(v: string): string {
  if (!v) return "パスワードは必須です";
  if (v.length < 8) return "8文字以上で入力してください";
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "英字と数字を含めてください";
  return "";
}
