import { createHash, randomBytes } from "node:crypto";

export function createRoomSecret() { return randomBytes(24).toString("base64url"); }
export function createRoomCode() { return randomBytes(8).toString("base64url"); }
export function hashRoomSecret(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
export function hasRoomAccess(storedHash: string | null, providedSecret: string | null) { return Boolean(storedHash && providedSecret && hashRoomSecret(providedSecret) === storedHash); }
