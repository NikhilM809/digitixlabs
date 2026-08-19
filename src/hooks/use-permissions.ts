"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api-client";

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () =>
      fetchApi<{ permissions: string[]; role: string }>("/api/me/permissions"),
  });

  const hasPermission = (slug: string) => data?.permissions.includes(slug) ?? false;

  return {
    permissions: data?.permissions ?? [],
    role: data?.role,
    isLoading,
    hasPermission,
  };
}
