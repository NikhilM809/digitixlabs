import { saveSettings } from "@/worknest/actions/misc";
import { CatalogSettings } from "@/worknest/components/catalog-settings";
import { CurrencySettings } from "@/worknest/components/currency-settings";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/worknest/components/ui";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/worknest/lib/data";
import { ensureCatalog } from "@/worknest/lib/catalog";
import { getAllCurrencies } from "@/worknest/lib/currency";
import { requireRole } from "@/worknest/lib/permissions";
import { asFormAction } from "@/worknest/lib/utils";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  await ensureCatalog();
  const [settings, currencies, clients, services, workTypes] = await Promise.all([
    getSettings(),
    getAllCurrencies(),
    prisma.wnClient.findMany({ orderBy: { name: "asc" } }),
    prisma.wnInvoiceService.findMany({ orderBy: { name: "asc" } }),
    prisma.wnWorkTypeOption.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Settings" description="Company, tax, and bank details used on invoices." />
      <form action={asFormAction(saveSettings)} className="grid gap-6">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-xl">Company</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name">
              <Input name="companyName" defaultValue={settings.companyName} required />
            </Field>
            <Field label="Invoice prefix">
              <Input name="invoicePrefix" defaultValue={settings.invoicePrefix} required />
            </Field>
            <Field label="Email">
              <Input name="companyEmail" defaultValue={settings.companyEmail} />
            </Field>
            <Field label="Phone">
              <Input name="companyPhone" defaultValue={settings.companyPhone} />
            </Field>
            <Field label="Address" className="md:col-span-2">
              <Textarea name="companyAddress" defaultValue={settings.companyAddress} />
            </Field>
            <Field label="Logo URL">
              <Input name="logoUrl" defaultValue={settings.logoUrl} />
            </Field>
            <Field label="ETA warning (days)">
              <Input name="etaWarningDays" type="number" min="1" defaultValue={settings.etaWarningDays} />
            </Field>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 font-display text-xl">Tax numbers</h2>
          <p className="mb-4 text-sm text-muted">These print on the invoice under Bill from.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="PAN">
              <Input name="panNumber" defaultValue={settings.panNumber} />
            </Field>
            <Field label="TAN">
              <Input name="tanNumber" defaultValue={settings.tanNumber} />
            </Field>
            <Field label="GSTIN">
              <Input name="gstin" defaultValue={settings.gstin} />
            </Field>
            <Field label="LUT number">
              <Input name="lutNumber" defaultValue={settings.lutNumber} />
            </Field>
            <Field label="Default GST rate (%)">
              <Input name="gstRate" type="number" min="0" step="0.01" defaultValue={settings.gstRate} />
            </Field>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-1 font-display text-xl">Bank details</h2>
          <p className="mb-4 text-sm text-muted">Printed on the last page of every invoice.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Account name">
              <Input name="bankAccountName" defaultValue={settings.bankAccountName} />
            </Field>
            <Field label="Bank name">
              <Input name="bankName" defaultValue={settings.bankName} />
            </Field>
            <Field label="Account number">
              <Input name="bankAccountNumber" defaultValue={settings.bankAccountNumber} />
            </Field>
            <Field label="IFSC">
              <Input name="bankIfsc" defaultValue={settings.bankIfsc} />
            </Field>
            <Field label="SWIFT">
              <Input name="bankSwift" defaultValue={settings.bankSwift} />
            </Field>
            <Field label="MICR">
              <Input name="bankMicr" defaultValue={settings.bankMicr} />
            </Field>
            <Field label="Branch">
              <Input name="bankBranch" defaultValue={settings.bankBranch} />
            </Field>
            <Field label="Branch code">
              <Input name="bankBranchCode" defaultValue={settings.bankBranchCode} />
            </Field>
            <Field label="Country">
              <Input name="bankCountry" defaultValue={settings.bankCountry} />
            </Field>
          </div>
        </Card>
        <div>
          <Button type="submit">Save settings</Button>
        </div>
      </form>
      <h2 className="mb-4 mt-10 font-display text-2xl">Clients, invoice services, and work types</h2>
      <p className="mb-4 text-sm text-muted">
        Manage the client and service dropdowns used on invoices, plus extra work types for the Hours tab.
      </p>
      <CatalogSettings clients={clients} services={services} workTypes={workTypes} />
      <h2 className="mb-4 mt-10 font-display text-2xl">Currencies</h2>
      <p className="mb-4 text-sm text-muted">
        Project values, invoices, and reports use these currencies. Do not mix totals across currencies.
      </p>
      <CurrencySettings currencies={currencies} />
    </div>
  );
}
