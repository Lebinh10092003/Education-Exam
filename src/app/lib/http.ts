import { buildApiUrl } from "./env";
import { clearStoredTokens, getStoredLocale, getStoredTokens, setStoredTokens, type AuthTokens } from "./storage";

export const AUTH_ERROR_EVENT = "eduexam:auth-error";

export interface PaginatedResponse<TItem> {
  count: number;
  next: string | null;
  previous: string | null;
  results: TItem[];
}

type QueryValue = string | number | boolean | null | undefined;

interface ApiRequestOptions {
  method?: string;
  body?: BodyInit | FormData | Record<string, unknown> | null;
  headers?: HeadersInit;
  auth?: boolean;
  retryOnAuth?: boolean;
  query?: Record<string, QueryValue | QueryValue[]>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

let refreshPromise: Promise<AuthTokens | null> | null = null;
let lastAuthErrorEventAt = 0;

const appendQueryParams = (
  url: URL,
  query?: Record<string, QueryValue | QueryValue[]>,
) => {
  if (!query) {
    return;
  }

  for (const [key, rawValue] of Object.entries(query)) {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      });
      continue;
    }

    if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
      url.searchParams.set(key, String(rawValue));
    }
  }
};

const toUrl = (path: string, query?: Record<string, QueryValue | QueryValue[]>) => {
  const normalizedPath = buildApiUrl(path);
  const url = new URL(normalizedPath, window.location.origin);
  appendQueryParams(url, query);
  return url;
};

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    for (const [field, value] of Object.entries(payload as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        if (field === "non_field_errors") {
          return value[0];
        }
        return `${field}: ${value[0]}`;
      }

      if (typeof value === "string" && value.trim()) {
        if (field === "non_field_errors") {
          return value;
        }
        return `${field}: ${value}`;
      }
    }
  }
  return fallback;
};

const summarizeHtmlError = (html: string) => {
  const normalizedFallback = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (typeof DOMParser === "undefined") {
    return normalizedFallback;
  }

  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const title = documentNode.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim();
  const summaryHeading = documentNode.querySelector("#summary h1")?.textContent?.replace(/\s+/g, " ").trim();
  const exceptionValue = documentNode.querySelector("pre.exception_value")?.textContent?.replace(/\s+/g, " ").trim();
  const firstParagraph = documentNode.querySelector("#info p")?.textContent?.replace(/\s+/g, " ").trim();

  return exceptionValue || summaryHeading || title || firstParagraph || normalizedFallback;
};

const parseResponseBody = async (response: Response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }
  if (/<html[\s>]/i.test(text) || /<!doctype html/i.test(text)) {
    return { detail: summarizeHtmlError(text) };
  }
  return { detail: text };
};

const refreshAccessToken = async (): Promise<AuthTokens | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const tokens = getStoredTokens();
    if (!tokens?.refresh) {
      clearStoredTokens();
      return null;
    }

    const response = await fetch(buildApiUrl("/api/v1/auth/refresh/"), {
      method: "POST",
      headers: {
        "Accept-Language": getStoredLocale(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });

    if (!response.ok) {
      clearStoredTokens();
      return null;
    }

    const payload = (await response.json()) as Partial<AuthTokens>;
    if (!payload.access) {
      clearStoredTokens();
      return null;
    }

    const updatedTokens = {
      access: payload.access,
      refresh: payload.refresh ?? tokens.refresh,
    };
    setStoredTokens(updatedTokens);
    return updatedTokens;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

const withAuthHeaders = (headers: Headers, token?: string) => {
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
};

const buildRequestInit = (
  tokens: AuthTokens | null,
  options: ApiRequestOptions,
): RequestInit => {
  const headers = new Headers(options.headers);
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: options.signal,
  };

  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", getStoredLocale());
  }

  if (options.auth !== false) {
    withAuthHeaders(headers, tokens?.access);
  }

  if (options.body instanceof FormData) {
    init.body = options.body;
    return init;
  }

  if (options.body && typeof options.body === "object" && !(options.body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
    return init;
  }

  if (options.body) {
    init.body = options.body;
  }

  return init;
};

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const tokens = getStoredTokens();
  const requestUrl = toUrl(path, options.query);
  let response = await fetch(requestUrl, buildRequestInit(tokens, options));

  if (
    response.status === 401 &&
    options.auth !== false &&
    options.retryOnAuth !== false &&
    tokens?.refresh
  ) {
    const refreshedTokens = await refreshAccessToken();
    if (refreshedTokens) {
      response = await fetch(
        requestUrl,
        buildRequestInit(refreshedTokens, {
          ...options,
          retryOnAuth: false,
        }),
      );
    }
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message = getErrorMessage(payload, `Request failed with status ${response.status}`);

    if (response.status === 401 && options.auth !== false) {
      clearStoredTokens();
      if (typeof window !== "undefined" && Date.now() - lastAuthErrorEventAt > 1000) {
        lastAuthErrorEventAt = Date.now();
        window.dispatchEvent(new CustomEvent(AUTH_ERROR_EVENT, { detail: { message } }));
      }
    }

    throw new ApiError(
      message,
      response.status,
      payload,
    );
  }

  return payload as TResponse;
}
