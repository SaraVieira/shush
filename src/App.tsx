import { useEffect } from "react";
import "./index.css";

import { invoke } from "@tauri-apps/api/core";
import {
  activeTabAtom,
  ensureDevicesAtom,
  errorMessageAtom,
  notifAllowedAtom,
  settingsAtom,
  startListeningAtom,
} from "./lib/store";
import { useAtomValue, useSetAtom } from "jotai";
import { Tabs } from "./components/Tabs";
import { Monitor } from "./components/Monitor";
import { SettingsTab } from "./components/Settings";

function App() {
  const settings = useAtomValue(settingsAtom);
  const setNotifAllowed = useSetAtom(notifAllowedAtom);
  const startListening = useSetAtom(startListeningAtom);
  const ensureDevices = useSetAtom(ensureDevicesAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const errorMessage = useAtomValue(errorMessageAtom);

  useEffect(() => {
    (async () => {
      const result = await invoke<boolean | null>(
        "plugin:notification|is_permission_granted",
      );
      if (result === true) {
        setNotifAllowed(true);
      } else {
        const perm = await invoke<string>(
          "plugin:notification|request_permission",
        );
        setNotifAllowed(perm === "granted");
      }
    })();
  }, [setNotifAllowed]);

  useEffect(() => {
    const ac = new AbortController();
    ensureDevices(ac.signal);
    return () => ac.abort();
  }, [ensureDevices]);

  useEffect(() => {
    startListening();
  }, [startListening]);

  useEffect(() => {
    invoke("set_threshold", { value: settings.threshold });
  }, [settings.threshold]);

  useEffect(() => {
    invoke("start_audio", { deviceName: settings.deviceId });
  }, [settings.deviceId]);

  return (
    <div className="w-90 max-w-full h-105 text-white">
      <div className="flex h-full flex-col overflow-hidden">
        <Tabs />
        <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-3 space-y-3">
          {activeTab === "monitor" && <Monitor />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
        {errorMessage && (
          <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-xl border border-rose-400/40 bg-rose-500/25 px-3 py-2 text-sm text-rose-50">
            <span>{errorMessage}</span>
            <button
              onClick={() =>
                invoke("start_audio", { deviceName: settings.deviceId })
              }
              className="shrink-0 font-semibold text-rose-200 hover:text-white"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
