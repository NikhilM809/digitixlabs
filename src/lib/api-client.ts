export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Request failed");
  }

  return json.data as T;
}
