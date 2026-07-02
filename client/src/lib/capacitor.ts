import { Capacitor } from "@capacitor/core";

export function isCapacitorNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function isAndroidNative(): boolean {
  return isCapacitorNative() && Capacitor.getPlatform() === "android";
}
