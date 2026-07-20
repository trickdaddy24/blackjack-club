// Set the password for an admin account. Deliberately NOT exposed in the
// console UI — the /api/admin/users/[id]/password route refuses admin
// targets on purpose (no browser-reachable path to take over another
// admin's account). Running this requires shell access to the box, same
// as promote-admin.js.
//
// Takes a bcrypt HASH, not a raw password — the standalone Docker image
// only ships @prisma/client (see Dockerfile), not bcryptjs, so hash it
// on a machine with the full repo installed first:
//
//   node -e "require('bcryptjs').hash('NewPassword123!', 12).then(console.log)"
//   node scripts/set-admin-password.js someone@example.com '$2b$12$...'

const { PrismaClient } = require("@prisma/client");

const email = process.argv[2];
const hash = process.argv[3];

if (!email || !hash || !hash.startsWith("$2")) {
  console.error("usage: node scripts/set-admin-password.js <email> <bcrypt-hash>");
  process.exit(1);
}

const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`no account with email ${email}`);
    process.exit(1);
  }
  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { password: hash } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  console.log(`${email} (${user.role}): password set.`);
  await prisma.$disconnect();
})();
