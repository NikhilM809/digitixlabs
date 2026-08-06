import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Digitix HRMS - Employee Leave & Attendance Management",
  description: "Modern Employee Leave & Attendance Management System by Digitix Labs",
  icons: {
    icon: "/digitix-logo.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
