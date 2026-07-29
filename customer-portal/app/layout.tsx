import type { Metadata } from "next";
import { Titillium_Web, Open_Sans } from "next/font/google";
import PwaProvider from "@/components/PwaProvider";
import SourceOffer from "@/components/SourceOffer";
import "./globals.css";

const titilliumWeb = Titillium_Web({
  variable: "--font-titillium-web",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FlyBox Delivery Portal",
  description: "Korisnički portal za FlyBox Delivery — pratite i upravljajte vašim isporukama",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlyBox",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr"
      className={`${titilliumWeb.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PwaProvider />
        {children}
        <SourceOffer />
      </body>
    </html>
  );
}
