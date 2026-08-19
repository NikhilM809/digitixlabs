"use client";

import { PERMISSION_MODULES } from "@/lib/permission-definitions";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PermissionItem {
  id: string;
  name: string;
  description: string | null;
  module: string;
  action: string | null;
}

interface PermissionMatrixProps {
  permissions: PermissionItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

function MatrixCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-4 w-4 rounded border-border accent-brand-600"
    />
  );
}

export function PermissionMatrix({
  permissions,
  selectedIds,
  onChange,
  disabled,
}: PermissionMatrixProps) {
  const permissionByModule = Object.keys(PERMISSION_MODULES).map((moduleKey) => ({
    moduleKey,
    label: PERMISSION_MODULES[moduleKey as keyof typeof PERMISSION_MODULES].label,
    items: permissions.filter((p) => p.module === moduleKey),
  }));

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...new Set([...selectedIds, id])]);
    } else {
      onChange(selectedIds.filter((x) => x !== id));
    }
  };

  const toggleModule = (moduleItems: PermissionItem[], checked: boolean) => {
    const ids = moduleItems.map((p) => p.id);
    if (checked) {
      onChange([...new Set([...selectedIds, ...ids])]);
    } else {
      onChange(selectedIds.filter((id) => !ids.includes(id)));
    }
  };

  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
      {permissionByModule.map(({ moduleKey, label, items }) => {
        if (items.length === 0) return null;
        const allSelected = items.every((p) => selectedIds.includes(p.id));
        const someSelected = items.some((p) => selectedIds.includes(p.id));

        return (
          <div key={moduleKey} className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MatrixCheckbox
                id={`module-${moduleKey}`}
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={(v) => toggleModule(items, v)}
                disabled={disabled}
              />
              <Label htmlFor={`module-${moduleKey}`} className="font-medium">
                {label}
              </Label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 pl-6">
              {items.map((perm) => (
                <label
                  key={perm.id}
                  className={cn(
                    "flex items-start gap-2 text-sm cursor-pointer",
                    disabled && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <MatrixCheckbox
                    checked={selectedIds.includes(perm.id)}
                    onChange={(v) => toggle(perm.id, v)}
                    disabled={disabled}
                  />
                  <span>
                    <span className="font-medium">{perm.description ?? perm.name}</span>
                    <span className="block text-xs text-muted-foreground">{perm.name}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
