import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { X, Menu, Smartphone, RefreshCw } from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: "fas fa-tachometer-alt" },
  { name: "Transactions", href: "/transactions", icon: "fas fa-exchange-alt" },
  { name: "Accounts", href: "/accounts", icon: "fas fa-wallet" },
  { name: "Categories", href: "/categories", icon: "fas fa-tags" },
];

interface MobileMenuProps {
  className?: string;
}

export function MobileMenu({ className }: MobileMenuProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { isInstallable, installApp } = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const handleInstallApp = async () => {
    if (!isInstallable) return;
    
    setIsInstalling(true);
    try {
      await installApp();
      closeMenu();
    } catch (error) {
      console.error('Failed to install app:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleHardRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate Cmd+Shift+R / Ctrl+Shift+R behavior
      // Clear cache and force a complete reload
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear any stored CSRF tokens or auth data
      if (typeof window !== 'undefined') {
        // Clear any localStorage/sessionStorage that might contain stale tokens
        sessionStorage.clear();
        // Note: We don't clear localStorage as it might contain user preferences
      }
      
      // Force reload by changing the URL slightly and then reloading
      const currentUrl = window.location.href;
      const separator = currentUrl.includes('?') ? '&' : '?';
      const timestamp = Date.now();
      window.location.href = `${currentUrl}${separator}_refresh=${timestamp}`;
      
      // If the above doesn't work, fall back to regular reload
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Failed to refresh:', error);
      // Fallback to simple reload
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "lg:hidden flex items-center justify-center h-12 w-12 hover:bg-primary hover:text-primary-foreground p-3 rounded-xl transition-all duration-200 active:scale-95 touch-manipulation",
          className
        )}
        onClick={toggleMenu}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 flex z-50">
          <div
            className="fixed inset-0 bg-background/90 backdrop-blur-md"
            onClick={closeMenu}
          />
          <div className="relative flex-1 flex flex-col max-w-[85vw] w-full bg-card border-r border-border shadow-2xl">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-12 w-12 text-muted-foreground rounded-full"
                onClick={closeMenu}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Mobile navigation content */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <i className="fas fa-chart-line text-primary-foreground text-sm" />
                  </div>
                  <h1 className="ml-3 text-xl font-semibold text-foreground">
                    FinanceTracker
                  </h1>
                </div>
              </div>
              <nav className="mt-6 px-3 space-y-2">
                {navigation.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link 
                      key={item.name} 
                      href={item.href}
                      className={cn(
                        "group flex items-center px-4 py-4 text-base font-medium rounded-xl transition-all duration-200",
                        "min-h-[56px] touch-manipulation",
                        isActive
                          ? "bg-primary/15 text-primary shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:scale-95"
                      )}
                      onClick={closeMenu}
                    >
                      <i
                        className={cn(
                          item.icon,
                          "mr-4 text-lg w-6 text-center",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="font-semibold">{item.name}</span>
                    </Link>
                  );
                })}
                
                {/* Hard Refresh Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHardRefresh}
                  disabled={isRefreshing}
                  className="w-full justify-start mt-6 px-4 py-4 h-14 text-base font-medium rounded-xl border-2"
                >
                  <RefreshCw className={`h-5 w-5 mr-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Hard Refresh'}
                </Button>

                {/* Install App Button */}
                {isInstallable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInstallApp}
                    disabled={isInstalling}
                    className="w-full justify-start mt-3 px-4 py-4 h-14 text-base font-medium rounded-xl border-2"
                  >
                    <Smartphone className="h-5 w-5 mr-3" />
                    {isInstalling ? 'Installing...' : 'Install App'}
                  </Button>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
