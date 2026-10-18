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
    daycareCode?: string
  ) => Promise<{
    success: boolean;
    error?: string;
    role?: string;
    profileComplete?: boolean;
    mfaRequired?: boolean;
    challengeToken?: string;
  }>;
  verifyMfa: (
    challengeToken: string,
    totpCode: string
  ) => Promise<{
    success: boolean;
    error?: string;
    role?: string;
    profileComplete?: boolean;
  }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enablePreview: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to extract detailed error messages from backend response
const extractErrorMessage = (err: any): string => {
  if (err.response?.data?.fields && Array.isArray(err.response.data.fields) && err.response.data.fields.length > 0) {
    return err.response.data.fields.map((f: any) => f.message).join(". ");
  }
  return (
    err.response?.data?.error ||
    err.response?.data?.message ||
    err.message ||
    "Invalid credentials or connection error"
  );
};

// Default mock parent for development preview matching Figma ("Hana Tesfaye")
export const DEFAULT_PREVIEW_USER: UserProfileMe = {
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
  const [user, setUser] = useState<UserProfileMe | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const response = await apiClient.get<{ user: UserProfileMe }>("/auth/me");
      if (response.data?.user) {
        setUser(response.data.user);
      }
    } catch {
      await tokenStorage.clearToken();
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = await tokenStorage.getToken();
        if (savedToken) {
          setToken(savedToken);
          const response = await apiClient.get<{ user: UserProfileMe }>("/auth/me");
          if (response.data?.user) {
            setUser(response.data.user);
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn("Auth initialization failed", err);
        await tokenStorage.clearToken();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string, daycareCode?: string) => {
    setIsLoading(true);
    try {
      const payload: any = { email, password };
      if (daycareCode && daycareCode.trim()) {
        payload.daycare_code = daycareCode.trim();
      }
      const response = await apiClient.post<any>("/auth/login", payload);

      // Check if MFA is required by the backend
      if (response.data?.mfa_required || response.data?.challenge_token) {
        setIsLoading(false);
        return {
          success: false,
          mfaRequired: true,
          challengeToken: response.data.challenge_token,
        };
      }

      const { token: receivedToken, user: receivedUser } = response.data;
      await tokenStorage.setToken(receivedToken);
      setToken(receivedToken);
      setUser(receivedUser as UserProfileMe);
      setIsLoading(false);
      return {
        success: true,
        role: receivedUser.role,
        profileComplete: (receivedUser as UserProfileMe).profile_complete,
      };
    } catch (err: any) {
      setIsLoading(false);
      const errorMsg = extractErrorMessage(err);
      return { success: false, error: errorMsg };
    }
  };

  const verifyMfa = async (challengeToken: string, totpCode: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<any>("/auth/mfa/verify", {
        challenge_token: challengeToken,
        totp_code: totpCode,
      });
      const { token: receivedToken, user: receivedUser } = response.data;
      await tokenStorage.setToken(receivedToken);
      setToken(receivedToken);
      setUser(receivedUser as UserProfileMe);
      setIsLoading(false);
      return {
        success: true,
        role: receivedUser.role,
        profileComplete: (receivedUser as UserProfileMe).profile_complete,
      };
    } catch (err: any) {
      setIsLoading(false);
      const errorMsg = extractErrorMessage(err);
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

  const enablePreview = () => {
    setUser(DEFAULT_PREVIEW_USER);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, verifyMfa, logout, refreshUser, enablePreview }}
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
