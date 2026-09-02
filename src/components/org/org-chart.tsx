"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical, Search, ZoomIn, ZoomOut, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import {
  DEFAULT_ORG_CHART_LAYOUT,
  getOrgChartDensityClass,
  reorderSiblingIds,
  splitOrgChartRoots,
  type OrgChartLayoutSettings,
} from "@/lib/org-chart-layout";

export interface OrgChartNodeData {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  avatar: string | null;
  managerName: string | null;
  directReportCount: number;
  department: { name: string } | null;
  designation: { name: string } | null;
  children: OrgChartNodeData[];
  isAdministrativePlaceholder?: boolean;
}

interface OrgChartProps {
  tree: OrgChartNodeData[];
  currentUserId: string;
  onSearch?: (query: string) => void;
  searchQuery?: string;
  layout?: Pick<OrgChartLayoutSettings, "direction" | "density">;
  showToolbar?: boolean;
  className?: string;
  editable?: boolean;
  siblingOrders?: Record<string, string[]>;
  onSiblingReorder?: (parentKey: string, childIds: string[]) => void;
}

type DropPosition = "before" | "after";

interface NodeRenderContext {
  currentUserId: string;
  layout: Pick<OrgChartLayoutSettings, "direction" | "density">;
  densityClass: ReturnType<typeof getOrgChartDensityClass>;
  editable?: boolean;
  siblingOrders?: Record<string, string[]>;
  onSiblingReorder?: (parentKey: string, childIds: string[]) => void;
}

function orderNodes(
  nodes: OrgChartNodeData[],
  parentKey: string,
  siblingOrders?: Record<string, string[]>
) {
  const orderedIds = siblingOrders?.[parentKey] ?? nodes.map((n) => n.id);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const orderedNodes = orderedIds
    .map((id) => nodeById.get(id))
    .filter((n): n is OrgChartNodeData => !!n);
  for (const node of nodes) {
    if (!orderedIds.includes(node.id)) orderedNodes.push(node);
  }
  return { orderedNodes, orderedIds };
}

