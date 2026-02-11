import { useAtomValue, useSetAtom } from "jotai";
import {
  devicesAtom,
  settingsAtom,
  persistSettingsAtom,
} from "../../lib/store";

export const MicrophoneSettings = () => {
  const persistSettings = useSetAtom(persistSettingsAtom);
  const devices = useAtomValue(devicesAtom);
  const settings = useAtomValue(settingsAtom);

  const handleDeviceChange = (id: string) =>
    persistSettings({ ...settings, deviceId: id || null });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="mic" className="text-sm font-semibold text-white">
        Microphone
      </label>
      <select
        id="mic"
        className="w-full rounded-xl border border-white/20 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm
focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        value={settings.deviceId ?? ""}
        onChange={(e) => handleDeviceChange(e.target.value)}
      >
        <option value="">System default</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label || `Mic ${d.id.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </div>
  );
};
