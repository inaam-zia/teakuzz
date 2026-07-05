export function parseArrayResponse<T>(data: unknown): { items: T[]; error: string } {
  if (data && typeof data === "object" && "error" in data && (data as { error: unknown }).error) {
    return { items: [], error: String((data as { error: unknown }).error) };
  }

  if (Array.isArray(data)) {
    return { items: data as T[], error: "" };
  }

  return { items: [], error: "Unexpected response from server" };
}

export async function fetchJsonArray<T>(
  url: string
): Promise<{ items: T[]; error: string }> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    const parsed = parseArrayResponse<T>(data);

    if (!response.ok && !parsed.error) {
      return { items: [], error: "Could not load data" };
    }

    return parsed;
  } catch {
    return { items: [], error: "Could not connect to server" };
  }
}
