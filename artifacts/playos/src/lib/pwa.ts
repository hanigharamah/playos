export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: push simply won't work this session.
    });
  });
}

export function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Legacy iOS Safari flag
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Push is only reachable on iOS after the site is installed to the home screen. */
export function canRequestPush(): boolean {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (isIOS()) return isStandalone();
  return true;
}
