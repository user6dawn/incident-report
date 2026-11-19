import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Campus Incident Management System",
  description: "Report, track and manage incidents at Bingham University",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  );
}
