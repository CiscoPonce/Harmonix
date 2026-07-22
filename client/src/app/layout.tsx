import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CapacitorShell } from "@/components/CapacitorShell";
import { AuthProvider } from "@/context/AuthContext";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Harmonix — Learn Words Through Music",
  description:
    "Master vocabulary with every beat. Unlock language through rhythm and melody. Turn your favorite songs into powerful learning tools.",
  applicationName: "Harmonix",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Harmonix — Learn Words Through Music",
    description: "AI-first language learning through real music lyrics.",
    images: [{ url: "/logo.png", width: 1024, height: 558, alt: "Harmonix" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B4D2E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <CapacitorShell>
            <AuthProvider>{children}</AuthProvider>
          </CapacitorShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
