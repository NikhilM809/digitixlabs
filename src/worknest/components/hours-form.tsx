"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addHours } from "@/worknest/actions/hours";
import { Button, Field, Input, Select, Textarea } from "@/worknest/components/ui";

type TaskOption = { id: string; name: string; projectId: string };
type ProjectOption = { id: string; name: string; code: string };
type WorkTypeOption = { code: string; name: string };

export function AddHoursForm({
  projects,
  tasks,
  workTypes,
  defaultProjectId,
  employees,
  canChooseEmployee,
}: {
  projects: ProjectOption[];
  tasks: TaskOption[];
  workTypes: WorkTypeOption[];
  defaultProjectId?: string;
  employees?: { id: string; name: string }[];
  canChooseEmployee?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const filteredTasks = useMemo(
    () => tasks.filter((task) => task.projectId === projectId),
    [tasks, projectId],
  );

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await addHours(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Hours saved.");
      router.refresh();
    });
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted">No assigned projects yet.</p>;
  }

  return (
    <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
      <Field label="Project">
        <Select name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Task">
        <Select name="taskId" defaultValue="">
          <option value="">No specific task</option>
          {filteredTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </Select>
      </Field>
      {canChooseEmployee && employees ? (
        <Field label="Employee">
          <Select name="employeeId">
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Date">
        <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </Field>
      <Field label="Work type">
        <Select name="workType" required defaultValue={workTypes[0]?.code ?? ""}>
          {workTypes.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Hours">
        <Input name="hours" type="number" min="0.5" max="24" step="0.5" required />
      </Field>
      <Field label="Notes" className="md:col-span-2">
        <Textarea name="notes" placeholder="What did you work on?" />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Add hours"}
        </Button>
      </div>
    </form>
  );
}
