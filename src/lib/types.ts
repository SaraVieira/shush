export type AudioDevice = {
  id: string;
  label: string;
};

export type Settings = {
  deviceId: string | null;
  threshold: number; // dB
  autostart: boolean;
};
