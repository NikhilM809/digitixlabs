"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createCurrency, setDefaultCurrency, updateCurrency } from "@/worknest/actions/currencies";
import { Button, Card, Field, Input } from "@/worknest/components/ui";

type CurrencyRow = {
  id: string;
  name: string;
  code: string;
  symbol: string;
  active: boolean;
  isDefault: boolean;
};

export function CurrencySettings({ currencies }: { currencies: CurrencyRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function add(formData: FormData) {
    start(async () => {
      const result = await createCurrency(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Currency added.");
      router.refresh();
    });
  }

  function save(id: string, formData: FormData) {
    start(async () => {
      const result = await updateCurrency(id, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Currency updated.");
      router.refresh();
    });
  }

  function makeDefault(id: string) {
    start(async () => {
      const result = await setDefaultCurrency(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Default currency updated.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="mb-4 font-display text-xl">Add currency</h2>
        <form action={add} className="grid gap-4 md:grid-cols-4">
          <Field label="Currency name">
            <Input name="name" required placeholder="Australian Dollar" />
          </Field>
          <Field label="Code">
            <Input name="code" required placeholder="AUD" maxLength={8} />
          </Field>
          <Field label="Symbol">
            <Input name="symbol" required placeholder="$" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </div>
        </form>
      </Card>
      <div className="grid gap-3">
        {currencies.map((currency) => (
          <Card key={currency.id} className="p-4">
            <form action={(formData) => save(currency.id, formData)} className="grid gap-3 md:grid-cols-6">
              <Input name="name" defaultValue={currency.name} />
              <Input name="code" defaultValue={currency.code} />
              <Input name="symbol" defaultValue={currency.symbol} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={currency.active} />
                Active
              </label>
              <p className="flex items-center text-sm text-muted">
                {currency.isDefault ? "Default currency" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Save
                </Button>
                {!currency.isDefault ? (
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => makeDefault(currency.id)}>
                    Set default
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
