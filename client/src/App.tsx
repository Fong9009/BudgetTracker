import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import Login from '@/pages/login';
import Register from '@/pages/register';
import ForgotPassword from '@/pages/forgot-password';
import ResetPassword from '@/pages/reset-password';
import Dashboard from '@/pages/dashboard';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar'; 
import { useLocation, Switch, Route, Redirect } from 'wouter';

function App() {
  const { isAuthenticated, login, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (!isAuthenticated) {
    if (location.startsWith('/reset-password/')) {
      const token = location.split('/')[2];
      return <ResetPassword token={token} onSuccess={() => setLocation('/login')} />;
    }
    if (location === '/forgot-password') {
      return <ForgotPassword onSwitchToLogin={() => setLocation('/login')} />;
    }
    if (location === '/register') {
      return <Register onRegister={login} onSwitchToLogin={() => setLocation('/login')} />;
    }
    return <Login onLogin={login} onSwitchToRegister={() => setLocation('/register')} onForgotPassword={() => setLocation('/forgot-password')} />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <TopBar onLogout={logout} />
        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/">
              <Redirect to="/dashboard" />
            </Route>
            {/* Add other authenticated routes here */}
          </Switch>
        </main>
      </div>
    </div>
  );
}

function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  );
}

export default AppWrapper;
