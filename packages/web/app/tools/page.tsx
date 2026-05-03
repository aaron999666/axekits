import { CATEGORIES, API_BASE, type Tool } from "@/lib/config";
import ToolCard from "@/components/ToolCard";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "工具库",
  description: "浏览 ToolBox 全部在线工具，覆盖开发、图像、文档与日常计算场景。",
  alternates: {
    canonical: "/tools",
  },
};

async function getTools(category?: string): Promise<Tool[]> {
  try {
    const url = category
      ? `${API_BASE}/api/tools?category=${category}`
      : `${API_BASE}/api/tools`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = params.category;
  const tools = await getTools(category);

  return (
    <>
      <SiteHeader current="tools" />

      <main className="container" style={{ padding: "24px 20px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <Link
            href="/tools"
            className="btn btn-outline"
            style={{ fontSize: "13px", padding: "6px 14px" }}
          >
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              href={`/tools?category=${cat.id}`}
              key={cat.id}
              className="btn btn-outline"
              style={{
                fontSize: "13px",
                padding: "6px 14px",
                background: category === cat.id ? "var(--accent)" : undefined,
                color: category === cat.id ? "#fff" : undefined,
                borderColor: category === cat.id ? "var(--accent)" : undefined,
              }}
            >
              {cat.icon} {cat.name}
            </Link>
          ))}
        </div>

        {tools.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <p style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</p>
            <p>No tools found. Tools will appear after the first GitHub Actions scan.</p>
          </div>
        ) : (
          <>
            <div className="tools-grid">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "ItemList",
                  name: "ToolBox Tools",
                  numberOfItems: tools.length,
                  itemListElement: tools.map((tool, idx) => ({
                    "@type": "ListItem",
                    position: idx + 1,
                    url: absoluteUrl(`/tools/${tool.id}`),
                    name: tool.name_zh || tool.name,
                  })),
                }),
              }}
            />
          </>
        )}
      </main>
    </>
  );
}
