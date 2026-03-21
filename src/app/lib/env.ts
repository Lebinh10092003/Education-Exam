const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const apiBaseUrl = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? "");
export const wsBaseUrl = stripTrailingSlash(
  import.meta.env.VITE_WS_BASE_URL ??
    (apiBaseUrl ? apiBaseUrl.replace(/^http/i, "ws") : ""),
);

export const buildApiUrl = (path: string) => {
  if (!apiBaseUrl) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
};

export const buildWsUrl = (path: string) => {
  if (!wsBaseUrl) {
    if (typeof window === "undefined") {
      return path;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${path}`;
  }
  return `${wsBaseUrl}${path}`;
};
