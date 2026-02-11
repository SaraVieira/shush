import { atom } from "jotai";
import type { AudioDevice, Settings } from "./types";
import { loadSettings, saveSettings } from "./settings";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const devicesAtom = atom<AudioDevice[]>([]);
export const settingsAtom = atom<Settings>(loadSettings());
export const currentDbAtom = atom<number | null>(null);
export const statusAtom = atom<"idle" | "listening" | "error">("idle");
export const errorMessageAtom = atom<string | null>(null);
export const notifAllowedAtom = atom<boolean | null>(null);
export const activeTabAtom = atom<"monitor" | "settings">("monitor");
const lastNotifyRef = atom<number>(0);

let cleanupListeners: (() => void)[] = [];

export const startListeningAtom = atom(null, async (get, set) => {
  // Clean up any previous listeners (handles StrictMode double-mount, HMR, etc.)
  cleanupListeners.forEach((fn) => fn());
  cleanupListeners = [];

  set(statusAtom, "idle");
  set(errorMessageAtom, null);

  // Listen for dB level events from Rust
  const unlistenDb = await listen<{ db: number }>("db-level", (event) => {
    set(currentDbAtom, event.payload.db);

    if (get(statusAtom) !== "listening") {
      set(statusAtom, "listening");
    }

    // Check threshold for notifications
    const threshold = get(settingsAtom).threshold;
    if (event.payload.db >= threshold && get(notifAllowedAtom) === true) {
      const now = performance.now();
      if (now - get(lastNotifyRef) > 4000) {
        invoke("plugin:notification|notify", {
          options: {
            title: "Shush",
            body: `You're above ${threshold} dB`,
          },
        }).catch((err) => {
          console.error("Notification failed", err);
          set(
            errorMessageAtom,
            "Notification failed. Check macOS notification permission.",
          );
        });
        set(lastNotifyRef, now);
      }
    }
  });

  // Listen for audio errors from Rust
  const unlistenError = await listen<string>("audio-error", (event) => {
    set(statusAtom, "error");
    set(errorMessageAtom, event.payload);
  });

  // Listen for audio started confirmation
  const unlistenStarted = await listen("audio-started", () => {
    set(statusAtom, "listening");
  });

  cleanupListeners = [unlistenDb, unlistenError, unlistenStarted];
});

export const ensureDevicesAtom = atom(
  null,
  async (_get, set, signal: AbortSignal) => {
    try {
      const devices = await invoke<AudioDevice[]>("list_audio_devices");
      if (signal.aborted) return;
      set(devicesAtom, devices);
      set(statusAtom, "idle");
    } catch (err) {
      if (signal.aborted) return;
      console.error(err);
      set(errorMessageAtom, "Could not list audio devices.");
      set(statusAtom, "error");
    }
  },
);

export const persistSettingsAtom = atom(
  null,
  async (_get, set, next: Settings) => {
    set(settingsAtom, next);
    saveSettings(next);
  },
);
