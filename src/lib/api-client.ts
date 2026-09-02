export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Unable to reach the server. Please check your connection.");
  }

  const contentType = res.headers.get("content-type") ?? "";
  const json: ApiResponse<T> = contentType.includes("application/json")
    ? await res.json()
    : ({} as ApiResponse<T>);

  if (!res.ok || !json.success) {
    if (res.status === 401) {
      throw new Error("Your session has expired. Please sign in again.");
    }
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }

  if (json.data === undefined) {
    throw new Error("Invalid API response");
  }

  return json.data;
}

export async function fetchApiArray<T>(
  url: string,
  options?: RequestInit
): Promise<T[]> {
  const data = await fetchApi<T[] | null>(url, options);
  return data ?? [];
}
