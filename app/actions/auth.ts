"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateUser, createToken } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = await authenticateUser(email, password);
  if (!user) {
    return { error: "Invalid credentials" };
  }

  const token = await createToken(user);
  const cookieStore = await cookies();
  cookieStore.set("naviure_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  redirect("/admin/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("naviure_session");
  redirect("/admin/login");
}
