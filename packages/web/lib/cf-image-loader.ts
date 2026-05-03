export default function cloudflareLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (src.startsWith("/")) return src;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://toolbox-edge.pages.dev";
  const normalized = siteUrl.replace(/\/+$/, "");
  const params = [`width=${width}`, `quality=${quality || 75}`, "format=auto"];
  return `${normalized}/cdn-cgi/image/${params.join(",")}/${src}`;
}
