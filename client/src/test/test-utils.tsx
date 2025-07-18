import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock data for testing
export const mockUser = {
  _id: 'user123',
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAccount = {
  _id: 'account123',
  name: 'Test Account',
  type: 'checking',
  balance: 1000,
  userId: 'user123',
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockCategory = {
  _id: 'category123',
  name: 'Test Category',
  color: '#3b82f6',
  icon: 'fas fa-tag',
  userId: 'user123',
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockTransaction = {
  _id: 'transaction123',
  amount: 100,
  description: 'Test Transaction',
  type: 'expense',
  date: new Date(),
  accountId: 'account123',
  categoryId: 'category123',
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  account: mockAccount,
  category: mockCategory,
}; 