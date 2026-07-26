// --- Network & Fetch Service ---

export async function fetchWithTimeout(
  resource: RequestInfo | URL,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}
