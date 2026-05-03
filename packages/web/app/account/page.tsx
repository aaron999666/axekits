"use client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { API_BASE } from "@/lib/config";

interface MePayload {
  id: string;
  email: string;
  balance: number;
  tier: string;
  free_remaining: number;
}

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [me, setMe] = useState<MePayload | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function api(path: string, method: string, body?: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }

  async function register() {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      await api("/api/auth/register", "POST", { email: email.trim() });
      setMessage("注册成功，已自动登录。");
      await loadMe();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    if (!email.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      await api("/api/auth/login", "POST", { email: email.trim() });
      setMessage("登录成功。");
      await loadMe();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMe() {
    setLoading(true);
    setMessage("");
    try {
      const payload = (await api("/api/auth/me", "GET")) as MePayload;
      setMe(payload);
      setMessage("会员信息已刷新。");
    } catch (e) {
      setMe(null);
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setMessage("");
    try {
      await api("/api/auth/logout", "POST");
      setMe(null);
      setMessage("已退出登录。");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="container" style={{ padding: "32px 20px" }}>
        <h1 style={{ marginBottom: "12px" }}>会员中心</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
          注册/登录后可查看积分余额、免费次数和会员等级。
        </p>

        <div className="cat-card" style={{ maxWidth: "640px", marginBottom: "20px" }}>
          <h3 style={{ marginBottom: "10px" }}>注册与登录</h3>
          <div className="hero-input" style={{ margin: 0, maxWidth: "100%" }}>
            <input
              type="email"
              placeholder="输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn" type="button" onClick={register} disabled={loading}>注册</button>
            <button className="btn btn-outline" type="button" onClick={login} disabled={loading}>登录</button>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" type="button" onClick={loadMe} disabled={loading}>刷新会员信息</button>
            <button className="btn btn-outline" type="button" onClick={logout} disabled={loading}>退出</button>
          </div>
          {message ? <p style={{ marginTop: "12px", color: "var(--text-muted)" }}>{message}</p> : null}
        </div>

        <div className="cat-card" style={{ maxWidth: "640px" }}>
          <h3 style={{ marginBottom: "10px" }}>会员信息</h3>
          {!me ? (
            <p style={{ color: "var(--text-muted)" }}>未登录或信息未加载。</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              <p><strong>用户ID：</strong>{me.id}</p>
              <p><strong>邮箱：</strong>{me.email}</p>
              <p><strong>会员等级：</strong>{me.tier}</p>
              <p><strong>积分余额：</strong>{me.balance}</p>
              <p><strong>今日免费次数剩余：</strong>{me.free_remaining}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
