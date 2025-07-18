import React, { useState } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { X, Download, Smartphone } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallPromptProps {
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onDismiss }) => {
  const { isInstallable, installApp } = usePWA();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const success = await installApp();
      if (success && onDismiss) {
        onDismiss();
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <Card className="shadow-lg border-2 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Install App</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="mb-4">
            Install Budget Tracker for quick access and offline functionality.
          </CardDescription>
          <div className="flex space-x-2">
            <Button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              {isInstalling ? 'Installing...' : 'Install'}
            </Button>
            <Button
              variant="outline"
              onClick={onDismiss}
              disabled={isInstalling}
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 