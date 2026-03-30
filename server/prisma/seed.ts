import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo123", 12);

  await Promise.all([
    prisma.user.upsert({
      where: { email: "arjun@sirahos.in" },
      update: {},
      create: { name: "Arjun Kumar", email: "arjun@sirahos.in", passwordHash, role: Role.ADMIN, initials: "AK" },
    }),
    prisma.user.upsert({
      where: { email: "priya@sirahos.in" },
      update: {},
      create: { name: "Priya Sharma", email: "priya@sirahos.in", passwordHash, role: Role.PROJECT_MANAGER, initials: "PS" },
    }),
    prisma.user.upsert({
      where: { email: "rahul@sirahos.in" },
      update: {},
      create: { name: "Rahul Verma", email: "rahul@sirahos.in", passwordHash, role: Role.LEAD, initials: "RV" },
    }),
    prisma.user.upsert({
      where: { email: "sneha@sirahos.in" },
      update: {},
      create: { name: "Sneha Patel", email: "sneha@sirahos.in", passwordHash, role: Role.DEVELOPER, initials: "SP" },
    }),
    prisma.user.upsert({
      where: { email: "vikram@sirahos.in" },
      update: {},
      create: { name: "Vikram Singh", email: "vikram@sirahos.in", passwordHash, role: Role.TESTER, initials: "VS" },
    }),
  ]);

  console.log("  Users seeded");
  console.log("\nDatabase seeded successfully!");
  console.log("\nCredentials (password: demo123):");
  console.log("   Admin:           arjun@sirahos.in");
  console.log("   Project Manager: priya@sirahos.in");
  console.log("   Lead:            rahul@sirahos.in");
  console.log("   Developer:       sneha@sirahos.in");
  console.log("   Tester:          vikram@sirahos.in");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
