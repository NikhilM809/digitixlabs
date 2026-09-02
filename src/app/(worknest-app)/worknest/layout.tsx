import { AppShell } from "@/worknest/components/shell";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/worknest/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await prisma.worknestNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
