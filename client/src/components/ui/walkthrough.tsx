import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Wallet, 
  Tag, 
  TrendingUp, 
  Plus,
  Smartphone,
  Wifi,
  WifiOff
} from 'lucide-react';

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  icon?: React.ReactNode;
}

const walkthroughSteps: WalkthroughStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Finance Tracker!',
    description: 'Let\'s take a quick tour to help you get started with managing your finances.',
    icon: <Home className="h-6 w-6" />
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Your dashboard shows your total balance, recent transactions, and spending insights at a glance.',
    target: '[data-walkthrough="dashboard"]',
    position: 'bottom',
    icon: <TrendingUp className="h-6 w-6" />
  },
  {
    id: 'accounts',
    title: 'Manage Your Accounts',
    description: 'Add your bank accounts, credit cards, and other financial accounts to track your total wealth.',
    target: '[data-walkthrough="accounts-nav"]',
    position: 'right',
    icon: <Wallet className="h-6 w-6" />
  },
  {
    id: 'categories',
    title: 'Organize with Categories',
    description: 'Create categories to organize your transactions (e.g., Food, Transport, Entertainment).',
    target: '[data-walkthrough="categories-nav"]',
    position: 'right',
    icon: <Tag className="h-6 w-6" />
  },
  {
    id: 'transactions',
    title: 'Track Your Transactions',
    description: 'Add income and expenses to keep track of your spending habits and financial goals.',
    target: '[data-walkthrough="transactions-nav"]',
    position: 'right',
    icon: <Plus className="h-6 w-6" />
  },
  {
    id: 'offline',
    title: 'Works Offline Too!',
    description: 'This app works even without internet. Your data syncs automatically when you\'re back online.',
    target: '[data-walkthrough="offline-status"]',
    position: 'top',
    icon: <Wifi className="h-6 w-6" />
  },
  {
    id: 'pwa',
    title: 'Install as App',
    description: 'Install this app on your device for quick access and a native app experience.',
    target: '[data-walkthrough="install-app"]',
    position: 'top',
    icon: <Smartphone className="h-6 w-6" />
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You now know the basics. Start by adding your first account and transaction to get going!',
    icon: <Home className="h-6 w-6" />
  }
];

interface WalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Walkthrough({ isOpen, onClose }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const step = walkthroughSteps[currentStep];
    if (step.target) {
      const element = document.querySelector(step.target) as HTMLElement;
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setHighlightedElement(null);
    }
  }, [currentStep, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const nextStep = () => {
    if (currentStep < walkthroughSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipWalkthrough = () => {
    localStorage.setItem('walkthrough-completed', 'true');
    onClose();
  };

  if (!isOpen) return null;

  const step = walkthroughSteps[currentStep];
  const isLastStep = currentStep === walkthroughSteps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      
      {/* Highlight overlay */}
      {highlightedElement && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: highlightedElement.offsetTop - 4,
            left: highlightedElement.offsetLeft - 4,
            width: highlightedElement.offsetWidth + 8,
            height: highlightedElement.offsetHeight + 8,
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      )}

      {/* Walkthrough Card */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4">
        <Card className="shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {step.icon}
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">
                Step {currentStep + 1} of {walkthroughSteps.length}
              </Badge>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / walkthroughSteps.length) * 100}%` }}
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pb-6">
            <p className="text-gray-600 mb-6 leading-relaxed">
              {step.description}
            </p>
            
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={skipWalkthrough}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Skip
                </Button>
                <Button
                  onClick={nextStep}
                  className="flex items-center gap-2"
                >
                  {isLastStep ? 'Get Started' : 'Next'}
                  {!isLastStep && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Hook to manage walkthrough state
export function useWalkthrough() {
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);

  useEffect(() => {
    const hasCompleted = localStorage.getItem('walkthrough-completed');
    if (!hasCompleted) {
      // Show walkthrough after a short delay to let the app load
      const timer = setTimeout(() => {
        setIsWalkthroughOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const openWalkthrough = () => setIsWalkthroughOpen(true);
  const closeWalkthrough = () => setIsWalkthroughOpen(false);

  return {
    isWalkthroughOpen,
    openWalkthrough,
    closeWalkthrough
  };
} 