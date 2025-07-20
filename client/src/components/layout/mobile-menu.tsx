import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { X, Menu, Smartphone } from "lucide-react";
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

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn("lg:hidden [&_svg]:!size-5 flex items-center justify-center h-10 w-10 hover:bg-primary hover:text-primary-foreground p-2", className)}
        onClick={toggleMenu}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 flex z-40">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={closeMenu}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-card border-r border-border">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-10 w-10 text-muted-foreground"
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
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link 
                      key={item.name} 
                      href={item.href}
                      className={cn(
                        "group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={closeMenu}
                    >
                      <i
                        className={cn(
                          item.icon,
                          "mr-4 text-sm",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {item.name}
                    </Link>
                  );
                })}
                
                {/* Install App Button */}
                {isInstallable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInstallApp}
                    disabled={isInstalling}
                    className="w-full justify-start mt-4"
                  >
                    <Smartphone className="h-4 w-4 mr-3" />
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
