import { ProjectForm } from "@/worknest/components/project-form";
import { PageHeader } from "@/worknest/components/ui";
import { prisma } from "@/lib/prisma";
import { nextProjectCode } from "@/worknest/lib/data";
import { getActiveClients } from "@/worknest/lib/catalog";
import { getActiveCurrencies, getDefaultCurrency } from "@/worknest/lib/currency";
import { requireRole } from "@/worknest/lib/permissions";
import { listWorknestPeople } from "@/worknest/lib/users";

export default async function NewProjectPage() {
  const user = await requireRole("ADMIN");
  const [peopleRaw, code, currencies, fallback, clients] = await Promise.all([
    listWorknestPeople({ activeOnly: true }),
    nextProjectCode(),
    getActiveCurrencies(),
    getDefaultCurrency(),
    getActiveClients(),
  ]);
  const people = peopleRaw.map((person) => ({ id: person.id, name: person.name, role: person.role }));

  return (
    <div>
      <PageHeader title="New project" description="Set the project value, hours split, ETA, and team." />
      <ProjectForm
        mode="create"
        people={people}
        currencies={currencies}
        clients={clients}
        canEditFinance
        defaults={{
          name: "",
          code,
          clientName: clients[0]?.name ?? "",
          description: "",
          managerId: people.find((p) => p.role === "MANAGER")?.id ?? user.id,
          status: "BID",
          sellValue: 0,
          currencyId: fallback.id,
          estimatedHours: 40,
          eta: "",
          selfAssignEnabled: true,
          employeeIds: [],
        }}
      />
    </div>
  );
}
