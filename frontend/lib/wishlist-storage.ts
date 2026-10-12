export function safeSlugs(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (v): v is string =>
              typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v),
          ),
        ),
      ].slice(0, 100)
    : [];
}
export function decodeFavorites(raw: string): string[] {
  try {
    return safeSlugs(JSON.parse(raw));
  } catch {
    return [];
  }
}
