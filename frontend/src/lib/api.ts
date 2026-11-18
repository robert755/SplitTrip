const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001";

type AccessTokenListener = (accessToken: string | null) => void;

let currentAccessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
const accessTokenListeners = new Set<AccessTokenListener>();

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface Trip {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: string;
  currency: string;
  createdAt: string;
  payer: Participant;
  shares: Array<{
    participantId: string;
    amount: string;
    participant: Participant;
  }>;
}

export interface Settlements {
  id: string;
  revision: number;
  isCurrent: boolean;
  createdAt: string;
  invalidatedAt: string | null;
  currency: string;
  balances: Array<{
    participantId: string;
    name: string;
    balance: string;
  }>;
  settlements: Array<{
    id: string;
    from: { participantId: string; name: string };
    to: { participantId: string; name: string };
    amount: string;
    isPaid: boolean;
    paidAt: string | null;
  }>;
  transferCount: number;
}

export interface SettlementPayment {
  id: string;
  isPaid: boolean;
  paidAt: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function updateAccessToken(accessToken: string | null): void {
  currentAccessToken = accessToken;
  for (const listener of accessTokenListeners) {
    listener(accessToken);
  }
}

export function subscribeToAccessToken(
  listener: AccessTokenListener,
): () => void {
  accessTokenListeners.add(listener);
  return () => accessTokenListeners.delete(listener);
}

async function readResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? payload.message
        : undefined;
    throw new ApiError(
      Array.isArray(message)
        ? message.join(" ")
        : typeof message === "string"
          ? message
          : `Request failed (${response.status}).`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return payload as T;
}

async function sendRequest(
  path: string,
  options: RequestInit,
  headers: Headers,
): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
}

async function performRefresh(): Promise<AuthResponse | null> {
  try {
    const response = await sendRequest(
      "/auth/refresh",
      { method: "POST" },
      new Headers(),
    );
    const auth = await readResponse<AuthResponse>(response);
    updateAccessToken(auth.accessToken);
    return auth;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      updateAccessToken(null);
      return null;
    }
    throw error;
  }
}

export function refreshAuthSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refresh = async (): Promise<AuthResponse | null> => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request("splittrip-auth-refresh", performRefresh);
    }
    return performRefresh();
  };

  refreshInFlight = refresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestToken =
    currentAccessToken ??
    headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  if (currentAccessToken) {
    headers.set("Authorization", `Bearer ${currentAccessToken}`);
  }

  let response = await sendRequest(path, options, headers);
  if (response.status === 401 && requestToken) {
    const auth = await refreshAuthSession();
    if (auth) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${auth.accessToken}`);
      response = await sendRequest(path, options, retryHeaders);
    }
  }

  return readResponse<T>(response);
}
