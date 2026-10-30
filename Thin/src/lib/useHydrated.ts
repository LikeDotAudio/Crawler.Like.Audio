import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/** false during the server/static render and the hydration pass, true after: no setState-in-effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Whether a browser capability is present (e.g. navigator.usb). Reports
 * `true` while prerendering so the static HTML shows no "unsupported" banner.
 */
export function useBrowserSupport(probe: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, probe, () => true);
}
