import Link from "next/link";
import { endOfMonth, endOfWeek, isSameDay, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { FocusList, type FocusItem } from "@/worknest/components/focus-list";
import { AlertPills, TaskBadge } from "@/worknest/components/status";
import { Button, Card, PageHeader, Select, StatCard } from "@/worknest/components/ui";
import { PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/worknest/lib/constants";
import { CurrencyTotals } from "@/worknest/components/currency-totals";
import { WnProjectStatusForm } from "@/worknest/components/project-status-form";
import { prisma } from "@/lib/prisma";
import { getSettings, sumHours } from "@/worknest/lib/data";
import { ensureCurrencies } from "@/worknest/lib/currency";
import { getActiveClients } from "@/worknest/lib/catalog";
import { totalsByCurrency, remainingByCurrency } from "@/worknest/lib/finance";
import { formatDate, formatHours, isEtaSoon, isOverdue } from "@/worknest/lib/format";
import { requireUser } from "@/worknest/lib/permissions";
import { userDisplayName } from "@/worknest/lib/user-adapter";
import { listWorknestPeople } from "@/worknest/lib/users";
import { visibleProjectsWhere } from "@/worknest/lib/project-access";
import { isInactiveStatus } from "@/worknest/lib/project-status";
import { WnProjectStatus, WnTaskStatus } from "@prisma/client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const client = String(params.client || "");
  if (user.role === "ADMIN") return <AdminDashboard client={client} />;
  if (user.role === "MANAGER") return <ManagerDashboard userId={user.id} name={user.name} />;
  return <EmployeeDashboard userId={user.id} name={user.name} />;
}

async function AdminDashboard({ client }: { client: string }) {
  const settings = await getSettings();
  await ensureCurrencies();
  const clients = await getActiveClients();
  const projects = await prisma.wnProject.findMany({
    where: client ? { clientName: client } : {},
    include: { timeEntries: { select: { hours: true } }, invoices: true, currency: true },
  });
  const byStatus = (status: WnProjectStatus) => projects.filter((p) => p.status === status).length;
  const active = projects.filter((p) => !isInactiveStatus(p.status));
  const overdue = active.filter((p) => isOverdue(p.eta, p.status)).length;
  const dueSoon = active.filter((p) => isEtaSoon(p.eta, settings.etaWarningDays, p.status)).length;
  const actual = projects.reduce((sum, p) => sum + sumHours(p.timeEntries), 0);
  const estimated = projects.reduce((sum, p) => sum + p.estimatedHours, 0);
  const pendingBilling = projects.filter((p) => p.status !== "CANCEL");
  const valueTotals = totalsByCurrency(pendingBilling, (p) => p.sellValue);
  const billedTotals = totalsByCurrency(
    pendingBilling.flatMap((p) => p.invoices),
    (i) => i.amount,
  );
  const pendingTotals = remainingByCurrency(valueTotals, billedTotals);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Projects, hours, and billing at a glance."
        actions={
          <Link href="/worknest/projects/new">
            <Button>New project</Button>
          </Link>
        }
      />
      <form method="get" className="mb-4 flex max-w-sm gap-3">
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total projects" value={projects.length} />
        <StatCard label="Active" value={active.length} />
        <StatCard label="Overdue" value={overdue} warn={overdue > 0} />
        <StatCard label="Due soon" value={dueSoon} warn={dueSoon > 0} />
        <StatCard label="Closed" value={byStatus("CLOSE")} />
        <StatCard label="Cancelled" value={byStatus("CANCEL")} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {(["BID", "NEED_TO_START", "SCRIPT_WIP", "CHANGES", "LIVE", "HOLD"] as WnProjectStatus[]).map((status) => (
          <StatCard key={status} label={PROJECT_STATUS_LABEL[status]} value={byStatus(status)} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CurrencyTotals title="Project value by currency" totals={valueTotals} />
        <CurrencyTotals title="Billed by currency" totals={billedTotals} />
        <CurrencyTotals title="Pending billing (value minus billed)" totals={pendingTotals} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Estimated hours" value={formatHours(estimated)} />
        <StatCard label="Actual hours" value={formatHours(actual)} />
      </div>
    </div>
  );
}

function isTaskOverdue(due: Date | null, status: WnTaskStatus, now = new Date()) {
  return Boolean(due) && status !== "COMPLETED" && startOfDay(now) > startOfDay(due!);
}

function isDueToday(due: Date | null, status: WnTaskStatus, now = new Date()) {
  return Boolean(due) && status !== "COMPLETED" && isSameDay(due!, now);
}

async function ManagerDashboard({ userId, name }: { userId: string; name: string }) {
  const settings = await getSettings();
  const now = new Date();
  const projects = await prisma.wnProject.findMany({
    where: { status: { notIn: ["CLOSE", "CANCEL"] } },
    include: {
      timeEntries: { select: { hours: true, employeeId: true } },
      assignments: { include: { employee: true } },
      tasks: { include: { assignedEmployee: true } },
    },
    orderBy: { eta: "asc" },
  });
  const mine = projects.filter((project) => project.managerId === userId);
  const overdue = mine.filter((p) => isOverdue(p.eta, p.status)).length;
  const dueSoon = mine.filter((p) => isEtaSoon(p.eta, settings.etaWarningDays, p.status)).length;
  const teamTasks = mine.flatMap((project) => project.tasks.map((task) => ({ task, project })));
  const openTeamTasks = teamTasks.filter(({ task }) => task.status !== "COMPLETED");
  const blocked = openTeamTasks.filter(({ task }) => task.status === "BLOCKED");
  const unassigned = openTeamTasks.filter(({ task }) => !task.assignedEmployeeId);
  const overdueTasks = openTeamTasks.filter(({ task }) => isTaskOverdue(task.dueDate, task.status, now));
  const dueToday = openTeamTasks.filter(({ task }) => isDueToday(task.dueDate, task.status, now));
  const inProgress = openTeamTasks.filter(({ task }) => task.status === "IN_PROGRESS");

  const attention: FocusItem[] = [];
  const seen = new Set<string>();
  const pushAttention = (item: FocusItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    attention.push(item);
  };

  for (const project of mine.filter((project) => isOverdue(project.eta, project.status))) {
    pushAttention({
      id: `project-${project.id}`,
      href: `/worknest/projects/${project.id}`,
      title: project.name,
      meta: `Project overdue · ETA ${formatDate(project.eta)}`,
      tone: "danger",
    });
  }
  for (const { task, project } of overdueTasks) {
    pushAttention({
      id: `task-${task.id}`,
      href: `/worknest/projects/${project.id}?tab=tasks`,
      title: task.name,
      meta: `Overdue on ${project.name} · due ${formatDate(task.dueDate)}`,
      status: task.status,
      tone: "danger",
    });
  }
  for (const { task, project } of blocked) {
    pushAttention({
      id: `task-${task.id}`,
      href: `/worknest/projects/${project.id}?tab=tasks`,
      title: task.name,
      meta: `Blocked on ${project.name}${task.assignedEmployee ? ` · ${userDisplayName(task.assignedEmployee)}` : ""}`,
      status: task.status,
      tone: "gold",
    });
  }
  for (const { task, project } of unassigned) {
    pushAttention({
      id: `task-${task.id}`,
      href: `/worknest/projects/${project.id}?tab=tasks`,
      title: task.name,
      meta: `Unassigned on ${project.name}`,
      status: task.status,
    });
  }
  attention.splice(8);

  const todayWork = [...dueToday, ...inProgress.filter((row) => !dueToday.includes(row))].slice(0, 10);

  const employees = await listWorknestPeople({ roles: ["EMPLOYEE"], activeOnly: true });
  const workload = employees.map((employee) => {
    const assigned = mine.filter((p) => p.assignments.some((a) => a.employeeId === employee.id));
    const actual = assigned.reduce(
      (sum, p) => sum + p.timeEntries.filter((e) => e.employeeId === employee.id).reduce((s, e) => s + e.hours, 0),
      0,
    );
    const nextTask = openTeamTasks.find(({ task }) => task.assignedEmployeeId === employee.id);
    return {
      employee,
      assigned: assigned.length,
      actual,
      estimated: assigned.reduce((sum, p) => sum + p.estimatedHours, 0),
      next: nextTask ? `${nextTask.task.name} · ${nextTask.project.name}` : "No open task",
    };
  });

  return (
    <div>
      <PageHeader
        title={`Today, ${name.split(" ")[0]}`}
        description="What your team needs to do. Project cost is not shown."
        actions={
          <Link href="/worknest/hours">
            <Button variant="outline">Add hours</Button>
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Your projects" value={mine.length} hint={`${projects.length} active in the studio`} />
        <StatCard label="Due today" value={dueToday.length} />
        <StatCard label="Blocked" value={blocked.length} warn={blocked.length > 0} />
        <StatCard label="Unassigned" value={unassigned.length} warn={unassigned.length > 0} />
        <StatCard
          label="Overdue"
          value={overdue + overdueTasks.length}
          warn={overdue + overdueTasks.length > 0}
          hint={dueSoon ? `${dueSoon} due soon` : undefined}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <FocusList
          title="Needs attention"
          empty="No overdue, blocked, or unassigned work on your projects."
          items={attention}
        />
        <Card>
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Team — do this today</h2>
          </div>
          {todayWork.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">
              No tasks due today or in progress. Assign work from a project.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {todayWork.map(({ task, project }) => (
                <li key={task.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium">{task.name}</p>
                    <p className="text-xs text-muted">
                      {project.name} · {task.assignedEmployee ? userDisplayName(task.assignedEmployee) : "Unassigned"}
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}
                    </p>
                  </div>
                  <TaskBadge status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl">Team workload</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Next task</th>
              <th className="px-5 py-3 text-right">Projects</th>
              <th className="px-5 py-3 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {workload.map((row) => (
              <tr key={row.employee.id} className="border-t border-line">
                <td className="px-5 py-3">{row.employee.name}</td>
                <td className="px-5 py-3 text-muted">{row.next}</td>
                <td className="px-5 py-3 text-right">{row.assigned}</td>
                <td className="px-5 py-3 text-right">
                  {formatHours(row.actual)} / {formatHours(row.estimated)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function EmployeeDashboard({ userId, name }: { userId: string; name: string }) {
  const now = new Date();
  const assignments = await prisma.wnProjectAssignment.findMany({
    where: { employeeId: userId, project: visibleProjectsWhere("EMPLOYEE") },
    include: {
      project: {
        include: {
          statusChangedBy: true,
          tasks: { where: { assignedEmployeeId: userId } },
          timeEntries: { where: { employeeId: userId } },
        },
      },
    },
  });
  const visibleAssignments = assignments;
  const tasks = visibleAssignments.flatMap((a) => a.project.tasks);
  const openTasks = tasks.filter((task) => task.status !== "COMPLETED");
  const entries = await prisma.wnTimeEntry.findMany({ where: { employeeId: userId } });
  const today = entries.filter((e) => isSameDay(e.date, now));
  const week = entries.filter(
    (e) => e.date >= startOfWeek(now, { weekStartsOn: 1 }) && e.date <= endOfWeek(now, { weekStartsOn: 1 }),
  );
  const month = entries.filter((e) => e.date >= startOfMonth(now) && e.date <= endOfMonth(now));
  const settings = await getSettings();

  const ranked = [...openTasks].sort((a, b) => {
    const rank = (task: (typeof openTasks)[number]) => {
      if (isTaskOverdue(task.dueDate, task.status, now)) return 0;
      if (task.status === "BLOCKED") return 1;
      if (isDueToday(task.dueDate, task.status, now)) return 2;
      if (task.status === "IN_PROGRESS") return 3;
      return 4;
    };
    return rank(a) - rank(b);
  });

  const focus: FocusItem[] = ranked.slice(0, 8).map((task) => {
    const project = assignments.find((row) => row.project.id === task.projectId)?.project;
    const overdueTask = isTaskOverdue(task.dueDate, task.status, now);
    return {
      id: task.id,
      href: "/my-tasks",
      title: task.name,
      meta: `${project?.name ?? "Project"}${task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}${overdueTask ? " · overdue" : ""}`,
      status: task.status,
      tone: overdueTask ? "danger" : task.status === "BLOCKED" ? "gold" : "default",
    };
  });

  return (
    <div>
      <PageHeader
        title={`Today, ${name.split(" ")[0]}`}
        description="Your work for the day — tasks first."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Do now"
          value={
            openTasks.filter(
              (t) =>
                isTaskOverdue(t.dueDate, t.status, now) ||
                isDueToday(t.dueDate, t.status, now) ||
                t.status === "IN_PROGRESS",
            ).length
          }
        />
        <StatCard label="Open tasks" value={openTasks.length} />
        <StatCard
          label="Hours today"
          value={`${formatHours(sumHours(today))} h`}
          hint={`${formatHours(sumHours(week))} this week`}
        />
        <StatCard label="This month" value={`${formatHours(sumHours(month))} h`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <FocusList
          title="Do this today"
          empty="No open tasks. Check My Tasks if work is available to pick up."
          items={focus}
          action={
            <Link href="/worknest/my-tasks" className="text-sm text-teal">
              All tasks
            </Link>
          }
        />
        <Card>
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">My projects</h2>
          </div>
          {visibleAssignments.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">You are not assigned to an active project yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {visibleAssignments.map((row) => {
                const next = row.project.tasks.find((task) => task.status !== "COMPLETED");
                return (
                  <div key={row.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{row.project.name}</p>
                        <p className="text-xs text-muted">
                          {row.project.clientName} · ETA {formatDate(row.project.eta)}
                        </p>
                      </div>
                      <WnProjectStatusForm
                        compact
                        projectId={row.project.id}
                        status={row.project.status}
                        changedByName={
                          row.project.statusChangedBy
                            ? userDisplayName(row.project.statusChangedBy)
                            : undefined
                        }
                        changedAt={row.project.statusChangedAt}
                      />
                    </div>
                    <p className="mt-2 text-sm">
                      {next ? (
                        <>
                          Next: {next.name}{" "}
                          <span className="text-xs text-muted">({TASK_STATUS_LABEL[next.status]})</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">No open task on this project</span>
                      )}
                    </p>
                    <div className="mt-2">
                      <AlertPills
                        eta={row.project.eta}
                        status={row.project.status}
                        actual={sumHours(row.project.timeEntries)}
                        estimated={row.project.estimatedHours}
                        warningDays={settings.etaWarningDays}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
