export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiJson<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const json: ApiJson<T> = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok) {
    throw new ApiError(
      json.error ?? "Request failed",
      res.status
    );
  }

  if (json.success === false) {
    throw new ApiError(json.error ?? "Request failed", res.status);
  }

  if (json.data === undefined) {
    throw new ApiError("Invalid API response", res.status);
  }

  return json.data;
}

export async function apiFetchArray<T>(
  url: string,
  options?: RequestInit
): Promise<T[]> {
  const data = await apiFetch<T[] | null>(url, options);
  return data ?? [];
}
