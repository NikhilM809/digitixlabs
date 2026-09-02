import { createUser, updateUser } from "@/worknest/actions/users";
import { Button, Card, Field, Input, PageHeader, Select } from "@/worknest/components/ui";
import { ROLE_LABEL } from "@/worknest/lib/constants";
import { requireRole } from "@/worknest/lib/permissions";
import { listWorknestPeople } from "@/worknest/lib/users";
import { asFormAction } from "@/worknest/lib/utils";

export default async function EmployeesPage() {
  await requireRole("ADMIN");
  const users = await listWorknestPeople();

  return (
    <div>
      <PageHeader
        title="People"
        description="Create employees and managers, then assign them to projects. Only admins can add people."
      />
      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl">Add person</h2>
        <form action={asFormAction(createUser)} className="grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue="EMPLOYEE">
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
          <Field label="Temporary password">
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <div>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Card>
      <div className="grid gap-4">
        {users.map((person) => (
          <Card key={person.id} className="p-5">
            <form action={asFormAction(updateUser.bind(null, person.id))} className="grid gap-3 md:grid-cols-5">
              <Input name="name" defaultValue={person.name} />
              <Input name="email" defaultValue={person.email} />
              <Select name="role" defaultValue={person.role}>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input name="password" type="password" placeholder="New password (optional)" />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={person.active} />
                  Active
                </label>
                <Button type="submit" size="sm">
                  Save
                </Button>
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
