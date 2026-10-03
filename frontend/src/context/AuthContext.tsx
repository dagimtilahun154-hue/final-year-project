import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiClient, tokenStorage } from "../api/client";
import { User, AuthResponse, UserProfileMe } from "../types";

interface AuthContextType {
  user: UserProfileMe | null;
  token: string | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; role?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default mock parent for development preview matching Figma ("Hana Tesfaye")
const DEFAULT_PREVIEW_USER: UserProfileMe = {
  id: 24,
  name: "Hana Tesfaye",
  email: "hana.tesfaye@example.com",
  phone: "+251 91 123 4567",
  role: "parent",
  role_id: 3,
  status: "active",
  created_at: "2026-08-15T08:30:00.000Z",
  linked_children: [
    {
      id: 1,
      full_name: "Liya Hana",
      dob: "2022-05-12",
      gender: "female",
      enrollment_status: "active",
      relationship: "Mother",
      group_name: "Sunflower Group",
    },
  ],
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfileMe | null>(DEFAULT_PREVIEW_USER);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const response = await apiClient.get<{ user: UserProfileMe }>("/auth/me");
      setUser(response.data.user);
    } catch {
      // Fallback to preview user in development if backend is not currently running
      if (!user) {
        setUser(DEFAULT_PREVIEW_USER);
      }
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = await tokenStorage.getToken();
        if (savedToken) {
          setToken(savedToken);
          await refreshUser();
        } else {
          // Keep preview user active for rapid UI development and review
          setUser(DEFAULT_PREVIEW_USER);
        }
      } catch (err) {
        console.warn("Auth initialization fallback to preview user", err);
        setUser(DEFAULT_PREVIEW_USER);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      const { token: receivedToken, user: receivedUser } = response.data;
      await tokenStorage.setToken(receivedToken);
      setToken(receivedToken);
      setUser(receivedUser as UserProfileMe);
      setIsLoading(false);
      return { success: true, role: receivedUser.role };
    } catch (err: any) {
      setIsLoading(false);
      const errorMsg =
        err.response?.data?.error || "Invalid credentials or connection error";
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.post("/auth/logout").catch(() => {});
    } finally {
      await tokenStorage.clearToken();
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
