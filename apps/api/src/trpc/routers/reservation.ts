import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { reservation } from "@atrium/db/schema";
import { protectedProcedure, router } from "../trpc";

export const reservationRouter = router({
  listByResource: protectedProcedure
    .input(z.object({ resourceId: z.uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.select().from(reservation).where(eq(reservation.resourceId, input.resourceId)),
    ),

  // TODO: implementacja przez zespół
  // Tworzenie rezerwacji + obsługa kolizji/transakcji jest celowo zostawione.
  // Tabela `reservation` i constraint EXCLUDE (reservation_no_overlap) już istnieją.
  // Szkic implementacji:
  //   import { sql } from "drizzle-orm";
  //   const during = sql`tstzrange(${input.start}, ${input.end}, '[)')`;
  //   try {
  //     const [row] = await ctx.db.insert(reservation)
  //       .values({ resourceId: input.resourceId, userId: ctx.user.id, during })
  //       .returning();
  //     return row;
  //   } catch (e) {
  //     // Postgres 23P01 = exclusion_violation -> termin zajęty
  //     if ((e as { code?: string }).code === "23P01")
  //       throw new TRPCError({ code: "CONFLICT", message: "Termin jest już zajęty" });
  //     throw e;
  //   }
  //   // Owiń w ctx.db.transaction(...) jeśli łączysz z innymi zapisami.
  create: protectedProcedure
    .input(
      z.object({
        resourceId: z.uuid(),
        start: z.date(),
        end: z.date(),
      }),
    )
    .mutation(() => {
      // TODO: implementacja przez zespół
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "TODO: implementacja tworzenia rezerwacji przez zespół",
      });
    }),
});
