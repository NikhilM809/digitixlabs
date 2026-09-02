import { z } from "zod";

export const orgChartLayoutSchema = z.object({
  direction: z.enum(["vertical", "horizontal"]).default("vertical"),
  density: z.enum(["compact", "comfortable", "wide"]).default("comfortable"),
  /** parentKey -> ordered child node ids (use "root" for top-level roots) */
  siblingOrders: z.record(z.array(z.string())).default({}),
});

export type OrgChartLayoutSettings = z.infer<typeof orgChartLayoutSchema>;

export const DEFAULT_ORG_CHART_LAYOUT: OrgChartLayoutSettings = {
  direction: "vertical",
  density: "comfortable",
  siblingOrders: {},
};

export function parseOrgChartLayout(raw: string | null | undefined): OrgChartLayoutSettings {
  if (!raw) return DEFAULT_ORG_CHART_LAYOUT;
  try {
    const parsed = orgChartLayoutSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_ORG_CHART_LAYOUT;
  } catch {
    return DEFAULT_ORG_CHART_LAYOUT;
  }
}

type LayoutNode = { id: string; children: LayoutNode[] };

function compareByName(
  a: LayoutNode & { firstName?: string; lastName?: string },
  b: LayoutNode & { firstName?: string; lastName?: string }
) {
  if (a.firstName && a.lastName && b.firstName && b.lastName) {
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  }
  return 0;
}

function sortNodesWithLayout<T extends LayoutNode>(
  nodes: T[],
  parentKey: string,
  siblingOrders: Record<string, string[]>
): T[] {
  const order = siblingOrders[parentKey];
  const sorted = [...nodes];

  if (order?.length) {
    const rank = new Map(order.map((id, index) => [id, index]));
    sorted.sort((a, b) => {
      const aRank = rank.get(a.id);
      const bRank = rank.get(b.id);
      if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
      if (aRank !== undefined) return -1;
      if (bRank !== undefined) return 1;
      return compareByName(
        a as LayoutNode & { firstName?: string; lastName?: string },
        b as LayoutNode & { firstName?: string; lastName?: string }
      );
    });
  } else {
    sorted.sort((a, b) =>
      compareByName(
        a as LayoutNode & { firstName?: string; lastName?: string },
        b as LayoutNode & { firstName?: string; lastName?: string }
      )
    );
  }

  return sorted.map((node) => ({
    ...node,
    children: sortNodesWithLayout(node.children as T[], node.id, siblingOrders),
  }));
}

/** Reorder displayed siblings only — does not change managerId / reporting. */
export function applyOrgChartLayoutToTree<T extends LayoutNode & { isAdministrativePlaceholder?: boolean }>(
  nodes: T[],
  layout: OrgChartLayoutSettings
): T[] {
  const { systemRoots, administrativeRoots } = splitOrgChartRoots(nodes);
  const sortedSystem = sortNodesWithLayout(systemRoots, "root", layout.siblingOrders);
  const sortedAdmin = administrativeRoots.map((root) => ({
    ...root,
    children: sortNodesWithLayout(root.children as T[], root.id, layout.siblingOrders),
  }));
  return [...sortedSystem, ...sortedAdmin];
}

export function splitOrgChartRoots<T extends LayoutNode & { isAdministrativePlaceholder?: boolean }>(
  nodes: T[]
) {
  const systemRoots = nodes.filter((n) => !n.isAdministrativePlaceholder);
  const administrativeRoots = nodes.filter((n) => n.isAdministrativePlaceholder);
  return { systemRoots, administrativeRoots };
}

export function reorderSiblingIds(
  currentOrder: string[],
  draggedId: string,
  targetId: string,
  position: "before" | "after"
) {
  const without = currentOrder.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  if (targetIndex < 0) return currentOrder;

  const insertAt = position === "before" ? targetIndex : targetIndex + 1;
  const next = [...without];
  next.splice(insertAt, 0, draggedId);
  return next;
}

export function getOrgChartDensityClass(density: OrgChartLayoutSettings["density"]) {
  switch (density) {
    case "compact":
      return {
        card: "w-[120px] p-2",
        gap: "gap-x-3 gap-y-4",
        rootGap: "gap-4",
        avatar: "h-8 w-8",
        connector: "pt-4",
      };
    case "wide":
      return {
        card: "w-[176px] p-3",
        gap: "gap-x-8 gap-y-8",
        rootGap: "gap-10",
        avatar: "h-12 w-12",
        connector: "pt-6",
      };
    default:
      return {
        card: "w-[148px] p-2.5",
        gap: "gap-x-4 gap-y-6",
        rootGap: "gap-6",
        avatar: "h-10 w-10",
        connector: "pt-5",
      };
  }
}
