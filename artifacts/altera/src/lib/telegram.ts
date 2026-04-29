// Lightweight Telegram WebApp wrapper.
// We intentionally avoid the @telegram-apps SDK: the Mini App injects
// `window.Telegram.WebApp` automatically and the API is small + stable.

export type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
export type HapticNotification = "error" | "success" | "warning";

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string }; start_param?: string };
  themeParams?: Record<string, string>;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: HapticImpact) => void;
    notificationOccurred: (type: HapticNotification) => void;
    selectionChanged: () => void;
  };
  MainButton: {
    text: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (s: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setParams?: (p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

let scriptLoaded = false;

function loadTelegramScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded || window.Telegram?.WebApp) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.async = true;
    s.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  const wa = getWebApp();
  return !!wa && !!wa.initData && wa.initData.length > 0;
}

/**
 * Initialize Telegram Mini App: load SDK script, mark ready, expand,
 * apply theme variables and patch fetch to attach the initData header.
 */
export async function initTelegram(): Promise<TelegramWebApp | null> {
  await loadTelegramScript();
  const wa = getWebApp();
  if (!wa) return null;
  try {
    wa.ready();
    wa.expand();
  } catch {
    /* ignore */
  }
  applyTelegramTheme(wa);
  patchFetchForInitData(wa);
  return wa;
}

function applyTelegramTheme(wa: TelegramWebApp): void {
  const root = document.documentElement;
  const tp = wa.themeParams ?? {};
  const map: Record<string, string | undefined> = {
    "--tg-bg": tp["bg_color"],
    "--tg-text": tp["text_color"],
    "--tg-hint": tp["hint_color"],
    "--tg-button": tp["button_color"],
    "--tg-button-text": tp["button_text_color"],
    "--tg-link": tp["link_color"],
    "--tg-secondary-bg": tp["secondary_bg_color"],
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) root.style.setProperty(k, v);
  }
  if (wa.colorScheme) root.classList.toggle("dark", wa.colorScheme === "dark");
  try {
    wa.setHeaderColor?.(tp["bg_color"] ?? "#0a0a0c");
    wa.setBackgroundColor?.(tp["bg_color"] ?? "#0a0a0c");
  } catch {
    /* ignore */
  }
}

function patchFetchForInitData(wa: TelegramWebApp): void {
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
    if (!url.startsWith("/api/") && !url.includes("/api/")) {
      return original(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("x-telegram-init-data") && wa.initData) {
      headers.set("x-telegram-init-data", wa.initData);
    }
    if (input instanceof Request) {
      const merged = new Request(input, { headers });
      return original(merged, init);
    }
    return original(input, { ...init, headers });
  };
}

// React hook helpers ---------------------------------------------------------
import { useEffect } from "react";

export function useMainButton(opts: {
  text: string;
  visible?: boolean;
  enabled?: boolean;
  onClick?: () => void;
}): void {
  const { text, visible = true, enabled = true, onClick } = opts;
  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.MainButton) return;
    const btn = wa.MainButton;
    btn.setText(text);
    if (enabled) btn.enable();
    else btn.disable();
    if (visible) btn.show();
    else btn.hide();
    const handler = () => onClick?.();
    btn.onClick(handler);
    return () => {
      btn.offClick(handler);
      btn.hide();
    };
  }, [text, visible, enabled, onClick]);
}

export function useBackButton(onClick?: () => void): void {
  useEffect(() => {
    const wa = getWebApp();
    if (!wa?.BackButton) return;
    const btn = wa.BackButton;
    btn.show();
    const handler = () => onClick?.();
    btn.onClick(handler);
    return () => {
      btn.offClick(handler);
      btn.hide();
    };
  }, [onClick]);
}

export function haptic(kind: HapticImpact | HapticNotification | "selection" = "light"): void {
  const wa = getWebApp();
  const hf = wa?.HapticFeedback;
  if (!hf) return;
  try {
    if (kind === "selection") hf.selectionChanged();
    else if (kind === "success" || kind === "warning" || kind === "error") hf.notificationOccurred(kind);
    else hf.impactOccurred(kind);
  } catch {
    /* ignore */
  }
}
