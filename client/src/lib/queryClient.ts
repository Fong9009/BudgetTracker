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
      console.log('[CSRF] Fetched token:', data.csrfToken);
      return data.csrfToken;
    }
  } catch (error) {
    console.warn("Failed to get CSRF token:", error);
  }
  
  return null;
}

// After login or token refresh, always fetch a new CSRF token
export async function loginAndFetchCSRF(loginFn: () => Promise<any>) {
  const result = await loginFn();
  await getCSRFToken();
  return result;
}

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

export async function apiRequest(
  method: string,
  url: string,
  data?: any,
  options: RequestInit = {},
  retryOnCSRFError = true
): Promise<any> {
  // Create a unique key for request deduplication
  const requestKey = `${method}:${url}:${data ? JSON.stringify(data) : ''}`;
  
  // Check if there's already a pending request with the same key
  if (pendingRequests.has(requestKey)) {
    console.log(`[API] Deduplicating request: ${method} ${url}`);
    return pendingRequests.get(requestKey);
  }
  
  const token = await getValidToken();
  
  // CSRF tokens temporarily disabled
  const csrfToken = null;
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
          // CSRF token header temporarily removed
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
    // CSRF retry logic temporarily disabled
    // TODO: Re-enable CSRF retry logic once CSRF protection is working properly
    await throwIfResNotOk(res);
  }
  
  // Handle empty responses (like 204 No Content)
  const contentType = res.headers.get("content-type");
  if (res.status === 204 || !contentType || !contentType.includes("application/json")) {
    return null;
  }
  
  const result = res.json();
  
  // Store the promise in the deduplication cache
  pendingRequests.set(requestKey, result);
  
  // Clean up the cache entry when the request completes
  result.finally(() => {
    pendingRequests.delete(requestKey);
  });
  
  return result;
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
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in memory for 10 minutes
      retry: (failureCount, error) => {
        // Retry network errors, but not 4xx errors
        if (failureCount >= 3) return false;
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // Retry network errors for mutations, but not 4xx errors
        if (failureCount >= 2) return false;
        if (error instanceof Error && error.message.includes('Failed to fetch')) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});
