import Link from "next/link";
import { WnTaskStatus } from "@prisma/client";
import { Card, EmptyState } from "@/worknest/components/ui";
import { TaskBadge } from "@/worknest/components/status";
import { cn } from "@/lib/utils";

export type FocusItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  status?: WnTaskStatus;
  tone?: "danger" | "gold" | "default";
};

export function FocusList({
  title,
  empty,
  items,
  action,
}: {
  title: string;
  empty: string;
  items: FocusItem[];
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-display text-xl">{title}</h2>
        {action}
      </div>
      {items.length === 0 ? (
        <EmptyState title="All clear" description={empty} />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs",
                      item.tone === "danger" ? "text-danger" : item.tone === "gold" ? "text-gold" : "text-muted",
                    )}
                  >
                    {item.meta}
                  </p>
                </div>
                {item.status ? <TaskBadge status={item.status} /> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
