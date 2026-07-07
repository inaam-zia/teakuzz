import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { DM_Sans, Inter, Poppins, Lora } from "next/font/google";
import "./globals.css";
import BrandingStyles from "@/components/branding-styles";
import { getBranding } from "@/lib/branding";
import { themeToCssVars } from "@/lib/branding-types";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: branding.appName,
    description: branding.tagline,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getBranding();

  const themeStyle = themeToCssVars(branding.theme) as CSSProperties;

  return (
    <html lang="en" style={themeStyle}>
      <body className={`${dmSans.variable} ${inter.variable} ${poppins.variable} ${lora.variable}`}>
        <BrandingStyles branding={branding} />
        {children}
      </body>
    </html>
  );
}
