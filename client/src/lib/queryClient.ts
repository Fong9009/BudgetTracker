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

export async function apiRequest(
  method: string,
  url: string,
  data?: any,
  options: RequestInit = {}
): Promise<any> {
  const authData = localStorage.getItem("auth");
  let token = null;
  
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      token = parsed.tokens?.accessToken;
    } catch (error) {
      console.error('Error parsing auth data:', error);
    }
  }
  
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: "include",
    ...(data && { body: JSON.stringify(data) }),
    ...options,
  });

  await throwIfResNotOk(res);
  
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
    const authData = localStorage.getItem("auth");
    let token = null;
    
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        token = parsed.tokens?.accessToken;
      } catch (error) {
        console.error('Error parsing auth data:', error);
      }
    }
    
    const res = await fetch(queryKey[0] as string, {
      method: "GET",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
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
      queryFn: getQueryFn({ on401: "throw" }),
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
