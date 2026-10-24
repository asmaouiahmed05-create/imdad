import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { createAuthOptions } from "@/lib/auth-config";

export const auth = betterAuth(
  createAuthOptions(
    prismaAdapter(prisma, {
      provider: "postgresql",
    }),
  ),
);
