import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "curlbrew. — The Listening Room", description: "A little room for music." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
