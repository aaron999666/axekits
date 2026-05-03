"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Fuse from "fuse.js";
import { type Tool } from "@/lib/config";

interface SearchDialogProps {
  tools: Tool[];
  onSelect: (toolId: string) => void;
}

export default function SearchDialog({ tools, onSelect }: SearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(tools, {
        keys: [
          { name: "name", weight: 2 },
          { name: "name_zh", weight: 2 },
          { name: "description", weight: 1 },
          { name: "description_zh", weight: 1 },
          { name: "tags", weight: 1.5 },
          { name: "category", weight: 0.5 },
        ],
        threshold: 0.3,
        includeScore: true,
      }),
    [tools]
  );

  const results = useMemo(
    () => (query ? fuse.search(query).slice(0, 8) : tools.slice(0, 8)),
    [fuse, query, tools]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "20vh" }}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)} />
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "560px", background: "var(--bg-card)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools..."
          style={{ width: "100%", padding: "16px 20px", fontSize: "18px", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
          autoFocus
        />
        <ul style={{ listStyle: "none", maxHeight: "320px", overflowY: "auto" }}>
          {results.map((r) => {
            const tool = "item" in r ? r.item : r;
            return (
              <li key={tool.id}>
                <button
                  style={{ width: "100%", padding: "12px 20px", textAlign: "left", background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}
                  onClick={() => { onSelect(tool.id); setOpen(false); setQuery(""); }}
                >
                  <span style={{ fontWeight: 600 }}>{tool.name_zh || tool.name}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{tool.category}</span>
                  <span style={{ marginLeft: "auto", color: "var(--success)", fontSize: "12px" }}>{tool.points_cost}pts</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
