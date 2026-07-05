import { createHash, randomInt } from "crypto";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function getOtpSecret(): string {
  return (
    process.env.OTP_SECRET ||
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-otp-secret"
  );
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtp(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${getOtpSecret()}`)
    .digest("hex");
}

export function getOtpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

export function canResendOtp(lastSentAt: string | null): boolean {
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() >= RESEND_COOLDOWN_MS;
}

export function resendCooldownSeconds(lastSentAt: string | null): number {
  if (!lastSentAt) return 0;
  const remaining = RESEND_COOLDOWN_MS - (Date.now() - new Date(lastSentAt).getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export const otpConfig = {
  maxAttempts: MAX_ATTEMPTS,
  ttlMinutes: OTP_TTL_MS / 60000,
  otpLength: OTP_LENGTH,
};
