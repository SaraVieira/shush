import type { Settings } from "./types";

export const STORAGE_KEY = "shush:settings";

const defaultSettings: Settings = {
  deviceId: null,
  threshold: 65,
  autostart: false,
};

export const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (s: Settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
};
