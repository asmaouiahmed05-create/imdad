import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to initialize Prisma Client.");
}

const connectionUrl = new URL(databaseUrl);
const sslMode = connectionUrl.searchParams.get("sslmode");
if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
  connectionUrl.searchParams.set("sslmode", "verify-full");
}
const connectionString = connectionUrl.toString();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