function OrgChartNodeCard({
  node,
  currentUserId,
  densityClass,
  editable,
  isDraggable,
  dragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  node: OrgChartNodeData;
  currentUserId: string;
  densityClass: ReturnType<typeof getOrgChartDensityClass>;
  editable?: boolean;
  isDraggable: boolean;
  dragOver?: { id: string; position: DropPosition } | null;
  onDragStart?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const isSelf = node.id === currentUserId;

  return (
    <div
      data-org-self={isSelf ? "true" : undefined}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "org-chart-card relative z-10 rounded-xl border bg-card/95 shadow-sm shrink-0 transition-shadow",
        densityClass.card,
        isSelf
          ? "border-brand-500 ring-2 ring-brand-500/30"
          : "border-border/60",
        node.isAdministrativePlaceholder && "border-amber-500/40 bg-amber-500/5",
        isDraggable && "cursor-grab active:cursor-grabbing hover:shadow-md",
        dragOver?.id === node.id &&
          dragOver.position === "before" &&
          "-translate-y-0.5 ring-2 ring-brand-400/60 ring-offset-2",
        dragOver?.id === node.id &&
          dragOver.position === "after" &&
          "translate-y-0.5 ring-2 ring-brand-400/60 ring-offset-2"
      )}
    >
      {isDraggable && (
        <GripVertical className="absolute left-1 top-1 h-3.5 w-3.5 text-muted-foreground/70" />
      )}
      {isSelf && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-600 text-[9px] px-1.5 py-0">
          You
        </Badge>
      )}
      <div className="flex flex-col items-center text-center gap-1.5">
        {!node.isAdministrativePlaceholder && (
          <Avatar className={cn("border border-background", densityClass.avatar)}>
            <AvatarImage src={node.avatar ?? undefined} alt={node.firstName} />
            <AvatarFallback className="bg-brand-500/15 text-brand-700 dark:text-brand-300 text-xs font-semibold">
              {getInitials(node.firstName, node.lastName)}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 w-full">
          <p className="font-semibold text-xs truncate leading-tight">
            {node.firstName} {node.lastName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {node.isAdministrativePlaceholder
              ? "Admin placeholder"
              : (node.designation?.name ?? node.role)}
          </p>
        </div>
        {node.directReportCount > 0 && (
          <Badge variant="outline" className="text-[9px] gap-0.5 h-5 px-1.5">
            <Users className="h-2.5 w-2.5" />
            {node.directReportCount}
          </Badge>
        )}
      </div>
    </div>
  );
}

function OrgChartNode({
  node,
  parentKey,
  ctx,
}: {
  node: OrgChartNodeData;
  parentKey: string;
  ctx: NodeRenderContext;
}) {
  const hasChildren = node.children.length > 0;
  const isHorizontal = ctx.layout.direction === "horizontal";
  const isDraggable = !!ctx.editable && !node.isAdministrativePlaceholder;
  const [dragOver, setDragOver] = useState<{ id: string; position: DropPosition } | null>(null);

  const readDragPayload = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData("application/x-org-chart-node");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { nodeId: string; parentKey: string };
    } catch {
      return null;
    }
  };

  const handleDragStart = (event: React.DragEvent) => {
    if (!isDraggable) return;
    event.dataTransfer.setData(
      "application/x-org-chart-node",
      JSON.stringify({ nodeId: node.id, parentKey })
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!ctx.editable || node.isAdministrativePlaceholder) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: DropPosition =
      isHorizontal
        ? event.clientX < rect.left + rect.width / 2
          ? "before"
          : "after"
        : event.clientY < rect.top + rect.height / 2
          ? "before"
          : "after";
    setDragOver({ id: node.id, position });
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!ctx.editable || !ctx.onSiblingReorder || !dragOver) return;
    event.preventDefault();
    event.stopPropagation();

    const payload = readDragPayload(event);
    if (!payload || payload.parentKey !== parentKey || payload.nodeId === node.id) return;

    const listEl = (event.currentTarget as HTMLElement).closest("[data-sibling-ids]");
    const siblingIdsRaw = listEl?.getAttribute("data-sibling-ids");
    if (!siblingIdsRaw) return;
    const currentOrder = siblingIdsRaw.split(",").filter(Boolean);

    ctx.onSiblingReorder(
      parentKey,
      reorderSiblingIds(currentOrder, payload.nodeId, node.id, dragOver.position)
    );
    setDragOver(null);
  };

  const card = (
    <OrgChartNodeCard
      node={node}
      currentUserId={ctx.currentUserId}
      densityClass={ctx.densityClass}
      editable={ctx.editable}
      isDraggable={isDraggable}
      dragOver={dragOver}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(null)}
      onDrop={handleDrop}
      onDragEnd={() => setDragOver(null)}
    />
  );

  if (!hasChildren) {
    return (
      <li className={cn("org-chart-node", isHorizontal ? "flex items-center" : "flex flex-col items-center")}>
        {card}
      </li>
    );
  }

  const childList = (
    <OrgChartSiblingList
      nodes={node.children}
      parentKey={node.id}
      ctx={ctx}
      isHorizontal={isHorizontal}
    />
  );

  if (isHorizontal) {
    return (
      <li className="org-chart-node flex items-start gap-2">
        {card}
        {childList}
      </li>
    );
  }

  return (
    <li className="org-chart-node flex flex-col items-center">
      {card}
      <div className={cn("org-chart-children relative w-full flex justify-center", ctx.densityClass.connector)}>
        <div className="absolute top-0 left-1/2 h-5 w-px -translate-x-1/2 bg-border" />
        {childList}
      </div>
    </li>
  );
}

function OrgChartSiblingList({
  nodes,
  parentKey,
  ctx,
  isHorizontal,
}: {
  nodes: OrgChartNodeData[];
  parentKey: string;
  ctx: NodeRenderContext;
  isHorizontal: boolean;
}) {
  const { orderedNodes, orderedIds } = orderNodes(nodes, parentKey, ctx.siblingOrders);

  return (
    <ul
      data-sibling-ids={orderedIds.join(",")}
      className={cn(
        isHorizontal
          ? "flex flex-col gap-4 border-l border-border pl-6 ml-4"
          : cn("flex flex-wrap justify-center pt-1", ctx.densityClass.gap)
      )}
    >
      {orderedNodes.map((child) => (
        <OrgChartNode key={child.id} node={child} parentKey={parentKey} ctx={ctx} />
      ))}
    </ul>
  );
}

