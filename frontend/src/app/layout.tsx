import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conduit",
  description: "Autonomous data engineering framework",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://rsms.me/"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        {/* Demo mode banner */}
        <div
          style={{
            background: "linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
            color: "#c7d2fe",
            textAlign: "center",
            padding: "6px 16px",
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.03em",
            borderBottom: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          🧪 Demo Mode — Running on mock data ·{" "}
          <a
            href="https://github.com/adityaatre26/Conduit"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#a5b4fc", textDecoration: "underline" }}
          >
            View source on GitHub
          </a>
        </div>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
