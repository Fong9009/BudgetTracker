import React from 'react';
import { useOffline } from '../../hooks/useOffline';
import { Badge } from './badge';
import { Button } from './button';
import { RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';

export const OfflineStatus: React.FC = () => {
  const {
    isOnline,
    syncInProgress,
    pendingSyncCount,
    isOfflineDBReady,
    handleManualSync,
  } = useOffline();

  if (!isOfflineDBReady) {
    return null; // Don't show anything while DB is initializing
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {/* Online/Offline Status */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border">
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-medium">
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {!isOnline && (
          <Badge variant="secondary" className="text-xs">
            Offline Mode
          </Badge>
        )}
      </div>

      {/* Sync Status */}
      {isOnline && (syncInProgress || pendingSyncCount > 0) && (
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border">
          {syncInProgress ? (
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          ) : (
            <AlertCircle className="h-4 w-4 text-orange-500" />
          )}
          <span className="text-sm">
            {syncInProgress 
              ? 'Syncing...' 
              : `${pendingSyncCount} pending sync`
            }
          </span>
          {!syncInProgress && pendingSyncCount > 0 && (
            <Button
              size="sm"
              onClick={handleManualSync}
              className="h-6 px-2 text-xs"
            >
              Sync Now
            </Button>
          )}
        </div>
      )}

      {/* Offline Warning */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <div className="text-sm">
            <p className="font-medium text-orange-800 dark:text-orange-200">
              Working Offline
            </p>
            <p className="text-orange-600 dark:text-orange-300 text-xs">
              Changes will sync when you're back online
            </p>
          </div>
        </div>
      )}
    </div>
  );
}; 