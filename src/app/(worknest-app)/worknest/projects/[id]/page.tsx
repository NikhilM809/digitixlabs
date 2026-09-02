import Link from "next/link";
import { format } from "date-fns";
import { addProjectNote } from "@/worknest/actions/misc";
import { closeProject, deleteProject, reopenProject } from "@/worknest/actions/projects";
import { reviewHours } from "@/worknest/actions/hours";
import { createTask } from "@/worknest/actions/tasks";
import { ProjectForm } from "@/worknest/components/project-form";
import { WnProjectStatusForm } from "@/worknest/components/project-status-form";
import { AddHoursForm } from "@/worknest/components/hours-form";
import { AlertPills, BillingBadge, HoursBar, TaskBadge } from "@/worknest/components/status";
import { ConfirmForm } from "@/worknest/components/confirm-form";
import { ExportApprovalButton } from "@/worknest/components/export-approval-button";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/worknest/components/ui";
import { PROJECT_STATUS_LABEL, TASK_STATUS_LABEL, workTypeLabel } from "@/worknest/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSettings, hoursByWorkType, sumHours } from "@/worknest/lib/data";
import { billingStatusForProject } from "@/worknest/lib/finance";
import { getActiveCurrencies } from "@/worknest/lib/currency";
import { getActiveClients, getActiveWorkTypes } from "@/worknest/lib/catalog";
import { formatDate, formatHours, formatMoney } from "@/worknest/lib/format";
import { canSeeFinance, requireRole } from "@/worknest/lib/permissions";
import { userDisplayName } from "@/worknest/lib/user-adapter";
import { listWorknestPeople } from "@/worknest/lib/users";
import { asFormAction } from "@/worknest/lib/utils";
import { notFound } from "next/navigation";

