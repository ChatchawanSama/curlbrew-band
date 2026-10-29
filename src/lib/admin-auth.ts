import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "curlbrew_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function getSessionSecret() {
  if (!env.CURLBREW_SESSION_SECRET) throw new Error("CURLBREW_SESSION_SECRET is required");
  return env.CURLBREW_SESSION_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function isValidSignature(value: string, signature: string) {
  const expected = sign(value);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function createAdminCookieValue() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function isValidAdminCookie(value: string | undefined) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !isValidSignature(payload, signature)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string; exp?: number };
    return parsed.role === "admin" && typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  return isValidAdminCookie(cookie);
}

export function credentialsMatch(username: string, password: string) {
  return Boolean(env.CURLBREW_ADMIN_USERNAME && env.CURLBREW_ADMIN_PASSWORD && username === env.CURLBREW_ADMIN_USERNAME && password === env.CURLBREW_ADMIN_PASSWORD);
}

export function isLoginRateLimited(identifier: string) {
  const now = Date.now();
  const current = attempts.get(identifier);
  if (!current || current.resetAt <= now) {
    attempts.set(identifier, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_LOGIN_ATTEMPTS;
}
