import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canSeeFinance, requireRole } from "@/worknest/lib/permissions";
import { sumHours } from "@/worknest/lib/data";
import { formatDate, formatHours, formatMoney } from "@/worknest/lib/format";
import { billingStatusForProject } from "@/worknest/lib/finance";
import { BillingBadge, StatusBadge } from "@/worknest/components/status";
import { Card, EmptyState, Input, PageHeader } from "@/worknest/components/ui";
import { withVisibleProjects } from "@/worknest/lib/project-access";
import { userDisplayName } from "@/worknest/lib/user-adapter";

export default async function ClosedProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const { q = "" } = await searchParams;
  const finance = canSeeFinance(user.role);
  const projects = await prisma.wnProject.findMany({
    where: withVisibleProjects(user.role, {
      status: "CLOSE",
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { code: { contains: q } }, { clientName: { contains: q } }],
          }
        : {}),
    }),
    include: {
      manager: true,
      assignments: { include: { employee: true } },
      timeEntries: { select: { hours: true } },
      invoices: true,
      notes: true,
      currency: true,
    },
    orderBy: { actualCompletionDate: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Closed projects"
        description={
          user.role === "ADMIN"
            ? "Historical record stays available after close and billing."
            : "Closed projects stay visible for 30 days."
        }
      />
      <form className="mb-4">
        <Input name="q" placeholder="Search closed projects" defaultValue={q} />
      </form>
      <Card className="overflow-x-auto">
        {projects.length === 0 ? (
          <EmptyState title="No closed projects" description="Closed work will appear here." />
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Manager</th>
                <th className="px-5 py-3">Team</th>
                <th className="px-5 py-3">Completed</th>
                <th className="px-5 py-3 text-right">Hours</th>
                {finance ? <th className="px-5 py-3 text-right">Value</th> : null}
                {finance ? <th className="px-5 py-3">Billing</th> : null}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link href={`/worknest/projects/${project.id}`} className="font-medium hover:text-teal">
                      {project.name}
                    </Link>
                    <p className="text-xs text-muted">{project.code}</p>
                    <div className="mt-1">
                      <StatusBadge status={project.status} />
                    </div>
                  </td>
                  <td className="px-5 py-3">{project.clientName}</td>
                  <td className="px-5 py-3">{userDisplayName(project.manager)}</td>
                  <td className="px-5 py-3">
                    {project.assignments.map((a) => userDisplayName(a.employee)).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3">{formatDate(project.actualCompletionDate)}</td>
                  <td className="px-5 py-3 text-right">
                    {formatHours(sumHours(project.timeEntries))} / {formatHours(project.estimatedHours)}
                  </td>
                  {finance ? (
                    <td className="px-5 py-3 text-right">
                      {formatMoney(project.sellValue, project.currency?.code)}
                    </td>
                  ) : null}
                  {finance ? (
                    <td className="px-5 py-3">
                      <BillingBadge
                        status={billingStatusForProject(
                          project.status,
                          project.invoices,
                          project.billingStage,
                        )}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
