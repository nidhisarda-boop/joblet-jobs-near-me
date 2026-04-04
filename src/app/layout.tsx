import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobs Near Me | Joblet.ai",
  description: "Find jobs within your radius. Enter your ZIP code, choose a distance, and see the closest opportunities sorted by proximity.",
  openGraph: {
    title: "Jobs Near Me | Joblet.ai",
    description: "Find jobs within your radius. ZIP code search, GPS, distance badges.",
    url: "https://joblet.ai",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
