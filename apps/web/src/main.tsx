import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc, API_URL } from "./lib/trpc";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      transformer: superjson,
      fetch: (url, options) => fetch(url, { ...options, credentials: "include" }),
    }),
  ],
});

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
