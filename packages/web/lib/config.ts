export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE ||
  "http://127.0.0.1:8787";
export const TOOLS_DOMAIN = process.env.NEXT_PUBLIC_TOOLS_DOMAIN || "t.your-domain.com";

export const CATEGORIES = [
  { id: "dev-assistant", name: "开发助手", nameEn: "Dev Assistant", icon: "💻" },
  { id: "image-visual", name: "图像视觉", nameEn: "Image & Visual", icon: "🖼️" },
  { id: "document-convert", name: "文档转换", nameEn: "Document Convert", icon: "📄" },
  { id: "daily-calc", name: "日常计算", nameEn: "Daily Calc", icon: "🧮" },
] as const;

export interface Tool {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  category: string;
  tags: string[];
  points_cost: number;
  self_hosted: boolean;
  health_status: string;
  demo_url?: string;
}

export interface UserInfo {
  balance: number;
  tier: string;
  free_remaining: number;
}
