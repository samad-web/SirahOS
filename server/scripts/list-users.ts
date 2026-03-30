import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.table(users.map(u => ({
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    created: u.createdAt.toLocaleDateString("en-IN"),
  })));

  await prisma.$disconnect();
}

main();
