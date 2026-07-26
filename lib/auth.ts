import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import type { AdminUser } from "@/types";

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

function requireSecret(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throw new Error(
      `${name} is required. Set it in the environment before starting the app.`
    );
  }
  if (isProduction && !process.env[name]?.trim()) {
    throw new Error(
      `${name} must be set in production. Refusing to use insecure defaults.`
    );
  }
  return value;
}

const JWT_SECRET = new TextEncoder().encode(
  requireSecret(
    "JWT_SECRET",
    isProduction ? undefined : "naviure-dev-secret-change-in-production"
  )
);

const USERS_FILE = path.join(process.cwd(), "data/admin-users.json");

async function getUsers(): Promise<AdminUser[]> {
  try {
    const content = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    if (isProduction) {
      throw new Error(
        "Admin users file is missing and insecure defaults are disabled in production."
      );
    }
    const defaultPassword = await bcrypt.hash(
      requireSecret("ADMIN_PASSWORD", "naviure2024"),
      12
    );
    const defaultUser: AdminUser = {
      id: "admin-1",
      email: requireSecret("ADMIN_EMAIL", "admin@naviure.in"),
      passwordHash: defaultPassword,
      role: "admin",
      name: "Admin",
    };
    await fs.writeFile(USERS_FILE, JSON.stringify([defaultUser], null, 2));
    return [defaultUser];
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const users = await getUsers();
  const user = users.find((u) => u.email === email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export async function createToken(user: AdminUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; email: string; role: string; name: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("naviure_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
