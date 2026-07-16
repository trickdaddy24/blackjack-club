// Promote (or demote) an account to admin. Deliberately NOT exposed in the
// console UI — running this requires shell access to the box.
//
//   node scripts/promote-admin.js someone@example.com          → admin
//   node scripts/promote-admin.js someone@example.com user     → back to user
//
// Prod: ssh into server2, then
//   docker exec blackjack node scripts/promote-admin.js <email>

const { PrismaClient } = require("@prisma/client");

const email = process.argv[2];
const role = process.argv[3] ?? "admin";

if (!email || !["admin", "user"].includes(role)) {
  console.error("usage: node scripts/promote-admin.js <email> [admin|user]");
  process.exit(1);
}

const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`no account with email ${email}`);
    process.exit(1);
  }
  await prisma.user.update({ where: { email }, data: { role } });
  console.log(`${email}: role ${user.role} -> ${role}`);
  await prisma.$disconnect();
})();
