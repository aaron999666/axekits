import Link from "next/link";
import { API_BASE, CATEGORIES, TOOLS_BASE_PATH, type Tool } from "@/lib/config";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

async function getTool(id: string): Promise<Tool | null> {
  try {
    const res = await fetch(`${API_BASE}/api/tools`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const tools = (await res.json()) as Tool[];
    return tools.find((tool) => tool.id === id) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tool = await getTool(id);
  if (!tool) {
    return {
      title: "工具不存在",
      description: "请求的工具不存在或已下线。",
    };
  }

  const title = tool.name_zh || tool.name;
  const description = tool.description_zh || tool.description;
  return {
    title,
    description,
    alternates: {
      canonical: `/tools/${tool.id}`,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/tools/${tool.id}`),
      type: "website",
    },
  };
}

export default async function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tool = await getTool(id);

  if (!tool) {
    return (
      <main className="container" style={{ padding: "40px 20px", textAlign: "center" }}>
        <p>Tool not found</p>
        <Link href="/tools" className="btn" style={{ marginTop: "16px", display: "inline-block" }}>
          Back to Tools
        </Link>
      </main>
    );
  }

  const toolUrl = tool.self_hosted
    ? `${TOOLS_BASE_PATH}/${tool.category}/${tool.id}/`
    : tool.demo_url || "";

  return (
    <main className="tool-page container">
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/tools" style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          ← Back
        </Link>
        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          {CATEGORIES.find((c) => c.id === tool.category)?.icon} {tool.category}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--success)", fontSize: "13px" }}>
          {tool.points_cost} pts
        </span>
      </div>
      <div className="tool-frame-container">
        <iframe
          src={toolUrl}
          sandbox="allow-scripts allow-forms allow-same-origin"
          title={tool.name}
        />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: tool.name_zh || tool.name,
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: `${tool.points_cost}`,
              priceCurrency: "POINTS",
            },
            description: tool.description_zh || tool.description,
            url: absoluteUrl(`/tools/${tool.id}`),
          }),
        }}
      />
    </main>
  );
}
