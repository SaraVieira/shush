import { NotificationSettings } from "./Notification";
import { MicrophoneSettings } from "./Microphone";
import { ThresholdSettings } from "./Threshold";
import { LoginSettings } from "./Login";

export const SettingsTab = () => {
  return (
    <>
      <div className="grid gap-4 rounded-xl border border-white/15 bg-white/10 px-3 py-3">
        <MicrophoneSettings />
        <ThresholdSettings />
        <LoginSettings />

        <NotificationSettings />
      </div>
    </>
  );
};
