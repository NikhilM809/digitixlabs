import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  let notificationCount = 0;
  try {
    notificationCount = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    });
  } catch (error) {
    console.error("Failed to load notification count:", error);
  }

  return (
    <DashboardLayout
      user={{
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        avatar: session.user.avatar,
        role: session.user.role,
      }}
      notificationCount={notificationCount}
    >
      {children}
    </DashboardLayout>
  );
}
