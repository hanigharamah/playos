import posthog from "posthog-js";

// Analytics is fully optional: with no VITE_POSTHOG_KEY (e.g. local dev), every
// function below is a silent no-op, so instrumentation never breaks the app.
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// Must match the region the PostHog project was created in — a mismatch is
// rejected with authentication_failed and events silently never arrive.
// The PlayOS project is EU-hosted (PDPL data residency for Saudi players).
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://eu.i.posthog.com";

let enabled = false;

export function initAnalytics(): void {
  if (enabled || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // captured manually on route change (SPA)
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
  });
  enabled = true;
}

export function capturePageview(path: string): void {
  if (!enabled) return;
  posthog.capture("$pageview", { $current_url: window.location.origin + path });
}

export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  posthog.identify(id, props);
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!enabled) return;
  posthog.capture(event, props);
}

/** Call on logout so a shared device doesn't attribute events to the wrong player. */
export function resetAnalytics(): void {
  if (!enabled) return;
  posthog.reset();
}
