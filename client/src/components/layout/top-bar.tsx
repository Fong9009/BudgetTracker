import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Search, Bell, LogOut, User, ChevronDown, TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle, Target, PiggyBank, X, Trash2, HelpCircle } from "lucide-react";
import { MobileMenu } from './mobile-menu';
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getValidToken } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  onLogout: () => void;
  onOpenHelp?: () => void;
}

interface Notification {
  id: string;
  type: 'review' | 'alert' | 'reminder' | 'goal';
  title: string;
  message: string;
  date: string;
  read: boolean;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
}

interface SpendingData {
  totalSpent: number;
  monthlyBudget: number;
  categorySpending: Array<{
    category: string;
    spent: number;
    budget: number;
    percentage: number;
  }>;
  previousMonthSpending: number;
  spendingChange: number;
}

export function TopBar({ onLogout, onOpenHelp }: TopBarProps) {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch spending data for notifications
  const { data: spendingData } = useQuery<SpendingData>({
    queryKey: ["/api/analytics/spending-data"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return null;
      
      try {
        const response = await fetch("/api/analytics/spending-data", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Failed to fetch spending data");
        
        return response.json();
      } catch (error) {
        console.error("Error fetching spending data:", error);
        return null;
      }
    },
  });

  // Generate notifications based on real data
  useEffect(() => {
    if (!spendingData) return;

    const newNotifications: Notification[] = [];

    // Check if it's time for a weekly summary (every Monday or if no notifications exist)
    const today = new Date();
    const isMonday = today.getDay() === 1; // Monday is 1
    const lastNotificationDate = localStorage.getItem('last-weekly-summary');
    const lastNotification = lastNotificationDate ? new Date(lastNotificationDate) : null;
    const daysSinceLastSummary = lastNotification ? Math.floor((today.getTime() - lastNotification.getTime()) / (1000 * 60 * 60 * 24)) : 7;

    // Show weekly summary if it's Monday, or if it's been 7+ days since last summary, or if no notifications exist
    if (isMonday || daysSinceLastSummary >= 7 || notifications.length === 0) {
      // Store the current date as last summary date
      localStorage.setItem('last-weekly-summary', today.toISOString());

      // Weekly spending summary
      const weeklySpending = spendingData.totalSpent;
      const weeklyBudget = spendingData.monthlyBudget / 4; // Approximate weekly budget
      const budgetPercentage = (weeklySpending / weeklyBudget) * 100;

      newNotifications.push({
        id: 'weekly-summary',
        type: 'review',
        title: 'Weekly Financial Summary',
        message: `This week you spent $${weeklySpending.toFixed(2)}. ${budgetPercentage > 100 ? 'You exceeded your weekly budget by ' + (budgetPercentage - 100).toFixed(1) + '%' : 'You used ' + budgetPercentage.toFixed(1) + '% of your weekly budget'}.`,
        date: 'Just now',
        read: false,
        icon: <DollarSign className="h-4 w-4 text-blue-500" />,
        priority: 'medium'
      });

      // Top spending category
      if (spendingData.categorySpending.length > 0) {
        const topCategory = spendingData.categorySpending.reduce((prev, current) => 
          prev.spent > current.spent ? prev : current
        );
        
        newNotifications.push({
          id: 'top-category',
          type: 'review',
          title: 'Top Spending Category',
          message: `Your highest spending category this week was ${topCategory.category} with $${topCategory.spent.toFixed(2)}.`,
          date: 'Just now',
          read: false,
          icon: <TrendingUp className="h-4 w-4 text-orange-500" />,
          priority: 'low'
        });
      }

      // Spending trend compared to previous week
      if (spendingData.spendingChange !== 0) {
        const trendMessage = spendingData.spendingChange > 0 
          ? `Your spending increased by ${spendingData.spendingChange.toFixed(1)}% compared to last week.`
          : `Great job! Your spending decreased by ${Math.abs(spendingData.spendingChange).toFixed(1)}% compared to last week.`;
        
        newNotifications.push({
          id: 'spending-trend',
          type: 'review',
          title: 'Weekly Spending Trend',
          message: trendMessage,
          date: 'Just now',
          read: false,
          icon: spendingData.spendingChange > 0 
            ? <TrendingUp className="h-4 w-4 text-orange-500" />
            : <TrendingDown className="h-4 w-4 text-green-500" />,
          priority: 'medium'
        });
      }

      // Savings opportunity
      if (weeklySpending < weeklyBudget * 0.8) {
        const savingsAmount = weeklyBudget - weeklySpending;
        newNotifications.push({
          id: 'savings-opportunity',
          type: 'goal',
          title: 'Savings Opportunity',
          message: `You're under your weekly budget by $${savingsAmount.toFixed(2)}. Consider adding this to your savings!`,
          date: 'Just now',
          read: false,
          icon: <PiggyBank className="h-4 w-4 text-green-500" />,
          priority: 'low'
        });
      }

      // Budget warning if spending is high
      if (budgetPercentage >= 90) {
        newNotifications.push({
          id: 'budget-warning',
          type: 'alert',
          title: 'Weekly Budget Alert',
          message: `You've used ${budgetPercentage.toFixed(1)}% of your weekly budget. Consider reducing spending for the rest of the week.`,
          date: 'Just now',
          read: false,
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
          priority: 'high'
        });
      }
    }

    setNotifications(newNotifications);
  }, [spendingData]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const deleteAllNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'review':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'reminder':
        return <Calendar className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-card shadow border-b border-border">
      <MobileMenu className="ml-2 mt-3" /> 

      <div className="flex-1 px-4 flex justify-between items-center">
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full text-muted-foreground focus-within:text-foreground max-w-lg">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <Search className="h-5 w-5 ml-3" />
              </div>
              <Input
                className="block w-full h-full pl-10 pr-3 py-2 border-transparent text-foreground placeholder-muted-foreground focus:outline-none focus:placeholder-muted-foreground focus:ring-0 focus:border-transparent bg-transparent"
                placeholder="Search..."
                type="search"
              />
            </div>
          </div>
        </div>
        
        <div className="ml-4 flex items-center md:ml-6 space-x-2">
          {/* Help Button */}
          {onOpenHelp && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onOpenHelp}
              className="text-muted-foreground hover:text-foreground"
              title="Help & Tutorial"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between p-2 border-b">
                <h3 className="font-semibold">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {notifications.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={deleteAllNotifications}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete all
                    </Button>
                  )}
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={markAllAsRead}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="py-1">
                  {notifications.map((notification) => (
                    <DropdownMenuItem 
                      key={notification.id}
                      className={`p-3 cursor-pointer ${!notification.read ? 'bg-accent/50' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3 w-full">
                        <div className="flex-shrink-0 mt-0.5">
                          {notification.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {notification.title}
                            </p>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">
                                {notification.date}
                              </span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent dropdown from closing
                                  deleteNotification(notification.id);
                                }}
                                className="text-muted-foreground hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Delete notification"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-center text-primary hover:text-primary/80"
                onClick={() => setLocation('/dashboard')}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 hover:bg-accent">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-foreground hidden md:block">
                  {user?.username}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation('/profile')} className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}