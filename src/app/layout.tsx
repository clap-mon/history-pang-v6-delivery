import type { Metadata } from "next";
import "./globals.css";
import "./tasks-v3.css";
import "./chalkboard.css";
import { GAME } from "@/lib/game-config";

export const metadata: Metadata = {
  title: GAME.title,
  description: GAME.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
