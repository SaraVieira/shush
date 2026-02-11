import { useMemo } from "react";
import { currentDbAtom, settingsAtom, statusAtom } from "../lib/store";
import { useAtomValue } from "jotai";

export const Monitor = () => {
  const settings = useAtomValue(settingsAtom);
  const currentDb = useAtomValue(currentDbAtom);
  const status = useAtomValue(statusAtom);

  const loudnessRatio = useMemo(() => {
    if (currentDb == null) return 0;
    const ratio = currentDb / (settings.threshold + 20);
    return Math.min(Math.max(ratio, 0), 1);
  }, [currentDb, settings.threshold]);

  const needleAngle = -90 + loudnessRatio * 180;

  // Threshold tick position on the arc
  const thresholdRatio = settings.threshold / (settings.threshold + 20);
  const thresholdArc = Math.PI * (1 - thresholdRatio);
  const tickInner = 68;
  const tickOuter = 92;
  const tickX1 = 100 + tickInner * Math.cos(thresholdArc);
  const tickY1 = 100 - tickInner * Math.sin(thresholdArc);
  const tickX2 = 100 + tickOuter * Math.cos(thresholdArc);
  const tickY2 = 100 - tickOuter * Math.sin(thresholdArc);

  const statusText = useMemo(() => {
    if (status === "error") return "Microphone unavailable";
    if (currentDb != null && currentDb >= settings.threshold) return "Shush!";
    if (currentDb != null && currentDb >= settings.threshold - 5)
      return "Getting loud";
    return null;
  }, [status, currentDb, settings.threshold]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <svg viewBox="0 0 200 110" className="w-[260px]">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34C759" />
            <stop offset="55%" stopColor="#FF9F0A" />
            <stop offset="100%" stopColor="#FF3B30" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        {/* Gradient arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          stroke="url(#gauge-grad)"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        {/* Threshold tick */}
        <line
          x1={tickX1}
          y1={tickY1}
          x2={tickX2}
          y2={tickY2}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Needle */}
        <g
          className="gauge-needle"
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: "100px 100px",
          }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="28"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        {/* Center dot */}
        <circle cx="100" cy="100" r="6" fill="white" />
      </svg>
      <div className="text-[40px] font-bold leading-tight">
        {currentDb != null ? currentDb : "--"}{" "}
        <span className="text-base font-semibold opacity-70">dB</span>
      </div>
      <p className="min-h-[20px] text-sm text-white/60">{statusText}</p>
    </div>
  );
};