function OrgChartRootSection({
  roots,
  parentKey,
  ctx,
  title,
  className,
}: {
  roots: OrgChartNodeData[];
  parentKey: string;
  ctx: NodeRenderContext;
  title?: string;
  className?: string;
}) {
  if (!roots.length) return null;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      )}
      <OrgChartSiblingList
        nodes={roots}
        parentKey={parentKey}
        ctx={ctx}
        isHorizontal={ctx.layout.direction === "horizontal"}
      />
    </div>
  );
}

export function OrgChart({
  tree,
  currentUserId,
  onSearch,
  searchQuery = "",
  layout = DEFAULT_ORG_CHART_LAYOUT,
  showToolbar = true,
  className,
  editable = false,
  siblingOrders,
  onSiblingReorder,
}: OrgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);

  const densityClass = getOrgChartDensityClass(layout.density);
  const { systemRoots, administrativeRoots } = splitOrgChartRoots(tree);
  const hasSplitRoots = administrativeRoots.length > 0;

  const ctx: NodeRenderContext = {
    currentUserId,
    layout,
    densityClass,
    editable,
    siblingOrders,
    onSiblingReorder,
  };

  const recomputeFit = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    content.style.transform = "scale(1)";
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const sw = content.scrollWidth;
    const sh = content.scrollHeight;

    if (sw === 0 || sh === 0) return;

    const scale = Math.min(cw / sw, ch / sh, 1) * 0.92;
    setFitScale(scale);
  }, []);

  useLayoutEffect(() => {
    recomputeFit();
  }, [tree, layout.direction, layout.density, recomputeFit]);

  useEffect(() => {
    window.addEventListener("resize", recomputeFit);
    return () => window.removeEventListener("resize", recomputeFit);
  }, [recomputeFit]);

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    onSearch?.(value);
  };

  const scale = fitScale * zoom;

  if (!tree.length) {
    return (
      <p className="py-12 text-center text-muted-foreground text-sm">
        No organization structure configured yet.
      </p>
    );
  }

  const rootContent = hasSplitRoots ? (
    <div
      className={cn(
        "org-chart-split flex w-full items-start justify-center gap-8 px-2",
        layout.direction === "horizontal" ? "flex-col" : "flex-row flex-wrap"
      )}
    >
      <OrgChartRootSection
        roots={systemRoots}
        parentKey="root"
        ctx={ctx}
        title="Organization"
        className="flex-1 min-w-0"
      />
      <div className="hidden sm:block w-px self-stretch bg-border/80 shrink-0" aria-hidden />
      <OrgChartRootSection
        roots={administrativeRoots}
        parentKey="admin-root"
        ctx={ctx}
        title="DR (Admin Placeholder)"
        className="shrink-0"
      />
    </div>
  ) : (
    <OrgChartRootSection roots={tree} parentKey="root" ctx={ctx} />
  );

  return (
    <div className={cn("space-y-3", className)}>
      {showToolbar && (
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Search by name or ID..."
              value={localSearch}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border/50 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setZoom(1)}
            >
              Reset
            </Button>
          </div>
        </div>
      )}

      {editable && (
        <p className="text-xs text-muted-foreground">
          Drag cards to reorder siblings within the same team. DR placeholder stays on the right.
          Layout changes are visual only and do not change reporting lines.
        </p>
      )}

      <div
        ref={containerRef}
        className="relative h-[min(520px,58vh)] w-full overflow-auto rounded-xl border border-border/50 bg-muted/10"
      >
        <div className="flex min-h-full min-w-full items-start justify-center p-4">
          <div
            ref={contentRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
            className="transition-transform duration-200"
          >
            {rootContent}
          </div>
        </div>
      </div>

      {layout.direction === "vertical" && (
        <style jsx global>{`
          .org-chart-children > ul > .org-chart-node {
            position: relative;
          }
          .org-chart-children > ul > .org-chart-node::before {
            content: "";
            position: absolute;
            top: -1.25rem;
            left: 50%;
            width: 1px;
            height: 1.25rem;
            background: var(--border);
            transform: translateX(-50%);
          }
          .org-chart-children > ul > .org-chart-node:not(:only-child)::after {
            content: "";
            position: absolute;
            top: -1.25rem;
            left: 0;
            right: 0;
            height: 1px;
            background: var(--border);
          }
          .org-chart-children > ul > .org-chart-node:first-child:not(:only-child)::after {
            left: 50%;
          }
          .org-chart-children > ul > .org-chart-node:last-child:not(:only-child)::after {
            right: 50%;
          }
        `}</style>
      )}
    </div>
  );
}
