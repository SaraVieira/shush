import { useAtomValue, useSetAtom } from "jotai";
import { persistSettingsAtom, settingsAtom } from "../../lib/store";

export const ThresholdSettings = () => {
  const persistSettings = useSetAtom(persistSettingsAtom);
  const settings = useAtomValue(settingsAtom);

  const handleThresholdChange = (value: number) => {
    const next = { ...settings, threshold: value };
    persistSettings(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="threshold" className="text-sm font-semibold text-white">
        Loudness threshold ({settings.threshold} dB)
      </label>
      <input
        id="threshold"
        type="range"
        min={50}
        max={85}
        step={1}
        value={settings.threshold}
        onChange={(e) => handleThresholdChange(Number(e.target.value))}
        className="accent-blue-500"
      />
      <div className="flex justify-between text-[11px] text-white/60">
        <span>Quiet</span>
        <span>Normal</span>
        <span>Shout</span>
      </div>
    </div>
  );
};
