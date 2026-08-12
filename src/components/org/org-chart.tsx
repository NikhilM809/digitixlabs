"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Search, ZoomIn, ZoomOut, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

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
}

interface OrgChartProps {
  tree: OrgChartNodeData[];
  currentUserId: string;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

function OrgChartNode({
  node,
  currentUserId,
}: {
  node: OrgChartNodeData;
  currentUserId: string;
}) {
  const isSelf = node.id === currentUserId;
  const hasChildren = node.children.length > 0;

  return (
    <li className="org-chart-node flex flex-col items-center">
      <div
        data-org-self={isSelf ? "true" : undefined}
        className={cn(
          "org-chart-card relative z-10 w-[148px] rounded-xl border bg-card/95 p-2.5 shadow-sm",
          isSelf
            ? "border-brand-500 ring-2 ring-brand-500/30"
            : "border-border/60"
        )}
      >
        {isSelf && (
          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-600 text-[9px] px-1.5 py-0">
            You
          </Badge>
        )}
        <div className="flex flex-col items-center text-center gap-1.5">
          <Avatar className="h-10 w-10 border border-background">
            <AvatarImage src={node.avatar ?? undefined} alt={node.firstName} />
            <AvatarFallback className="bg-brand-500/15 text-brand-700 dark:text-brand-300 text-xs font-semibold">
              {getInitials(node.firstName, node.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 w-full">
            <p className="font-semibold text-xs truncate leading-tight">
              {node.firstName} {node.lastName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {node.designation?.name ?? node.role}
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

      {hasChildren && (
        <div className="org-chart-children relative pt-5 w-full flex justify-center">
          <div className="absolute top-0 left-1/2 h-5 w-px -translate-x-1/2 bg-border" />
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-6 pt-1">
            {node.children.map((child) => (
              <OrgChartNode
                key={child.id}
                node={child}
                currentUserId={currentUserId}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function OrgChart({
  tree,
  currentUserId,
  onSearch,
  searchQuery = "",
}: OrgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);

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
  }, [tree, recomputeFit]);

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

  return (
    <div className="space-y-3">
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

      <div
        ref={containerRef}
        className="relative h-[min(480px,52vh)] w-full overflow-hidden rounded-xl border border-border/50 bg-muted/10"
      >
        <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-2">
          <div
            ref={contentRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
            className="transition-transform duration-200"
          >
            <ul className="org-chart-root flex flex-wrap justify-center gap-6 px-2">
              {tree.map((root) => (
                <OrgChartNode
                  key={root.id}
                  node={root}
                  currentUserId={currentUserId}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>

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
    </div>
  );
}
