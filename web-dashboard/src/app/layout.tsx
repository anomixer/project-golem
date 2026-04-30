import type { Metadata } from "next";
import { ThemeProvider } from "../components/ThemeProvider";
import { I18nProvider } from "../components/I18nProvider";
import { OpsStyleProvider } from "../components/OpsStyleProvider";
import { ToastProvider } from "../components/ui/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Golem Dashboard",
  description: "Web Dashboard for Project Golem v9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider>
            <OpsStyleProvider>
              <ToastProvider>{children}</ToastProvider>
            </OpsStyleProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
