"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => { },
  toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = "konis-theme";
const DEFAULT_THEME: Theme = "system";
const DEFAULT_RESOLVED_THEME: "light" | "dark" = "light";
const DEFAULT_SNAPSHOT = {
  theme: DEFAULT_THEME,
  resolvedTheme: DEFAULT_RESOLVED_THEME,
};

type ThemeSnapshot = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
};

const themeSubscribers = new Set<() => void>();
let cachedSnapshotKey = `${DEFAULT_SNAPSHOT.theme}:${DEFAULT_SNAPSHOT.resolvedTheme}`;
let cachedSnapshot: ThemeSnapshot = DEFAULT_SNAPSHOT;
let volatileTheme: Theme | null = null;

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  if (volatileTheme) return volatileTheme;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : volatileTheme ?? DEFAULT_THEME;
  } catch {
    return volatileTheme ?? DEFAULT_THEME;
  }
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return DEFAULT_RESOLVED_THEME;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

function createThemeSnapshot(theme: Theme, resolvedTheme: "light" | "dark") {
  const key = `${theme}:${resolvedTheme}`;
  if (key === cachedSnapshotKey) {
    return cachedSnapshot;
  }

  cachedSnapshotKey = key;
  cachedSnapshot = { theme, resolvedTheme };
  return cachedSnapshot;
}

function getThemeSnapshot() {
  if (typeof window === "undefined") return DEFAULT_SNAPSHOT;

  const theme = readStoredTheme();
  return createThemeSnapshot(theme, resolveTheme(theme));
}

function getServerThemeSnapshot() {
  return DEFAULT_SNAPSHOT;
}

function notifyThemeSubscribers() {
  themeSubscribers.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  themeSubscribers.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      volatileTheme = null;
      listener();
    }
  };

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemThemeChange = () => {
    if (readStoredTheme() === "system") listener();
  };

  window.addEventListener("storage", handleStorage);
  mediaQuery.addEventListener("change", handleSystemThemeChange);

  return () => {
    themeSubscribers.delete(listener);
    window.removeEventListener("storage", handleStorage);
    mediaQuery.removeEventListener("change", handleSystemThemeChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme } = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    volatileTheme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Ignore storage failures; the in-memory theme still updates.
    }
    const nextResolvedTheme = resolveTheme(t);
    applyTheme(nextResolvedTheme);
    notifyThemeSubscribers();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
