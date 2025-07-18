import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("token");
  });
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const { data: userData, error, isError, isLoading: queryLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/me"],
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (userData?.user && token) {
      setUser(userData.user);
      setIsLoading(false);
    } else if (isError || error) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      queryClient.clear();
      setIsLoading(false);
    } else if (!token) {
      setUser(null);
      setIsLoading(false);
    }
    // Keep loading if we have a token but query is still loading
    if (token && queryLoading) {
      setIsLoading(true);
    }
  }, [userData, error, isError, token, queryClient, queryLoading]);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem("token", newToken);
    queryClient.clear();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    queryClient.clear();
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !isLoading && !!token && !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}