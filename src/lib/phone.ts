export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits;
}

export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 10 && digits.length <= 13;
}

export function toSmsNumber(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.length === 10 ? `91${digits}` : digits;
}
