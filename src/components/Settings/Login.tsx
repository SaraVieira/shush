import { useAtomValue, useSetAtom } from "jotai";
import { persistSettingsAtom, settingsAtom } from "../../lib/store";
import {
  enable as enableAutostart,
  disable as disableAutostart,
} from "@tauri-apps/plugin-autostart";

export const LoginSettings = () => {
  const persistSettings = useSetAtom(persistSettingsAtom);
  const settings = useAtomValue(settingsAtom);

  const handleAutostartToggle = async (next: boolean) => {
    if (next) await enableAutostart();
    else await disableAutostart();
    persistSettings({ ...settings, autostart: next });
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <label htmlFor="autostart" className="text-sm font-semibold text-white">
          Open at login
        </label>
      </div>
      <label className="switch">
        <input
          id="autostart"
          type="checkbox"
          checked={settings.autostart}
          onChange={(e) => handleAutostartToggle(e.target.checked)}
        />
        <span className="slider" />
      </label>
    </div>
  );
};
