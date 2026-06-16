import { createAuthClient } from "better-auth/react";
import { redirect } from "@tanstack/react-router";
import { API_URL } from "./trpc";

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
});

export const { signIn, signUp, signOut, useSession } = authClient;

export async function requireAuth() {
  const { data } = await authClient.getSession();
  if (!data) throw redirect({ to: "/login" });
}
