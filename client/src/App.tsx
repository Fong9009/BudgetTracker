import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { PWAInstallPrompt } from './components/ui/pwa-install-prompt';
import { OfflineIndicator } from './components/ui/offline-indicator';
import { queryClient } from '@/lib/queryClient';
import { useLocation, Switch, Route, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Login from '@/pages/login';
import Register from '@/pages/register';
import ForgotPassword from '@/pages/forgot-password';
import ResetPassword from '@/pages/reset-password';
import Dashboard from '@/pages/dashboard';
import Accounts from '@/pages/accounts';
import Categories from '@/pages/categories';
import Transactions from '@/pages/transactions';
import Profile from '@/pages/profile';
import ArchivedAccounts from '@/pages/archived-accounts';
import ArchivedTransactions from '@/pages/archived-transactions';
import ArchivedCategories from '@/pages/archived-categories';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar'; 

// A custom route to handle protected content
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }
  
  return isAuthenticated ? <Route {...rest} component={Component} /> : <Redirect to="/login" />;
};

function App() {
  const { isAuthenticated, login, logout, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Show loading screen during initial authentication check
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login">
          <Login onLogin={login} onSwitchToRegister={() => setLocation('/register')} onForgotPassword={() => setLocation('/forgot-password')} />
        </Route>
        <Route path="/register">
          <Register onSwitchToLogin={() => setLocation('/login')} />
        </Route>
        <Route path="/forgot-password">
          <ForgotPassword onSwitchToLogin={() => setLocation('/login')} />
        </Route>
        <Route path="/reset-password/:token">
          {({ token }: { token: string }) => <ResetPassword token={token} onSuccess={() => setLocation('/login')} />}
        </Route>
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <TopBar onLogout={logout} />
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <ProtectedRoute path="/dashboard" component={Dashboard} />
            <ProtectedRoute path="/accounts" component={Accounts} />
            <ProtectedRoute path="/accounts/archived" component={ArchivedAccounts} />
            <ProtectedRoute path="/categories" component={Categories} />
            <ProtectedRoute path="/categories/archived" component={ArchivedCategories} />
            <ProtectedRoute path="/transactions" component={Transactions} />
            <ProtectedRoute path="/transactions/archived" component={ArchivedTransactions} />
            <ProtectedRoute path="/profile" component={Profile} />
            <Route path="/login">
              <Redirect to="/dashboard" />
            </Route>
            <Route path="/register">
              <Redirect to="/dashboard" />
            </Route>
            <Route path="/forgot-password">
              <Redirect to="/dashboard" />
            </Route>
            <Route path="/">
              <Redirect to="/dashboard" />
            </Route>
          </Switch>
        </main>
      </div>
    </div>
  );
}

function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <PWAInstallPrompt />
        <OfflineIndicator />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default AppWrapper;
