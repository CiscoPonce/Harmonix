import type { Metadata, Viewport } from "next";
import "./watch.css";

export const metadata: Metadata = {
  title: "Harmonix Watch",
  description: "Daily word preview for Wear OS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="watch-root min-h-[100dvh] bg-black text-white overflow-x-hidden overflow-y-auto">
      {children}
    </div>
  );
}
