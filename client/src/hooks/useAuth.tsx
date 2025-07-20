import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";

interface User {
  id: string;
  username: string;
  email: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: any }>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: any }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  getValidToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Function to check if token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  // Function to get valid token (with refresh if needed)
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const storedAuth = localStorage.getItem("auth");
    if (!storedAuth) return null;

    try {
      const parsed = JSON.parse(storedAuth);
      const tokens = parsed.tokens;
      
      if (!tokens?.accessToken) return null;

      // Check if access token is expired
      if (isTokenExpired(tokens.accessToken)) {
        // Try to refresh the token
        if (tokens.refreshToken) {
          const success = await refreshToken();
          if (success) {
            const newStoredAuth = localStorage.getItem("auth");
            if (newStoredAuth) {
              const newParsed = JSON.parse(newStoredAuth);
              return newParsed.tokens?.accessToken || null;
            }
          } else {
            // Refresh failed, logout user
            await logout();
            return null;
          }
        } else {
          // No refresh token, logout user
          await logout();
          return null;
        }
      }

      return tokens.accessToken;
    } catch (error) {
      console.error("Error getting valid token:", error);
      return null;
    }
  }, []);

  // Function to refresh token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const storedAuth = localStorage.getItem("auth");
    if (!storedAuth) return false;

    try {
      const parsed = JSON.parse(storedAuth);
      const refreshToken = parsed.tokens?.refreshToken;
      
      if (!refreshToken) return false;

      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      
      // Update stored auth with new tokens
      localStorage.setItem("auth", JSON.stringify({ 
        user: parsed.user, 
        tokens: data 
      }));

      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    const storedAuth = localStorage.getItem("auth");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        const tokens = parsed.tokens;
        
        // Check if access token is expired on app load
        if (tokens?.accessToken && isTokenExpired(tokens.accessToken)) {
          // Try to refresh token silently
          refreshToken().then((success) => {
            if (!success) {
              // Refresh failed, clear auth and redirect to login
              localStorage.removeItem("auth");
              setUser(null);
            } else {
              setUser(parsed.user);
            }
            setIsLoading(false);
          });
        } else {
          setUser(parsed.user);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading auth state:", error);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [refreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem("auth", JSON.stringify({ user: data.user, tokens: data }));
      setLocation("/dashboard");
      
      toast({
        title: "Success",
        description: "Logged in successfully",
        variant: "success",
      });

      return { success: true };
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Login failed",
        variant: "destructive",
      });
      return { success: false, error };
    }
  }, [setLocation, toast]);

  const register = useCallback(async (username: string, email: string, password: string, confirmPassword: string) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, confirmPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const data = await response.json();
      setUser(data.user);
      localStorage.setItem("auth", JSON.stringify({ user: data.user, tokens: data }));
      setLocation("/dashboard");
      
      toast({
        title: "Success",
        description: "Account created successfully",
        variant: "success",
      });

      return { success: true };
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Registration failed",
        variant: "destructive",
      });
      return { success: false, error };
    }
  }, [setLocation, toast]);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem("auth");
    setLocation("/login");
    
    toast({
      title: "Success",
      description: "Logged out successfully",
      variant: "success",
    });
  }, [setLocation, toast]);

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    getValidToken: () => {
      // This is a synchronous version for immediate use
      const storedAuth = localStorage.getItem("auth");
      if (!storedAuth) return null;
      
      try {
        const parsed = JSON.parse(storedAuth);
        const tokens = parsed.tokens;
        
        if (!tokens?.accessToken || isTokenExpired(tokens.accessToken)) {
          return null;
        }
        
        return tokens.accessToken;
      } catch (error) {
        return null;
      }
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};