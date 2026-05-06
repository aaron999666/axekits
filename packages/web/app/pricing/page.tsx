import SiteHeader from "@/components/SiteHeader";
import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "定价",
  description: "ToolBox 两档充值：¥50=600积分，¥100=1400积分；免费层每日5次。",
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
            <h3>Recharge 50</h3>
            <div className="price">¥50<span>/once</span></div>
            <ul>
              <li>600 points</li>
              <li>All tools unlocked</li>
              <li>AI workflow orchestration</li>
              <li>Priority support</li>
            </ul>
            <button className="btn" style={{ width: "100%" }}>Buy 600 Points</button>
          </div>
          <div className="pricing-card">
            <h3>Recharge 100</h3>
            <div className="price">¥100<span>/once</span></div>
            <ul>
              <li>1400 points</li>
              <li>Unlimited AI workflows</li>
              <li>API access</li>
              <li>Priority queue</li>
            </ul>
            <button className="btn btn-outline" style={{ width: "100%" }}>Buy 1400 Points</button>
          </div>
        </div>
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
              { "@type": "Offer", name: "Recharge 50", price: "50", priceCurrency: "CNY" },
              { "@type": "Offer", name: "Recharge 100", price: "100", priceCurrency: "CNY" },
            ],
          }),
        }}
      />
    </>
  );
}
