/** Test stub for the vite-plugin-pwa virtual module (no service worker in tests). */
export function useRegisterSW(): {
  needRefresh: [boolean, (v: boolean) => void];
  offlineReady: [boolean, (v: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: (_reload?: boolean) => Promise.resolve(),
  };
}
