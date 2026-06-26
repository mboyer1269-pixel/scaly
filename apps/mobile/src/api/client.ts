const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const MOBILE_API_BEARER_TOKEN = process.env.EXPO_PUBLIC_MOBILE_API_BEARER_TOKEN;

export async function mobileFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL n'est pas configuré.");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(MOBILE_API_BEARER_TOKEN ? { authorization: `Bearer ${MOBILE_API_BEARER_TOKEN}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? "Erreur API Allô Maude.");
  }
  return data as T;
}
