import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./nprogress.css";

export const metadata: Metadata = {
  title: "MedWise | POS",
  description: "MedWise | POS",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");

  console.log(isLocalhost);

  return (
    <html lang="en">
      <body className="bg-gray-200 dark:bg-[#191919]" suppressHydrationWarning>
        {/* {isLocalhost ? children : <Maintenance />} */}
        {children}
      </body>
    </html>
  );
}
