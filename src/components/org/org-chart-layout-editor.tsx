"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, LayoutGrid, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrgChart, type OrgChartNodeData } from "@/components/org/org-chart";
import { apiFetch } from "@/lib/client-api";
import type { OrgChartLayoutSettings } from "@/lib/org-chart-layout";
import { applyOrgChartLayoutToTree } from "@/lib/org-chart-layout";

interface LayoutResponse {
  layout: OrgChartLayoutSettings;
  tree: OrgChartNodeData[];
  previewTree?: OrgChartNodeData[];
}

function findNode(nodes: OrgChartNodeData[], id: string): OrgChartNodeData | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function collectReorderGroups(
  nodes: OrgChartNodeData[],
  parentKey = "root",
  parentLabel = "Top level"
): Array<{ key: string; label: string; childIds: string[]; childLabels: Record<string, string> }> {
  const groups: Array<{
    key: string;
    label: string;
    childIds: string[];
    childLabels: Record<string, string>;
  }> = [];

  if (nodes.length > 1) {
    groups.push({
      key: parentKey,
      label: parentLabel,
      childIds: nodes.map((n) => n.id),
      childLabels: Object.fromEntries(
        nodes.map((n) => [n.id, `${n.firstName} ${n.lastName}`])
      ),
    });
  }

  for (const node of nodes) {
    if (node.children.length > 1) {
      groups.push(
        ...collectReorderGroups(
          node.children,
          node.id,
          `${node.firstName} ${node.lastName}'s team`
        )
      );
    }
  }

  return groups;
}

function reorderIds(ids: string[], id: string, direction: "up" | "down") {
  const index = ids.indexOf(id);
  if (index < 0) return ids;
  const next = [...ids];
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= next.length) return ids;
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return next;
}

export function OrgChartLayoutEditor({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [layoutDraft, setLayoutDraft] = useState<OrgChartLayoutSettings | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState("root");

  const { data, isLoading } = useQuery({
    queryKey: ["org-chart-layout"],
    queryFn: () => apiFetch<LayoutResponse>("/api/org-hierarchy/layout"),
  });

  const layout = layoutDraft ?? data?.layout;
  const baseTree = data?.tree ?? [];

  const previewTree = useMemo(() => {
    if (!layout || !baseTree.length) return [];
    return applyOrgChartLayoutToTree(baseTree, layout);
  }, [baseTree, layout]);

  const reorderGroups = useMemo(() => collectReorderGroups(previewTree), [previewTree]);

  const selectedGroup = reorderGroups.find((g) => g.key === selectedGroupKey) ?? reorderGroups[0];

  const orderedChildIds = useMemo(() => {
    if (!selectedGroup || !layout) return [];
    return layout.siblingOrders[selectedGroup.key] ?? selectedGroup.childIds;
  }, [layout, selectedGroup]);

  const saveMutation = useMutation({
    mutationFn: (payload: OrgChartLayoutSettings) =>
      apiFetch("/api/org-hierarchy/layout", {
        method: "PATCH",
        body: JSON.stringify({ layout: payload }),
      }),
    onSuccess: () => {
      toast.success("Chart layout saved");
      setLayoutDraft(null);
      queryClient.invalidateQueries({ queryKey: ["org-chart-layout"] });
      queryClient.invalidateQueries({ queryKey: ["org-chart"] });
      queryClient.invalidateQueries({ queryKey: ["org-hierarchy"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateLayout = (patch: Partial<OrgChartLayoutSettings>) => {
    if (!layout) return;
    setLayoutDraft({ ...layout, ...patch });
  };

  const moveChild = (childId: string, direction: "up" | "down") => {
    if (!layout || !selectedGroup) return;
    const current = layout.siblingOrders[selectedGroup.key] ?? selectedGroup.childIds;
    const nextOrder = reorderIds(current, childId, direction);
    updateLayout({
      siblingOrders: {
        ...layout.siblingOrders,
        [selectedGroup.key]: nextOrder,
      },
    });
  };

  if (isLoading || !layout) {
    return <div className="py-12 text-center text-muted-foreground">Loading chart layout...</div>;
  }

  return (
    <div className="space-y-6">
      <Card glass>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-brand-600" />
            Chart Layout Settings
          </CardTitle>
          <CardDescription>
            Adjust how the organization chart is displayed. This does not change reporting
            relationships — only visual layout and sibling order.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Chart direction</Label>
            <Select
              value={layout.direction}
              onValueChange={(value: OrgChartLayoutSettings["direction"]) =>
                updateLayout({ direction: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Top-down (vertical)</SelectItem>
                <SelectItem value="horizontal">Left-right (horizontal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Spacing</Label>
            <Select
              value={layout.density}
              onValueChange={(value: OrgChartLayoutSettings["density"]) =>
                updateLayout({ density: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reorderGroups.length > 0 && (
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label>Reorder team under</Label>
              <Select value={selectedGroup?.key} onValueChange={setSelectedGroupKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager / group" />
                </SelectTrigger>
                <SelectContent>
                  {reorderGroups.map((group) => (
                    <SelectItem key={group.key} value={group.key}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedGroup && selectedGroup.childIds.length > 1 && (
        <Card glass>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sibling order</CardTitle>
            <CardDescription>
              Change left-to-right / top-to-bottom order for {selectedGroup.label}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {orderedChildIds.map((childId, index) => (
              <div
                key={childId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2"
              >
                <span className="text-sm font-medium truncate">
                  {index + 1}. {selectedGroup.childLabels[childId] ?? childId}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => moveChild(childId, "up")}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === orderedChildIds.length - 1}
                    onClick={() => moveChild(childId, "down")}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card glass>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live preview</CardTitle>
          <CardDescription>
            This is how employees will see the chart on Organization Structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgChart
            tree={previewTree}
            currentUserId={currentUserId}
            layout={layout}
            showToolbar={false}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(layout)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Chart Layout
        </Button>
      </div>
    </div>
  );
}
