import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Settings {
  blog_maintenance?: boolean;
  site_maintenance?: boolean;
  store_maintenance?: boolean;
  comments_maintenance?: boolean;
  feedback_enabled?: boolean;
  feedback_allowed_paths?: string;
}

declare global {
  interface Window {
    __INITIAL_SETTINGS__?: Settings;
  }
}

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  refreshSettings: () => Promise<Settings>;
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

let settingsPromise: Promise<Settings> | null = null;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = () => {
    if (typeof window !== 'undefined' && window.__INITIAL_SETTINGS__) {
      return Promise.resolve(window.__INITIAL_SETTINGS__);
    }
    if (!settingsPromise) {
      settingsPromise = fetch('/api/settings')
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .catch((err) => {
          console.error("Failed to fetch settings:", err);
          settingsPromise = null; // Reset on failure so we can retry next time
          return {};
        });
    }
    return settingsPromise;
  };

  const refreshSettings = async () => {
    if (typeof window !== 'undefined') {
      window.__INITIAL_SETTINGS__ = undefined;
    }
    settingsPromise = null; // Clear cache
    const data = await fetchSettings();
    setSettings(data);
    return data;
  };

  useEffect(() => {
    fetchSettings().then((data) => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider");
  return context;
};
