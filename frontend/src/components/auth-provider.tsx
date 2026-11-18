"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  apiRequest,
  refreshAuthSession,
  subscribeToAccessToken,
  type AuthResponse,
  type AuthUser,
  updateAccessToken,
} from "@/lib/api";

interface AuthContextValue {
  accessToken: string | null;
  user: AuthUser | null;
  isInitializing: boolean;
  initializationError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );

  const applyAuth = useCallback((auth: AuthResponse) => {
    updateAccessToken(auth.accessToken);
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    setInitializationError(null);
  }, []);

  useEffect(() => {
    return subscribeToAccessToken((token) => {
      setAccessToken(token);
      if (!token) {
        setUser(null);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;

    void refreshAuthSession()
      .then((auth) => {
        if (active && auth) {
          applyAuth(auth);
        } else if (active) {
          setAccessToken(null);
          setUser(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setInitializationError(
            error instanceof ApiError && error.status === 401
              ? null
              : "We couldn't check your session. Make sure the API is running.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsInitializing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [applyAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      applyAuth(auth);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const auth = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      applyAuth(auth);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
    } finally {
      updateAccessToken(null);
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      isInitializing,
      initializationError,
      login,
      register,
      logout,
    }),
    [
      accessToken,
      user,
      isInitializing,
      initializationError,
      login,
      register,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
