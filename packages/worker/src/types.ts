export interface Env {
  DB: D1Database;
  AUTH_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  R2: R2Bucket;
  BILLING_QUEUE: Queue;
  CLEANUP_QUEUE: Queue;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  APP_ORIGIN: string;
  JWT_EXPIRY_SECONDS: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_BASIC: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_PACK_100: string;
  FREE_DAILY_LIMIT: string;
  R2_FILE_TTL_SECONDS: string;
  MAX_FILE_SIZE_BYTES: string;
  TURNSTILE_SECRET: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  GEMINI_API_KEY?: string;
  MIMO_API_KEY?: string;
  MIMO_API_BASE?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_API_BASE?: string;
  AI_PROVIDER_ORDER?: string;
  CF_AI_MODEL?: string;
  GEMINI_MODEL?: string;
  MIMO_MODEL?: string;
  DEEPSEEK_MODEL?: string;
  ADMIN_BOOTSTRAP_KEY?: string;
  TURNSTILE_ENFORCE?: string;
  TOOLS_DOMAIN: string;
  TOOLS_DATA_URL: string;
  WORKFLOWS_DATA_URL: string;
  ANALYTICS?: AnalyticsEngineDataset;
}

export interface JWTPayload {
  sub: string;
  email: string;
  points: number;
  tier: string;
  jti: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface ToolMeta {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  category: string;
  tags: string[];
  demo_url: string;
  repo_url: string;
  stars: number;
  points_cost: number;
  health_status: "healthy" | "degraded" | "down" | "unknown";
  last_checked: string;
  self_hosted: boolean;
  tool_type: "html" | "wasm" | "worker";
}

export interface BillingMessage {
  userId: string;
  toolId: string;
  pointsCost: number;
  type: "consumption";
  timestamp: number;
}

export interface CleanupMessage {
  keys: string[];
}

export interface ParsedIntent {
  steps: { tool: string; input: string; params?: Record<string, unknown> }[];
  total_points: number;
  confidence: number;
  provider?: string;
}
