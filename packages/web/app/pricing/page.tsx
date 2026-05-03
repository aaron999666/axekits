import SiteHeader from "@/components/SiteHeader";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "定价",
  description: "ToolBox 积分定价：免费层 + Basic + Pro + 按需积分包，面向轻量到高频使用场景。",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader current="pricing" />

      <section className="pricing">
        <h2>Simple, Usage-Based Pricing</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "40px" }}>
          Pay only for what you use. Free tier: 5 tool uses per day.
        </p>
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Free</h3>
            <div className="price">$0<span>/mo</span></div>
            <ul>
              <li>5 tool uses per day</li>
              <li>AI intent recognition</li>
              <li>Basic tools included</li>
              <li>Community support</li>
            </ul>
            <button className="btn btn-outline" style={{ width: "100%" }}>Get Started</button>
          </div>
          <div className="pricing-card featured">
            <h3>Basic</h3>
            <div className="price">$4.99<span>/mo</span></div>
            <ul>
              <li>500 points per month</li>
              <li>All tools unlocked</li>
              <li>AI workflow orchestration</li>
              <li>Priority support</li>
            </ul>
            <button className="btn" style={{ width: "100%" }}>Subscribe</button>
          </div>
          <div className="pricing-card">
            <h3>Pro</h3>
            <div className="price">$14.99<span>/mo</span></div>
            <ul>
              <li>2000 points per month</li>
              <li>Unlimited AI workflows</li>
              <li>API access</li>
              <li>Priority queue</li>
            </ul>
            <button className="btn btn-outline" style={{ width: "100%" }}>Subscribe</button>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", marginTop: "24px", fontSize: "13px" }}>
          Also available: $1.99 = 100 points (never expires)
        </p>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "OfferCatalog",
            name: `${SITE_NAME} Pricing`,
            itemListElement: [
              { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
              { "@type": "Offer", name: "Basic", price: "4.99", priceCurrency: "USD" },
              { "@type": "Offer", name: "Pro", price: "14.99", priceCurrency: "USD" },
              { "@type": "Offer", name: "Pack 100", price: "1.99", priceCurrency: "USD" },
            ],
          }),
        }}
      />
    </>
  );
}
