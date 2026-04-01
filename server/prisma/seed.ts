import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("demo123", 12);

  // ─── Seed Company ─────────────────────────────────────────────────────────
  const seedCompany = await prisma.company.upsert({
    where: { slug: "sirah-digital" },
    update: {},
    create: {
      id: "seed-company-sirah",
      name: "Sirah Digital",
      slug: "sirah-digital",
      status: "ACTIVE",
      featureBilling: true,
      featureProjects: true,
      featureAttendance: true,
      featureLeads: true,
    },
  });

  console.log("  Seed company created");

  // ─── Super Admin ──────────────────────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || "superadmin123", 12);
  await prisma.user.upsert({
    where: { email: "superadmin@sirahdigital.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@sirahdigital.com",
      passwordHash: superAdminPassword,
      role: Role.SUPER_ADMIN,
      status: "ACTIVE",
      initials: "SA",
      companyId: null,
    },
  });

  console.log("  Super Admin seeded");

  // ─── Users ─────────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.user.upsert({
      where: { email: "arjun@sirahos.in" },
      update: {},
      create: { name: "Arjun Kumar", email: "arjun@sirahos.in", passwordHash, role: Role.ADMIN, initials: "AK", companyId: seedCompany.id },
    }),
    prisma.user.upsert({
      where: { email: "priya@sirahos.in" },
      update: {},
      create: { name: "Priya Sharma", email: "priya@sirahos.in", passwordHash, role: Role.PROJECT_MANAGER, initials: "PS", companyId: seedCompany.id },
    }),
    prisma.user.upsert({
      where: { email: "rahul@sirahos.in" },
      update: {},
      create: { name: "Rahul Verma", email: "rahul@sirahos.in", passwordHash, role: Role.LEAD, initials: "RV", companyId: seedCompany.id },
    }),
    prisma.user.upsert({
      where: { email: "sneha@sirahos.in" },
      update: {},
      create: { name: "Sneha Patel", email: "sneha@sirahos.in", passwordHash, role: Role.DEVELOPER, initials: "SP", companyId: seedCompany.id },
    }),
    prisma.user.upsert({
      where: { email: "vikram@sirahos.in" },
      update: {},
      create: { name: "Vikram Singh", email: "vikram@sirahos.in", passwordHash, role: Role.TESTER, initials: "VS", companyId: seedCompany.id },
    }),
  ]);

  console.log("  Users seeded");
  console.log("\nDatabase seeded successfully!");
  console.log("\nCredentials:");
  console.log("   Super Admin:     superadmin@sirahdigital.com (password from SUPER_ADMIN_PASSWORD env or 'superadmin123')");
  console.log("   Admin:           arjun@sirahos.in (demo123)");
  console.log("   Project Manager: priya@sirahos.in (demo123)");
  console.log("   Lead:            rahul@sirahos.in (demo123)");
  console.log("   Developer:       sneha@sirahos.in (demo123)");
  console.log("   Tester:          vikram@sirahos.in (demo123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
