"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { WnProjectStatus } from "@prisma/client";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { createProject, updateProject } from "@/worknest/actions/projects";
import { Button, Card, Field, Input, Select, Textarea } from "@/worknest/components/ui";
import { PROJECT_STATUS_LABEL } from "@/worknest/lib/constants";
import { splitEstimatedHours } from "@/worknest/lib/work-types";
import { statusesAvailable } from "@/worknest/lib/project-status";

type Person = { id: string; name: string; role: Role };
type ClientOption = { id: string; name: string };

export function ProjectForm({
  mode,
  projectId,
  people,
  currencies,
  clients,
  canEditFinance,
  defaults,
}: {
  mode: "create" | "edit";
  projectId?: string;
  people: Person[];
  currencies?: { id: string; name: string; code: string; symbol: string }[];
  clients: ClientOption[];
  canEditFinance: boolean;
  defaults?: {
    name: string;
    code: string;
    clientName: string;
    description: string;
    managerId: string;
    status: WnProjectStatus;
    sellValue?: number;
    currencyId?: string;
    estimatedHours: number;
    programmerHours?: number;
    qaHours?: number;
    marginHours?: number;
    startDate?: string;
    eta: string;
    actualStartDate?: string;
    actualCompletionDate?: string;
    selfAssignEnabled: boolean;
    employeeIds: string[];
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const managers = people.filter((person) => person.role !== "EMPLOYEE");
  const employees = people.filter((person) => person.role === "EMPLOYEE");
  const initialSplit = splitEstimatedHours(defaults?.estimatedHours ?? 40);
  const [estimatedHours, setEstimatedHours] = useState(defaults?.estimatedHours ?? 40);
  const [splitTouched, setSplitTouched] = useState(false);
  const [programmerHours, setProgrammerHours] = useState(defaults?.programmerHours || initialSplit.programmer);
  const [qaHours, setQaHours] = useState(defaults?.qaHours || initialSplit.qa);
  const [marginHours, setMarginHours] = useState(defaults?.marginHours || initialSplit.margin);
  const autoSplit = useMemo(() => splitEstimatedHours(estimatedHours), [estimatedHours]);
  const shownProgrammer = splitTouched ? programmerHours : autoSplit.programmer;
  const shownQa = splitTouched ? qaHours : autoSplit.qa;
  const shownMargin = splitTouched ? marginHours : autoSplit.margin;
  const clientNames = useMemo(() => {
    const names = clients.map((client) => client.name);
    if (defaults?.clientName && !names.includes(defaults.clientName)) names.unshift(defaults.clientName);
    return names;
  }, [clients, defaults?.clientName]);

  function onEstimatedHoursChange(value: number) {
    setEstimatedHours(value);
    if (!splitTouched) {
      const next = splitEstimatedHours(value);
      setProgrammerHours(next.programmer);
      setQaHours(next.qa);
      setMarginHours(next.margin);
    }
  }

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const result =
        mode === "create"
          ? await createProject(formData)
          : await updateProject(projectId!, formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Project created." : "Project updated.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-6">
      <Card className="grid gap-4 p-6 md:grid-cols-2">
        <h2 className="font-display text-xl md:col-span-2">Basic information</h2>
        <Field label="Project name">
          <Input name="name" required defaultValue={defaults?.name} />
        </Field>
        <Field label="Project ID">
          <Input
            name="code"
            placeholder="Auto-generated if empty"
            defaultValue={defaults?.code}
            readOnly={!canEditFinance && mode === "edit"}
          />
        </Field>
        <Field label="Client name">
          <Select name="clientName" required defaultValue={defaults?.clientName || clientNames[0] || ""}>
            <option value="">Select client</option>
            {clientNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          {canEditFinance ? (
            <span className="text-xs text-muted">Add more clients in Settings.</span>
          ) : null}
        </Field>
        <Field label="Project manager">
          {canEditFinance ? (
            <Select name="managerId" required defaultValue={defaults?.managerId}>
              <option value="">Select manager</option>
              {managers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <input type="hidden" name="managerId" value={defaults?.managerId ?? ""} />
              <Input
                readOnly
                defaultValue={managers.find((person) => person.id === defaults?.managerId)?.name ?? "You"}
              />
            </>
          )}
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={defaults?.status ?? "BID"}>
            {statusesAvailable(defaults?.status ?? "BID").map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assigned employees" className="md:col-span-2">
          <select
            name="employeeIds"
            multiple
            defaultValue={defaults?.employeeIds}
            className="min-h-32 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          >
            {employees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">Hold Ctrl/Cmd to select multiple.</span>
        </Field>
        <Field label="Description" className="md:col-span-2">
          <Textarea name="description" defaultValue={defaults?.description} />
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="selfAssignEnabled" defaultChecked={defaults?.selfAssignEnabled ?? true} />
          Allow employees to self-assign available tasks
        </label>
      </Card>

      {canEditFinance ? (
        <Card className="grid gap-4 p-6 md:grid-cols-2">
          <h2 className="font-display text-xl md:col-span-2">Commercial</h2>
          <Field label="Project value">
            <Input name="sellValue" type="number" min="0" step="1" required defaultValue={defaults?.sellValue} />
          </Field>
          <Field label="Currency">
            <Select name="currencyId" required defaultValue={defaults?.currencyId}>
              <option value="">Select currency</option>
              {(currencies ?? []).map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} — {currency.name} ({currency.symbol})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated hours">
            <Input
              name="estimatedHours"
              type="number"
              min="0.5"
              step="0.5"
              required
              value={estimatedHours}
              onChange={(event) => onEstimatedHoursChange(Number(event.target.value))}
            />
          </Field>
          <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
            <Field label="Programmer hours (60%)">
              <Input
                name="programmerHours"
                type="number"
                min="0"
                step="0.1"
                value={shownProgrammer}
                onChange={(event) => {
                  setSplitTouched(true);
                  setProgrammerHours(Number(event.target.value));
                }}
              />
            </Field>
            <Field label="QA hours (30%)">
              <Input
                name="qaHours"
                type="number"
                min="0"
                step="0.1"
                value={shownQa}
                onChange={(event) => {
                  setSplitTouched(true);
                  setQaHours(Number(event.target.value));
                }}
              />
            </Field>
            <Field label="Margin / profit hours (10%)">
              <Input
                name="marginHours"
                type="number"
                min="0"
                step="0.1"
                value={shownMargin}
                onChange={(event) => {
                  setSplitTouched(true);
                  setMarginHours(Number(event.target.value));
                }}
              />
            </Field>
          </div>
          <p className="text-xs text-muted md:col-span-2">
            Hours split automatically from the estimate. Edit any of the three fields to override.
          </p>
        </Card>
      ) : (
        <Card className="grid gap-4 p-6 md:grid-cols-2">
          <h2 className="font-display text-xl md:col-span-2">Hours</h2>
          <Field label="Estimated hours">
            <Input name="estimatedHours" type="number" min="0.5" step="0.5" required defaultValue={defaults?.estimatedHours} />
          </Field>
        </Card>
      )}

      <Card className="grid gap-4 p-6 md:grid-cols-2">
        <h2 className="font-display text-xl md:col-span-2">Timeline</h2>
        <Field label="Start date">
          <Input name="startDate" type="date" defaultValue={defaults?.startDate} />
        </Field>
        <Field label="ETA / due date">
          <Input name="eta" type="date" required defaultValue={defaults?.eta} />
        </Field>
        <Field label="Actual start date">
          <Input name="actualStartDate" type="date" defaultValue={defaults?.actualStartDate} />
        </Field>
        <Field label="Actual completion date">
          <Input name="actualCompletionDate" type="date" defaultValue={defaults?.actualCompletionDate} />
        </Field>
      </Card>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create project" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
