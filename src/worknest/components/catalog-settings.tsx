"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addClient, addInvoiceService, addWorkType, saveClient } from "@/worknest/actions/catalog";
import { Button, Card, Field, Input, Select, Textarea } from "@/worknest/components/ui";

type ClientRow = {
  id: string;
  name: string;
  legalName: string;
  address: string;
  active: boolean;
};

export function CatalogSettings({
  clients,
  services,
  workTypes,
}: {
  clients: ClientRow[];
  services: { id: string; name: string }[];
  workTypes: { id: string; code: string; name: string; category: string }[];
}) {
  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="mb-1 font-display text-xl">Clients</h2>
        <p className="mb-4 text-sm text-muted">
          Used on projects, filters, and invoice bill-to. Legal name and address print on invoices.
        </p>
        <AddClientForm />
        <div className="mt-6 space-y-4">
          {clients.map((client) => (
            <ClientRowForm key={client.id} client={client} />
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-1 font-display text-xl">Services on invoice</h2>
        <p className="mb-4 text-sm text-muted">Choose one of these when generating an invoice.</p>
        <AddServiceForm />
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          {services.map((service) => (
            <li key={service.id}>{service.name}</li>
          ))}
        </ul>
      </Card>
      <Card className="p-6">
        <h2 className="mb-1 font-display text-xl">Work types</h2>
        <p className="mb-4 text-sm text-muted">These appear on the Hours tab when logging time.</p>
        <AddWorkTypeForm />
        <ul className="mt-4 space-y-1 text-sm">
          {workTypes.map((item) => (
            <li key={item.id}>
              <span className="font-medium">{item.name}</span>
              <span className="text-muted"> · {item.category}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function AddClientForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await addClient(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Client added.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3 md:grid-cols-3">
      <Field label="Client name">
        <Input name="name" required placeholder="Pureprofile" />
      </Field>
      <Field label="Legal name on invoice">
        <Input name="legalName" placeholder="PUREPROFILE LIMITED" />
      </Field>
      <Field label="Invoice address" className="md:col-span-3">
        <Textarea name="address" placeholder="Address printed on invoices" />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add client"}
        </Button>
      </div>
    </form>
  );
}

function ClientRowForm({ client }: { client: ClientRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await saveClient(client.id, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Client saved.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-3">
      <Field label="Client name">
        <Input name="name" required defaultValue={client.name} />
      </Field>
      <Field label="Legal name">
        <Input name="legalName" defaultValue={client.legalName} />
      </Field>
      <label className="flex items-center gap-2 text-sm md:col-span-1">
        <input type="checkbox" name="active" defaultChecked={client.active} />
        Active
      </label>
      <Field label="Invoice address" className="md:col-span-3">
        <Textarea name="address" defaultValue={client.address} />
      </Field>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function AddServiceForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await addInvoiceService(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Service added.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Service name">
        <Input name="name" required placeholder="Survey Programming and Consulting" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add service"}
      </Button>
    </form>
  );
}

export function AddWorkTypeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [category, setCategory] = useState("other");

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await addWorkType(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Work type added.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Work type name">
        <Input name="name" required placeholder="Initial QA" />
      </Field>
      <Field label="Category">
        <Select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="initial">Initial</option>
          <option value="changes">Changes</option>
          <option value="live">Live</option>
          <option value="pm">Project management</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add work type"}
      </Button>
    </form>
  );
}