function iso(value?: Date | null) {
  return value ? format(value, "yyyy-MM-dd") : "";
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole("ADMIN", "MANAGER");
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const finance = canSeeFinance(user.role);
  const settings = await getSettings();
  const project = await prisma.wnProject.findUnique({
    where: { id },
    include: {
      manager: true,
      statusChangedBy: true,
      assignments: { include: { employee: true, assignedBy: true } },
      tasks: { include: { assignedEmployee: true, assignedBy: true, timeEntries: true } },
      timeEntries: { include: { employee: true, task: true }, orderBy: { date: "desc" } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      invoices: true,
      currency: true,
      exports: { include: { exportedBy: true }, orderBy: { exportedAt: "desc" }, take: 5 },
      statusChanges: { include: { changedBy: true }, orderBy: { changedAt: "desc" }, take: 8 },
    },
  });
  if (!project) notFound();

  const actual = sumHours(project.timeEntries);
  const breakdown = hoursByWorkType(project.timeEntries);
  const people = await listWorknestPeople({ activeOnly: true });
  const employees = people.filter((p) => p.role === "EMPLOYEE");
  const currencies = finance ? await getActiveCurrencies() : [];
  const [clients, workTypes] = await Promise.all([getActiveClients(), getActiveWorkTypes()]);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "team", label: "Team" },
    { id: "tasks", label: "Tasks" },
    { id: "time", label: "Time tracking" },
    { id: "notes", label: "Notes" },
    { id: "edit", label: "Edit" },
  ];

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.code} · ${project.clientName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {project.status !== "CLOSE" && project.status !== "CANCEL" ? (
              <ConfirmForm message="Close this project? It will move to Closed Projects and become eligible for billing." action={closeProject.bind(null, project.id)}>
                <Button variant="outline">Mark closed</Button>
              </ConfirmForm>
            ) : user.role === "ADMIN" && project.status === "CLOSE" ? (
              <>
                <ExportApprovalButton projectId={project.id} />
                <ConfirmForm message="Reopen this project?" action={reopenProject.bind(null, project.id)}>
                  <Button variant="outline">Reopen</Button>
                </ConfirmForm>
              </>
            ) : user.role === "ADMIN" && project.status === "CANCEL" ? (
              <ConfirmForm message="Reopen this project?" action={reopenProject.bind(null, project.id)}>
                <Button variant="outline">Reopen</Button>
              </ConfirmForm>
            ) : null}
            {user.role === "ADMIN" ? (
              <ConfirmForm
                message="Remove this project permanently? Hours, tasks, and invoices on it will also be deleted."
                action={deleteProject.bind(null, project.id)}
              >
                <Button variant="danger">Remove project</Button>
              </ConfirmForm>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <WnProjectStatusForm
          projectId={project.id}
          status={project.status}
          changedByName={project.statusChangedBy ? userDisplayName(project.statusChangedBy) : undefined}
          changedAt={project.statusChangedAt}
        />
        <AlertPills
          eta={project.eta}
          status={project.status}
          actual={actual}
          estimated={project.estimatedHours}
          warningDays={settings.etaWarningDays}
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/worknest/projects/${project.id}?tab=${item.id}`}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === item.id ? "bg-navy text-white" : "bg-black/5 dark:bg-white/5"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted">Project ID</dt>
                <dd className="mt-1 font-medium">{project.code}</dd>
              </div>
              <div>
                <dt className="text-muted">Manager</dt>
                <dd className="mt-1 font-medium">{userDisplayName(project.manager)}</dd>
              </div>
              <div>
                <dt className="text-muted">ETA</dt>
                <dd className="mt-1 font-medium">{formatDate(project.eta)}</dd>
              </div>
              <div>
                <dt className="text-muted">Remaining hours</dt>
                <dd className="mt-1 font-medium">{formatHours(project.estimatedHours - actual)}</dd>
              </div>
                  {finance ? (
                <>
                  <div>
                    <dt className="text-muted">Project value</dt>
                    <dd className="mt-1 font-medium">
                      {formatMoney(project.sellValue, project.currency?.code)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Currency</dt>
                    <dd className="mt-1 font-medium">
                      {project.currency
                        ? `${project.currency.name} (${project.currency.code})`
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Programmer / QA / margin</dt>
                    <dd className="mt-1 font-medium">
                      {formatHours(project.programmerHours)} / {formatHours(project.qaHours)} /{" "}
                      {formatHours(project.marginHours)} hrs
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Billing status</dt>
                    <dd className="mt-1">
                      <BillingBadge
                        status={billingStatusForProject(
                          project.status,
                          project.invoices,
                          project.billingStage,
                        )}
                      />
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
            <p className="mt-6 text-sm text-muted">{project.description || "No description."}</p>
          </Card>
          <Card className="p-6">
            <HoursBar actual={actual} estimated={project.estimatedHours} />
            <div className="mt-4 space-y-2 text-sm">
              <p>Initial: {formatHours(breakdown.initial)}</p>
              <p>Changes: {formatHours(breakdown.changes)}</p>
              <p>Live / PM: {formatHours(breakdown.live)}</p>
              {breakdown.other > 0 ? <p>Other: {formatHours(breakdown.other)}</p> : null}
              <p className="font-medium">Total: {formatHours(breakdown.total)}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "overview" && project.statusChanges.length > 0 ? (
        <Card className="mt-6 overflow-x-auto">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Status history</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">From</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Changed by</th>
                <th className="px-5 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {project.statusChanges.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{PROJECT_STATUS_LABEL[row.fromStatus as keyof typeof PROJECT_STATUS_LABEL] ?? row.fromStatus}</td>
                  <td className="px-5 py-3">{PROJECT_STATUS_LABEL[row.toStatus as keyof typeof PROJECT_STATUS_LABEL] ?? row.toStatus}</td>
                  <td className="px-5 py-3">{userDisplayName(row.changedBy)}</td>
                  <td className="px-5 py-3">{row.changedAt.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "overview" && finance && project.exports.length > 0 ? (
        <Card className="mt-6 overflow-x-auto">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Excel export history</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Exported by</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Billing month</th>
                <th className="px-5 py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {project.exports.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{userDisplayName(row.exportedBy)}</td>
                  <td className="px-5 py-3">{row.exportedAt.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3">{format(new Date(row.billingYear, row.billingMonth - 1, 1), "MMMM yyyy")}</td>
                  <td className="px-5 py-3">{row.exportType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "team" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Person</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Assigned by</th>
                <th className="px-5 py-3">Assigned date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-5 py-3">{userDisplayName(project.manager)}</td>
                <td className="px-5 py-3">Project manager</td>
                <td className="px-5 py-3">—</td>
                <td className="px-5 py-3">{formatDate(project.createdAt)}</td>
              </tr>
              {project.assignments.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{userDisplayName(row.employee)}</td>
                  <td className="px-5 py-3">Employee</td>
                  <td className="px-5 py-3">{userDisplayName(row.assignedBy)}</td>
                  <td className="px-5 py-3">{formatDate(row.assignedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "tasks" ? (
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-xl">Add task</h2>
            <form action={asFormAction(createTask.bind(null, project.id))} className="grid gap-4 md:grid-cols-3">
              <Field label="Task name">
                <Input name="name" required />
              </Field>
              <Field label="Assigned employee">
                <Select name="assignedEmployeeId" defaultValue="">
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estimated hours">
                <Input name="estimatedHours" type="number" step="0.5" defaultValue="8" />
              </Field>
              <Field label="Start date">
                <Input name="startDate" type="date" />
              </Field>
              <Field label="Due date">
                <Input name="dueDate" type="date" />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="NOT_STARTED">
                  {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" className="md:col-span-3">
                <Textarea name="description" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="selfAssignEnabled" defaultChecked />
                Self-assign enabled
              </label>
              <div>
                <Button type="submit">Add task</Button>
              </div>
            </form>
          </Card>
          <Card className="overflow-x-auto">
            {project.tasks.length === 0 ? (
              <EmptyState title="No tasks yet" description="Add the first task for this project." />
            ) : (
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-3">Task</th>
                    <th className="px-5 py-3">Assigned</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Est.</th>
                    <th className="px-5 py-3 text-right">Actual</th>
                    <th className="px-5 py-3">Due</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map((task) => (
                    <tr key={task.id} className="border-t border-line align-top">
                      <td className="px-5 py-3">
                        <p className="font-medium">{task.name}</p>
                        <p className="text-xs text-muted">{task.description}</p>
                      </td>
                      <td className="px-5 py-3">
                        {task.assignedEmployee ? userDisplayName(task.assignedEmployee) : "Unassigned"}
                      </td>
                      <td className="px-5 py-3">
                        <TaskBadge status={task.status} />
                      </td>
                      <td className="px-5 py-3 text-right">{formatHours(task.estimatedHours)}</td>
                      <td className="px-5 py-3 text-right">{formatHours(sumHours(task.timeEntries))}</td>
                      <td className="px-5 py-3">{formatDate(task.dueDate)}</td>
                      <td className="px-5 py-3 text-muted">{task.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "time" ? (
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-xl">Add hours</h2>
            <AddHoursForm
              projects={[{ id: project.id, name: project.name, code: project.code }]}
              tasks={project.tasks.map((t) => ({ id: t.id, name: t.name, projectId: project.id }))}
              workTypes={workTypes}
              defaultProjectId={project.id}
              employees={employees}
              canChooseEmployee={user.role !== "EMPLOYEE"}
            />
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Work type</th>
                  <th className="px-5 py-3 text-right">Hours</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3">Review</th>
                </tr>
              </thead>
              <tbody>
                {project.timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="px-5 py-3">{formatDate(entry.date)}</td>
                    <td className="px-5 py-3">{userDisplayName(entry.employee)}</td>
                    <td className="px-5 py-3">{workTypeLabel(entry.workType)}</td>
                    <td className="px-5 py-3 text-right">{formatHours(entry.hours)}</td>
                    <td className="px-5 py-3">{entry.notes || "—"}</td>
                    <td className="px-5 py-3">
                      {entry.status === "REVIEWED" ? (
                        "Reviewed"
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
      ) : null}

      {tab === "notes" ? (
        <div className="grid gap-6">
          <Card className="p-6">
            <form action={asFormAction(addProjectNote.bind(null, project.id))} className="grid gap-3">
              <Field label="Add a note">
                <Textarea name="content" required />
              </Field>
              <div>
                <Button type="submit">Post note</Button>
              </div>
            </form>
          </Card>
          <div className="space-y-3">
            {project.notes.map((note) => (
              <Card key={note.id} className="p-4">
                <p className="text-sm">{note.content}</p>
                <p className="mt-2 text-xs text-muted">
                  {userDisplayName(note.author)} · {formatDate(note.createdAt)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "edit" ? (
        <ProjectForm
          mode="edit"
          projectId={project.id}
          people={people}
          currencies={currencies}
          clients={clients}
          canEditFinance={finance}
          defaults={{
            name: project.name,
            code: project.code,
            clientName: project.clientName,
            description: project.description,
            managerId: project.managerId,
            status: project.status,
            sellValue: finance ? project.sellValue : undefined,
            currencyId: project.currencyId ?? undefined,
            estimatedHours: project.estimatedHours,
            programmerHours: project.programmerHours,
            qaHours: project.qaHours,
            marginHours: project.marginHours,
            startDate: iso(project.startDate),
            eta: iso(project.eta),
            actualStartDate: iso(project.actualStartDate),
            actualCompletionDate: iso(project.actualCompletionDate),
            selfAssignEnabled: project.selfAssignEnabled,
            employeeIds: project.assignments.map((row) => row.employeeId),
          }}
        />
      ) : null}
    </div>
  );
}
