import { useAtom } from "jotai";
import { notifAllowedAtom } from "../../lib/store";
import { invoke } from "@tauri-apps/api/core";

export const NotificationSettings = () => {
  const [notifAllowed, setNotifAllowed] = useAtom(notifAllowedAtom);

  const sendTestNotification = async () => {
    const result = await invoke<boolean | null>(
      "plugin:notification|is_permission_granted",
    );
    if (result !== true) {
      const perm = await invoke<string>(
        "plugin:notification|request_permission",
      );
      const isGranted = perm === "granted";
      setNotifAllowed(isGranted);
      if (!isGranted) return;
    }
    setNotifAllowed(true);
    try {
      await invoke("plugin:notification|notify", {
        options: {
          title: "Shush",
          body: "Test notification from Shush.",
        },
      });
    } catch (err) {
      console.error("Test notification failed", err);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-white/80">
      <div>
        Notifications:{" "}
        {notifAllowed === null
          ? "checking…"
          : notifAllowed
            ? "allowed"
            : "blocked – enable in System Settings → Notifications."}
      </div>
      <button
        onClick={sendTestNotification}
        className="text-blue-200 font-semibold hover:text-blue-100"
      >
        Send test
      </button>
    </div>
  );
};
