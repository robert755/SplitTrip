const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001";

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
  currency: string;
  balances: Array<{
    participantId: string;
    name: string;
    balance: string;
  }>;
  settlements: Array<{
    from: { participantId: string; name: string };
    to: { participantId: string; name: string };
    amount: string;
  }>;
  transferCount: number;
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

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

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
