import { router } from "./trpc";
import { resourcesRouter } from "./routers/resource";
import { reservationsRouter } from "./routers/reservation";
import { availabilityRouter } from "./routers/availability";

export const appRouter = router({
  resources: resourcesRouter,
  reservations: reservationsRouter,
  availability: availabilityRouter,
});

export type AppRouter = typeof appRouter;
