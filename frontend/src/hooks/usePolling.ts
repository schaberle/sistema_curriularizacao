/**
 * usePolling Hook
 * Manages periodic polling of async functions
 */

import { useEffect, useRef } from 'react';

interface UsePollingOptions {
  enabled: boolean;
  interval: number;
}

/**
 * Hook to periodically call an async function
 * @param callback - Async function to call periodically
 * @param options - Configuration options
 */
export function usePolling(
  callback: () => Promise<void>,
  options: UsePollingOptions
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!options.enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Call immediately
    callbackRef.current();

    // Then set up polling
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, options.interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [options.enabled, options.interval]);
}
