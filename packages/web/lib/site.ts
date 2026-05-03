export const SITE_NAME = "ToolBox";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://toolbox-edge.pages.dev";
export const SITE_DESCRIPTION =
  "AI 驱动的智能工具工作台，基于 Cloudflare + Stripe + Git 的可维护工具平台。";

export function absoluteUrl(pathname: string): string {
  if (!pathname.startsWith("/")) return `${SITE_URL}/${pathname}`;
  return `${SITE_URL}${pathname}`;
}
