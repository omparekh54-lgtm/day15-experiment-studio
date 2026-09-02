import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experiment Studio",
  description: "Design, diagnose, and analyze product experiments without overstating the evidence."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
