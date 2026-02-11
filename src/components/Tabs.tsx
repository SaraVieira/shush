import { useAtom } from "jotai";
import { activeTabAtom } from "../lib/store";

export const Tabs = () => {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  return (
    <div className="px-3 pt-3 mb-3">
      <div
        className="inline-flex rounded-full bg-white/12 p-1 text-sm font-medium text-white/85 border border-white/10
shadow-inner"
      >
        <button
          className={`px-3 py-1 rounded-full transition ${
            activeTab === "monitor"
              ? "bg-white/90 text-slate-900 shadow border border-white/20"
              : "text-white/80"
          }`}
          onClick={() => setActiveTab("monitor")}
        >
          Monitor
        </button>
        <button
          className={`px-3 py-1 rounded-full transition ${
            activeTab === "settings"
              ? "bg-white/90 text-slate-900 shadow border border-white/20"
              : "text-white/80"
          }`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>
    </div>
  );
};
