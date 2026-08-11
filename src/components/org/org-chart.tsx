"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Focus,
  Users,
} from "lucide-react";
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
  expandPath?: string[];
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

function OrgChartNode({
  node,
  currentUserId,
  expandedIds,
  onToggle,
  depth,
}: {
  node: OrgChartNodeData;
  currentUserId: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  depth: number;
}) {
  const isSelf = node.id === currentUserId;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <li className="org-chart-node flex flex-col items-center">
      <div
        data-org-self={isSelf ? "true" : undefined}
        className={cn(
          "org-chart-card relative z-10 w-[220px] rounded-2xl border bg-card/90 backdrop-blur-sm p-4 shadow-sm transition-all",
          isSelf
            ? "border-brand-500 ring-2 ring-brand-500/30 shadow-brand-500/10"
            : "border-border/60 hover:border-brand-400/40 hover:shadow-md"
        )}
      >
        {isSelf && (
          <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-600 text-[10px]">
            You
          </Badge>
        )}
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar className="h-14 w-14 border-2 border-background shadow">
            <AvatarImage src={node.avatar ?? undefined} alt={node.firstName} />
            <AvatarFallback className="bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold">
              {getInitials(node.firstName, node.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 w-full">
            <p className="font-semibold text-sm truncate">
              {node.firstName} {node.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {node.designation?.name ?? node.role}
            </p>
            {node.department?.name && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {node.department.name}
              </p>
            )}
          </div>
          {node.managerName && (
            <p className="text-[10px] text-muted-foreground w-full truncate">
              Reports to: {node.managerName}
            </p>
          )}
          {node.directReportCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Users className="h-3 w-3" />
              {node.directReportCount} direct
            </Badge>
          )}
        </div>
        {hasChildren && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full h-7 text-xs"
            onClick={() => onToggle(node.id)}
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Collapse team
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                Expand team ({node.children.length})
              </>
            )}
          </Button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="org-chart-children relative pt-8 w-full flex justify-center">
          <div className="org-chart-connector-v absolute top-0 left-1/2 h-8 w-px -translate-x-1/2 bg-border" />
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-10 pt-2">
            {node.children.map((child) => (
              <OrgChartNode
                key={child.id}
                node={child}
                currentUserId={currentUserId}
                expandedIds={expandedIds}
                onToggle={onToggle}
                depth={depth + 1}
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
  expandPath = [],
  onSearch,
  searchQuery = "",
}: OrgChartProps) {
  const initialExpanded = useMemo(() => {
    const ids = new Set<string>(expandPath);
    for (const root of tree) {
      ids.add(root.id);
    }
    return ids;
  }, [tree, expandPath]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setExpandedIds(initialExpanded);
  }, [initialExpanded]);

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const focusOnMe = useCallback(() => {
    setExpandedIds(new Set([...expandPath, ...tree.map((r) => r.id)]));
    setTimeout(() => {
      document
        .querySelector("[data-org-self='true']")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [expandPath, tree]);

  const expandAll = () => {
    const all = new Set<string>();
    function walk(nodes: OrgChartNodeData[]) {
      for (const n of nodes) {
        all.add(n.id);
        walk(n.children);
      }
    }
    walk(tree);
    setExpandedIds(all);
  };

  const collapseAll = () => {
    setExpandedIds(new Set(tree.map((r) => r.id)));
  };

  const handleSearch = (value: string) => {
    setLocalSearch(value);
    onSearch?.(value);
  };

  if (!tree.length) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No organization structure configured yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or employee ID..."
            value={localSearch}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={focusOnMe}>
          <Focus className="h-4 w-4" />
          Focus on me
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={expandAll}>
          Expand all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
          Collapse all
        </Button>
      </div>

      <div className="overflow-x-auto pb-6">
        <ul className="org-chart-root flex flex-wrap justify-center gap-10 min-w-max px-4">
          {tree.map((root) => (
            <OrgChartNode
              key={root.id}
              node={root}
              currentUserId={currentUserId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              depth={0}
            />
          ))}
        </ul>
      </div>

      <style jsx global>{`
        .org-chart-children > ul > .org-chart-node {
          position: relative;
        }
        .org-chart-children > ul > .org-chart-node::before {
          content: "";
          position: absolute;
          top: -2rem;
          left: 50%;
          width: 1px;
          height: 2rem;
          background: var(--border);
          transform: translateX(-50%);
        }
        .org-chart-children > ul > .org-chart-node:not(:only-child)::after {
          content: "";
          position: absolute;
          top: -2rem;
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
