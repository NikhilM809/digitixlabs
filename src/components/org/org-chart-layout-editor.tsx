"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { applyOrgChartLayoutToTree, splitOrgChartRoots } from "@/lib/org-chart-layout";
import { COMPANY_ROOT_NODE_ID } from "@/lib/org-company-root";

interface LayoutResponse {
  layout: OrgChartLayoutSettings;
  tree: OrgChartNodeData[];
  previewTree?: OrgChartNodeData[];
  topLevelEmployeeId?: string | null;
  companyName?: string;
}

function collectReorderGroups(
  nodes: OrgChartNodeData[],
  parentKey = "root",
  parentLabel = "Top level (Organization)"
): Array<{ key: string; label: string; childIds: string[] }> {
  const groups: Array<{ key: string; label: string; childIds: string[] }> = [];

  if (nodes.length > 1) {
    groups.push({
      key: parentKey,
      label: parentLabel,
      childIds: nodes.map((n) => n.id),
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

export function OrgChartLayoutEditor({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [layoutDraft, setLayoutDraft] = useState<OrgChartLayoutSettings | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["org-chart-layout"],
    queryFn: () => apiFetch<LayoutResponse>("/api/org-hierarchy/layout"),
  });

  const layout = layoutDraft ?? data?.layout;
  const baseTree = data?.tree ?? [];

  const previewTree = useMemo(() => {
    if (!layout || !baseTree.length) return [];
    return applyOrgChartLayoutToTree(baseTree, layout, data?.topLevelEmployeeId);
  }, [baseTree, layout, data?.topLevelEmployeeId]);

  const { systemRoots } = splitOrgChartRoots(previewTree);
  const reorderGroups = useMemo(() => collectReorderGroups(systemRoots), [systemRoots]);

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

  const handleSiblingReorder = (parentKey: string, childIds: string[]) => {
    if (!layout) return;
    const normalizedKey =
      parentKey === "root" && previewTree[0]?.isCompanyRoot
        ? COMPANY_ROOT_NODE_ID
        : parentKey;
    updateLayout({
      siblingOrders: {
        ...layout.siblingOrders,
        [normalizedKey]: childIds,
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
            {data?.companyName ?? "Company"} is shown at the top; DR (Administrative Placeholder)
            stays separate on the right. Drag cards in the preview to reorder siblings. This does not
            change reporting relationships.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
        </CardContent>
      </Card>

      {reorderGroups.length > 0 && (
        <Card glass>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reorderable groups</CardTitle>
            <CardDescription>
              {reorderGroups.length} team{reorderGroups.length === 1 ? "" : "s"} with multiple
              members — drag cards below or use the chart preview
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {reorderGroups.map((group) => (
              <Badge key={group.key} variant="outline" className="text-xs">
                {group.label} ({group.childIds.length})
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card glass>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live preview — drag to rearrange</CardTitle>
          <CardDescription>
            Left: system organization from top level. Right: DR placeholder with assigned admin
            branches and their teams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgChart
            tree={previewTree}
            currentUserId={currentUserId}
            layout={layout}
            showToolbar={false}
            editable
            siblingOrders={layout.siblingOrders}
            onSiblingReorder={handleSiblingReorder}
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
