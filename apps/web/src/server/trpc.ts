import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { SessionContext } from "@divan/identity-access";

export type TrpcContext = {
  session: SessionContext | null;
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "برای دسترسی باید وارد شوید.",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
    },
  });
});
