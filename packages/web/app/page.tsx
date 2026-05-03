import { CATEGORIES } from "@/lib/config";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "首页",
  description: "在线使用开发、图像、文档、计算工具，支持 AI 工作流编排与积分计费。",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader current="home" />

      <section className="hero">
        <h1>AI 驱动的智能工具工作台</h1>
        <p>
          一键在线使用 30+ 开发工具。AI 自动编排工作流，让工具链组合从未如此简单。
        </p>
        <div className="hero-input">
          <input type="text" placeholder="描述你想做的事情... (e.g. 压缩图片并加水印)" />
          <button className="btn">AI 编排 ✨</button>
        </div>
      </section>

      <section className="categories container">
        <h2>工具分类</h2>
        <div className="cat-grid">
          {CATEGORIES.map((cat) => (
            <Link href={`/tools?category=${cat.id}`} key={cat.id} className="cat-card">
              <div className="icon">{cat.icon}</div>
              <h3>{cat.name}</h3>
              <p>{cat.nameEn}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container" style={{ paddingBottom: "56px" }}>
        <h2 style={{ marginBottom: "12px" }}>常见问题</h2>
        <div className="cat-grid">
          <article className="cat-card">
            <h3>是否需要安装软件？</h3>
            <p>不需要。工具可直接在线运行，重点场景支持浏览器本地处理。</p>
          </article>
          <article className="cat-card">
            <h3>如何计费？</h3>
            <p>免费用户每天可使用 5 次，更多用量通过 Stripe 购买积分包。</p>
          </article>
          <article className="cat-card">
            <h3>数据如何保护？</h3>
            <p>鉴权与计费运行于 Cloudflare Workers，关键请求经安全头与边缘策略保护。</p>
          </article>
        </div>
      </section>

      <footer className="footer">
        <p>© 2026 ToolBox — Powered by Cloudflare Edge + AI</p>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "是否需要安装软件？",
                acceptedAnswer: { "@type": "Answer", text: "不需要，工具可直接在线运行。" },
              },
              {
                "@type": "Question",
                name: "如何计费？",
                acceptedAnswer: { "@type": "Answer", text: "免费每天 5 次，额外使用通过 Stripe 购买积分。" },
              },
            ],
            isPartOf: absoluteUrl("/"),
          }),
        }}
      />
    </>
  );
}
