import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@atrium/api";

export const trpc = createTRPCReact<AppRouter>();

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
