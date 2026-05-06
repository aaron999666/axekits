import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-8YP4P171C8";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | AI 工具工作台`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | AI 工具工作台`,
    description: SITE_DESCRIPTION,
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | AI 工具工作台`,
    description: SITE_DESCRIPTION,
  },
  category: "technology",
  keywords: [
    "AI工具",
    "在线工具箱",
    "开发者工具",
    "Cloudflare Workers",
    "Stripe 积分支付",
    "GitOps",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        {children}
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { anonymize_ip: true });
              `}
            </Script>
          </>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL,
              inLanguage: "zh-CN",
              description: SITE_DESCRIPTION,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/tools?query={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
