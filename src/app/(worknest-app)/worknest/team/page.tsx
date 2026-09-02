import { prisma } from "@/lib/prisma";
import { sumHours } from "@/worknest/lib/data";
import { formatHours } from "@/worknest/lib/format";
import { requireRole } from "@/worknest/lib/permissions";
import { listWorknestPeople } from "@/worknest/lib/users";
import { Card, PageHeader, Select } from "@/worknest/components/ui";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; status?: string }>;
}) {
  await requireRole("ADMIN", "MANAGER");
  const { employeeId = "", status = "" } = await searchParams;
  const employees = await listWorknestPeople({ roles: ["EMPLOYEE"], activeOnly: true });
  const projects = await prisma.wnProject.findMany({
    where: {
      status: status ? (status as "BID") : { notIn: ["CLOSE", "CANCEL"] },
      ...(employeeId ? { assignments: { some: { employeeId } } } : {}),
    },
    include: {
      assignments: true,
      timeEntries: true,
    },
  });

  const rows = employees
    .filter((employee) => !employeeId || employee.id === employeeId)
    .map((employee) => {
      const assigned = projects.filter((p) => p.assignments.some((a) => a.employeeId === employee.id));
      const actual = assigned.reduce(
        (sum, p) => sum + p.timeEntries.filter((e) => e.employeeId === employee.id).reduce((s, e) => s + e.hours, 0),
        0,
      );
      return {
        employee,
        assigned: assigned.length,
        estimated: assigned.reduce((sum, p) => sum + p.estimatedHours, 0),
        actual,
      };
    });

  return (
    <div>
      <PageHeader title="My team" description="See who is loaded and where hours are landing." />
      <form className="mb-4 flex flex-wrap gap-3">
        <Select name="employeeId" defaultValue={employeeId}>
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status}>
          <option value="">Active projects</option>
          <option value="SCRIPT_WIP">Script WIP</option>
          <option value="CHANGES">Changes</option>
          <option value="LIVE">Live</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3 text-right">Active projects</th>
              <th className="px-5 py-3 text-right">Estimated hours</th>
              <th className="px-5 py-3 text-right">Actual hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee.id} className="border-t border-line">
                <td className="px-5 py-3">{row.employee.name}</td>
                <td className="px-5 py-3 text-right">{row.assigned}</td>
                <td className="px-5 py-3 text-right">{formatHours(row.estimated)}</td>
                <td className="px-5 py-3 text-right">{formatHours(row.actual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
