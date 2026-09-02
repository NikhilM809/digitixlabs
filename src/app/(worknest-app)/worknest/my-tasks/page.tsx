import { selfAssignTask, updateTask } from "@/worknest/actions/tasks";
import { TaskBadge } from "@/worknest/components/status";
import { Button, Card, EmptyState, PageHeader, Select, Textarea } from "@/worknest/components/ui";
import { TASK_STATUS_LABEL } from "@/worknest/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/worknest/lib/format";
import { requireRole } from "@/worknest/lib/permissions";
import { visibleProjectsWhere } from "@/worknest/lib/project-access";
import { asFormAction } from "@/worknest/lib/utils";

export default async function MyTasksPage() {
  const user = await requireRole("EMPLOYEE");
  const mine = await prisma.wnTask.findMany({
    where: { assignedEmployeeId: user.id, project: visibleProjectsWhere("EMPLOYEE") },
    include: { project: true },
    orderBy: { dueDate: "asc" },
  });
  const available = await prisma.wnTask.findMany({
    where: {
      assignedEmployeeId: null,
      OR: [{ selfAssignEnabled: true }, { project: { selfAssignEnabled: true } }],
      project: {
        AND: [
          visibleProjectsWhere("EMPLOYEE"),
          {
            OR: [{ assignments: { some: { employeeId: user.id } } }, { selfAssignEnabled: true }],
            status: { notIn: ["CLOSE", "CANCEL"] },
          },
        ],
      },
    },
    include: { project: true },
  });

  return (
    <div>
      <PageHeader title="My tasks" description="Update status, add notes, or pick up open work." />
      {available.length > 0 ? (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Available to self-assign</h2>
          </div>
          <div className="divide-y divide-line">
            {available.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="font-medium">{task.name}</p>
                  <p className="text-xs text-muted">{task.project.name}</p>
                </div>
                <form action={selfAssignTask.bind(null, task.id)}>
                  <Button size="sm">Assign to me</Button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="grid gap-4">
        {mine.length === 0 ? (
          <Card>
            <EmptyState title="No tasks" description="Assigned work will appear here." />
          </Card>
        ) : (
          mine.map((task) => (
            <Card key={task.id} className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{task.name}</p>
                  <p className="text-xs text-muted">
                    {task.project.name} · due {formatDate(task.dueDate)}
                  </p>
                </div>
                <TaskBadge status={task.status} />
              </div>
              <form action={asFormAction(updateTask.bind(null, task.id))} className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
                <Select name="status" defaultValue={task.status}>
                  {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Textarea name="notes" defaultValue={task.notes} />
                <Button type="submit">Save</Button>
              </form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
