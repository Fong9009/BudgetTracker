import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { Smartphone } from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: "fas fa-tachometer-alt" },
  { name: "Transactions", href: "/transactions", icon: "fas fa-exchange-alt" },
  { name: "Accounts", href: "/accounts", icon: "fas fa-wallet" },
  { name: "Categories", href: "/categories", icon: "fas fa-tags" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { isInstallable, installApp } = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstallApp = async () => {
    if (!isInstallable) return;
    
    setIsInstalling(true);
    try {
      await installApp();
    } catch (error) {
      console.error('Failed to install app:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="hidden lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-card border-r border-border pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-chart-line text-primary-foreground text-sm" />
            </div>
            <h1 className="ml-3 text-xl font-semibold text-foreground">
              FinanceTracker
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            const walkthroughId = item.name === 'Dashboard' ? 'dashboard' :
                                 item.name === 'Accounts' ? 'accounts-nav' :
                                 item.name === 'Categories' ? 'categories-nav' :
                                 item.name === 'Transactions' ? 'transactions-nav' : '';
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                data-walkthrough={walkthroughId}
                className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <i
                  className={cn(
                    item.icon,
                    "mr-3 text-sm",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Install App Button */}
        <div className="px-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstallApp}
            disabled={!isInstallable || isInstalling}
            className="w-full justify-start"
            title={isInstallable ? 'Install this app' : 'App cannot be installed on this device/browser'}
            data-walkthrough="install-app"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            {isInstalling ? 'Installing...' : 'Install App'}
          </Button>
        </div>
      </div>
    </div>
  );
}
