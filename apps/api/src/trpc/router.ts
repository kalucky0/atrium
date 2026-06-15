import { router } from "./trpc";
import { resourceRouter } from "./routers/resource";
import { reservationRouter } from "./routers/reservation";

export const appRouter = router({
  resource: resourceRouter,
  reservation: reservationRouter,
});

export type AppRouter = typeof appRouter;
