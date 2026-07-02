"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

export function CapacitorShell({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    root.classList.add("capacitor-native");
    if (Capacitor.getPlatform() === "android") {
      root.classList.add("capacitor-android");
    }

    setTheme("dark");

    (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });
        await StatusBar.setOverlaysWebView({ overlay: true });
      } catch {
        /* unavailable outside native shell */
      }
      try {
        await SplashScreen.hide();
      } catch {
        /* ignore */
      }
    })();
  }, [setTheme]);

  return <>{children}</>;
}
