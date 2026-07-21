// Single-user auth: the session cookie value is HMAC-SHA256(SESSION_SECRET, "garden-session-v1").
// Web Crypto is used so the same code runs in route handlers and in proxy.ts.

export const SESSION_COOKIE = "garden_session";

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set");
  return hmacHex(secret, "garden-session-v1");
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return token === (await sessionToken());
}

// Compare via HMAC digests so the comparison is constant-time and length-hiding.
export async function checkPassword(submitted: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) throw new Error("APP_PASSWORD and SESSION_SECRET must be set");
  const a = await hmacHex(secret, `pw:${submitted}`);
  const b = await hmacHex(secret, `pw:${expected}`);
  return a === b;
}
