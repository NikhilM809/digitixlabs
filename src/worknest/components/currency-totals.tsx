import { formatMoney } from "@/worknest/lib/format";
import { Card } from "@/worknest/components/ui";

export function CurrencyTotals({
  title,
  totals,
}: {
  title: string;
  totals: [string, number][];
}) {
  if (totals.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
        <p className="mt-2 text-sm text-muted">No amounts yet.</p>
      </Card>
    );
  }
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-3 space-y-1">
        {totals.map(([code, amount]) => (
          <li key={code} className="flex justify-between text-sm">
            <span>{code}</span>
            <span className="font-medium">{formatMoney(amount, code)}</span>
          </li>
        ))}
      </ul>
      {totals.length > 1 ? (
        <p className="mt-3 text-xs text-muted">Totals are shown separately by currency. Values are not added together.</p>
      ) : null}
    </Card>
  );
}
