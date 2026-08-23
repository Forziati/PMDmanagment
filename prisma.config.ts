import path from "node:path";
import "dotenv/config";
import type { PrismaConfig } from "prisma";

export default {
  schema: path.join("db", "prisma", "schema.prisma"),
  migrations: {
    seed: "tsx db/prisma/seed.ts",
  },
} satisfies PrismaConfig;
