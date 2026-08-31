/**
 * Reset the default admin password.
 *
 * Usage:
 *   npx tsx scripts/reset-admin-password.ts
 *   npx tsx scripts/reset-admin-password.ts "YourNewPassword"
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const ADMIN_EMAIL = "admin@digitixlabs.com";
const DEFAULT_PASSWORD = "Admin@123";

async function main() {
  const newPassword = process.argv[2]?.trim() || DEFAULT_PASSWORD;
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, employeeId: true, status: true },
  });

  if (!admin) {
    console.error(`No admin user found at ${ADMIN_EMAIL}. Run: npx prisma db seed`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      password: hashedPassword,
      status: "ACTIVE",
      role: "ADMIN",
      mustChangePassword: false,
    },
  });

  console.log("Admin password reset successfully.");
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Employee: ${admin.employeeId}`);
  console.log(`Password: ${newPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
