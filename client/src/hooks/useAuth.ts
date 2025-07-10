import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("token");
  });
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // Verify token and get user data when token exists
  const { data: userData, error, isError } = useQuery<{ user: User }>({
    queryKey: ["/api/auth/me"],
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (userData?.user && token) {
      setUser(userData.user);
      setIsLoading(false);
    } else if ((isError || error) && token) {
      // Token is invalid, clear it
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setIsLoading(false);
      queryClient.clear();
    } else if (!token) {
      setIsLoading(false);
    }
  }, [userData, error, isError, token, queryClient]);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem("token", newToken);
    setIsLoading(false);
    queryClient.clear();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    queryClient.clear();
    window.location.reload();
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  };
}