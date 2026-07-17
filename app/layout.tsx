import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrantPilot AI",
  description: "Policy & Grant Navigator demo for Vietnamese SMEs and innovation startups"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
