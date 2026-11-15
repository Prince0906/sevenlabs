import { prisma } from "../../infrastructure/db";

// Trusted internal operation, deliberately not an HTTP endpoint or package
// export. A future administrative caller must authorize the operator first.
export async function disableAccount(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { disabledAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}
