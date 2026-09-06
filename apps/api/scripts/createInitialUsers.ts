/// <reference types="node" />
// One-time bootstrap script — creates the initial staff accounts on a fresh
// database (real Admin, public Demo account, and local test accounts).
// Run this once against the live database, then it's safe to delete or keep
// for future fresh-database resets (Render free Postgres expires every 30
// days, so this script may be reused later).
//
// Usage (from apps/api folder):
//   $env:DATABASE_URL="<external db url>"; npx tsx scripts/createInitialUsers.ts
//
// You will be prompted for each account's password directly in the terminal —
// nothing is hardcoded here, and nothing is sent anywhere except your own
// database.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import * as readline from "readline";

const prisma = new PrismaClient();

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

type AccountToCreate = {
  label: string;
  name: string;
  email: string;
  role: "ADMIN" | "STORE_MANAGER" | "REGIONAL_MANAGER";
  storeId?: string | null;
  isDemo?: boolean;
  fixedPassword?: string; // used only for the public demo account
};

async function upsertAccount(acc: AccountToCreate) {
  let password = acc.fixedPassword;
  if (!password) {
    password = await ask(`Enter password for ${acc.label} (${acc.email}): `);
    if (!password || password.length < 6) {
      console.log(`  ⚠️  Skipping ${acc.label} — password too short.\n`);
      return;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: acc.email },
    update: {
      passwordHash,
      name: acc.name,
      role: acc.role,
      storeId: acc.storeId ?? null,
      isDemo: acc.isDemo ?? false,
      isActive: true,
    },
    create: {
      name: acc.name,
      email: acc.email,
      passwordHash,
      role: acc.role,
      storeId: acc.storeId ?? null,
      isDemo: acc.isDemo ?? false,
      isActive: true,
    },
  });

  console.log(`  ✅ ${acc.label} ready — ${user.email} (${user.role})\n`);
}

async function main() {
  console.log("🔐 SurgeOps — initial account bootstrap\n");

  await upsertAccount({
    label: "Real Admin",
    name: "Kalpesh Wahurwagh",
    email: "kalpeshwahurwagh09@gmail.com",
    role: "ADMIN",
  });

  await upsertAccount({
    label: "Demo Account (public)",
    name: "Demo Account",
    email: "demotest@example.com",
    role: "REGIONAL_MANAGER",
    isDemo: true,
    fixedPassword: "Demo1234!",
  });

  await upsertAccount({
    label: "Store Manager test account",
    name: "Store Test",
    email: "storetest@example.com",
    role: "STORE_MANAGER",
    storeId: "store-mumbai-bandra",
  });

  await upsertAccount({
    label: "Regional Manager test account",
    name: "Regional Test",
    email: "regionaltest@example.com",
    role: "REGIONAL_MANAGER",
  });

  console.log("🎉 Done.");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });