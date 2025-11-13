// Lightweight validation and normalization utilities for extended profile fields.
// Note: Keep logic minimal; avoid external deps for now. Improve later as needed.

export function validateFullName(name: any): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof name !== "string") return { ok: false, error: "invalid_full_name" };
  const v = name.trim().replace(/\s+/g, " ");
  if (v.length < 4 || v.length > 80) return { ok: false, error: "invalid_full_name" };
  const parts = v.split(" ");
  if (parts.length < 2) return { ok: false, error: "invalid_full_name" };
  return { ok: true, value: v };
}

export function validateEmail(email: any): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof email !== "string") return { ok: false, error: "invalid_email" };
  const v = email.trim().toLowerCase();
  // Basic RFC5322-ish simplified regex
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(v) || v.length > 254) return { ok: false, error: "invalid_email" };
  return { ok: true, value: v };
}

export function normalizeCPF(cpf: any): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof cpf !== "string") return { ok: false, error: "invalid_cpf" };
  const digits = cpf.replace(/\D+/g, "");
  if (digits.length !== 11) return { ok: false, error: "invalid_cpf" };
  if (/^(\d)\1{10}$/.test(digits)) return { ok: false, error: "invalid_cpf" };
  if (!checkCPF(digits)) return { ok: false, error: "invalid_cpf" };
  return { ok: true, value: digits };
}

function checkCPF(d: string): boolean {
  // d: 11 digits string
  const nums = d.split("").map((c) => parseInt(c, 10));
  // 10th digit
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let rest = (sum * 10) % 11; if (rest === 10) rest = 0;
  if (rest !== nums[9]) return false;
  // 11th digit
  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  rest = (sum * 10) % 11; if (rest === 10) rest = 0;
  return rest === nums[10];
}

export function normalizePhoneE164(phone: any): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof phone !== "string") return { ok: false, error: "invalid_phone" };
  let v = phone.trim();
  // Remove spaces, parentheses, hyphens
  v = v.replace(/[\s()-]+/g, "");
  // If starts with 00, convert to +
  v = v.replace(/^00/, "+");
  // If no plus and seems Brazilian (11–13 digits), prepend +55 (best-effort)
  if (!v.startsWith("+") && /^\d{10,13}$/.test(v)) {
    // If already starts with 55 and has 12–13 digits, keep
    if (v.startsWith("55")) v = "+" + v; else v = "+55" + v;
  }
  // Final validation: + and 8–15 total digits after plus
  if (!/^\+[0-9]{8,15}$/.test(v)) return { ok: false, error: "invalid_phone" };
  return { ok: true, value: v };
}

export function validateCEP(cep: any): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof cep !== "string") return { ok: false, error: "invalid_cep" };
  const v = cep.replace(/\D+/g, "");
  if (!/^\d{8}$/.test(v)) return { ok: false, error: "invalid_cep" };
  return { ok: true, value: v };
}

const UF_LIST = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
]);

export function validateUF(state: any): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof state !== "string") return { ok: false, error: "invalid_uf" };
  const v = state.trim().toUpperCase();
  if (!UF_LIST.has(v)) return { ok: false, error: "invalid_uf" };
  return { ok: true, value: v };
}
