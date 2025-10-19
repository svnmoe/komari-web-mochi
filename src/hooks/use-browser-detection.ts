import { useMemo } from 'react';
import { UserAgentHelper } from '@/utils/UserAgentHelper';

/**
 * Hook for detecting browser capabilities and compatibility
 */
export function useBrowserDetection() {
  const shouldDisableBackdropFilter = useMemo(() => {
    return UserAgentHelper.shouldDisableBackdropFilter();
  }, []);

  const isMobile = useMemo(() => {
    return UserAgentHelper.isMobile();
  }, []);

  const browserInfo = useMemo(() => {
    return UserAgentHelper.parse();
  }, []);

  return {
    shouldDisableBackdropFilter,
    isMobile,
    browserInfo,
  };
}
