"use client";

import { type Tool } from "@/lib/config";
import Link from "next/link";

export default function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link href={`/tools/${tool.id}`} className="tool-card">
      <h4>{tool.name_zh || tool.name}</h4>
      <p>{tool.description_zh || tool.description}</p>
      <div className="meta">
        <span className="cost">{tool.points_cost} pts</span>
        <span className="tag">{tool.category}</span>
      </div>
    </Link>
  );
}
