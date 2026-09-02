import { reviewHours } from "@/worknest/actions/hours";
import { AddHoursForm } from "@/worknest/components/hours-form";
import { AddWorkTypeForm } from "@/worknest/components/catalog-settings";
import { Button, Card, PageHeader, Select } from "@/worknest/components/ui";
import { HOUR_STATUS_LABEL, workTypeLabel } from "@/worknest/lib/constants";
import { prisma } from "@/lib/prisma";
import { getActiveClients, getActiveWorkTypes } from "@/worknest/lib/catalog";
import { formatDate, formatHours } from "@/worknest/lib/format";
import { requireRole } from "@/worknest/lib/permissions";
import { userDisplayName } from "@/worknest/lib/user-adapter";
import { listWorknestPeople } from "@/worknest/lib/users";

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; projectId?: string; status?: string; client?: string }>;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const { employeeId = "", projectId = "", status = "", client = "" } = await searchParams;
  const [entries, employees, projects, tasks, workTypes, clients] = await Promise.all([
    prisma.wnTimeEntry.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status ? { status: status as "SUBMITTED" } : {}),
        ...(client ? { project: { clientName: client } } : {}),
      },
      include: { employee: true, project: true, task: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    listWorknestPeople({ roles: ["EMPLOYEE"], activeOnly: true }),
    prisma.wnProject.findMany({ where: { status: { notIn: ["CLOSE", "CANCEL"] } }, orderBy: { name: "asc" } }),
    prisma.wnTask.findMany(),
    getActiveWorkTypes(),
    getActiveClients(),
  ]);

  return (
    <div>
      <PageHeader title="Hours" description="Employee enters hours. Manager reviews. Admin can see all." />
      <form className="mb-4 grid gap-3 md:grid-cols-5">
        <Select name="employeeId" defaultValue={employeeId}>
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="projectId" defaultValue={projectId}>
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="REVIEWED">Reviewed</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl">Log hours for someone</h2>
        <AddHoursForm
          projects={projects.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name, projectId: t.projectId }))}
          workTypes={workTypes}
          employees={employees}
          canChooseEmployee
        />
      </Card>
      {user.role === "ADMIN" ? (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 font-display text-xl">Add a work type</h2>
          <AddWorkTypeForm />
        </Card>
      ) : null}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Work type</th>
              <th className="px-5 py-3 text-right">Hours</th>
              <th className="px-5 py-3">Notes</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="px-5 py-3">{formatDate(entry.date)}</td>
                <td className="px-5 py-3">{userDisplayName(entry.employee)}</td>
                <td className="px-5 py-3">{entry.project.name}</td>
                <td className="px-5 py-3">{workTypeLabel(entry.workType)}</td>
                <td className="px-5 py-3 text-right">{formatHours(entry.hours)}</td>
                <td className="px-5 py-3">{entry.notes || "—"}</td>
                <td className="px-5 py-3">
                  {entry.status === "REVIEWED" ? (
                    HOUR_STATUS_LABEL.REVIEWED
                  ) : (
                    <form action={reviewHours.bind(null, entry.id)}>
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
