export type RegisteredDevice = {
  deviceId: string;
  token: string;
};

export function isRegisteredDevice(value: unknown): value is RegisteredDevice {
  if (!value || typeof value !== "object") return false;
  const device = value as Partial<RegisteredDevice>;
  return (
    typeof device.deviceId === "string" && typeof device.token === "string"
  );
}

export function toEnrollmentCredentials(device: RegisteredDevice) {
  return {
    deviceId: device.deviceId,
    token: device.token,
  };
}
