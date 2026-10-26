"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { WORKER_COOKIE } from "@/lib/workzone/worker-session";

export async function logoutDisplayAction() {
  const jar = await cookies();
  jar.delete(DISPLAY_COOKIE);
  jar.delete(ADMIN_COOKIE);
  jar.delete(WORKER_COOKIE);
  redirect("/display-login");
}
