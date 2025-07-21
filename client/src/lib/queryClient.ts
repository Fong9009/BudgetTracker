import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData = { message: "An unexpected error occurred. Please try again." };
    try {
      const json = await res.json();
      if (json.message) {
        errorData.message = json.message;
      }
    } catch (e) {
      // Ignore JSON parsing errors and use the default message
    }
    
    const error: any = new Error(errorData.message);
    error.response = res;
    error.data = errorData;
    throw error;
  }
}

// Function to check if token is expired
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
}

// Function to refresh token
async function refreshToken(): Promise<boolean> {
  const storedAuth = localStorage.getItem("auth");
  if (!storedAuth) return false;

  try {
    const parsed = JSON.parse(storedAuth);
    const refreshToken = parsed.tokens?.refreshToken;
    
    if (!refreshToken) return false;

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      credentials: "include", // Include cookies for CSRF
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
}

// Function to get valid token with automatic refresh
export async function getValidToken(): Promise<string | null> {
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
          // Refresh failed, clear auth
          localStorage.removeItem("auth");
          return null;
        }
      } else {
        // No refresh token, clear auth
        localStorage.removeItem("auth");
        return null;
      }
    }

    return tokens.accessToken;
  } catch (error) {
    console.error("Error getting valid token:", error);
    return null;
  }
}

// Function to get CSRF token
async function getCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf-token", {
      method: "GET",
      credentials: "include",
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.csrfToken;
    }
  } catch (error) {
    console.warn("Failed to get CSRF token:", error);
  }
  
  return null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: any,
  options: RequestInit = {},
  retryOnCSRFError = true
): Promise<any> {
  const token = await getValidToken();
  
  // Don't send CSRF tokens for auth endpoints
  const isAuthEndpoint = url.includes('/auth/');
  const csrfToken = (method !== 'GET' && !isAuthEndpoint) ? await getCSRFToken() : null;
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    ...options.headers,
  } as Record<string, string>;
  
  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    ...(data && { body: JSON.stringify(data) }),
    ...options,
  });

  if (!res.ok) {
    // If CSRF error and allowed to retry, fetch new token and retry once
    if (
      res.status === 403 &&
      retryOnCSRFError &&
      method !== 'GET' &&
      !isAuthEndpoint
    ) {
      try {
        const errorJson = await res.clone().json();
        if (
          errorJson?.message?.toLowerCase().includes('csrf') ||
          errorJson?.error?.toLowerCase().includes('csrf')
        ) {
          // Fetch new CSRF token and retry once
          const newCSRFToken = await getCSRFToken();
          const retryHeaders = {
            ...headers,
            "X-CSRF-Token": newCSRFToken,
          };
          const retryRes = await fetch(url, {
            method,
            headers: retryHeaders,
            credentials: "include",
            ...(data && { body: JSON.stringify(data) }),
            ...options,
          });
          await throwIfResNotOk(retryRes);
          const contentType = retryRes.headers.get("content-type");
          if (retryRes.status === 204 || !contentType || !contentType.includes("application/json")) {
            return null;
          }
          return retryRes.json();
        }
      } catch (e) {
        // Ignore JSON parse errors and fall through to throw
      }
    }
    await throwIfResNotOk(res);
  }
  
  // Handle empty responses (like 204 No Content)
  const contentType = res.headers.get("content-type");
  if (res.status === 204 || !contentType || !contentType.includes("application/json")) {
    return null;
  }
  
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = await getValidToken();
    
    // If no token is available, return null for unauthenticated users
    if (!token) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      } else {
        throw new Error("Authentication required");
      }
    }
    
    const res = await fetch(queryKey[0] as string, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
