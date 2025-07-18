import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "./use-toast";

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: any }>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: any }>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    const storedAuth = localStorage.getItem("auth");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        setUser(parsed.user);
      } catch (error) {
        console.error("Error loading auth state:", error);
      }
    }
    setIsLoading(false);
  }, []);

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
  };

  return React.createElement(AuthContext.Provider, { value: contextValue }, children);
}; 