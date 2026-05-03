import Link from "next/link";

interface SiteHeaderProps {
  current?: "home" | "tools" | "pricing";
}

export default function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="header">
      <div className="container">
        <Link href="/" className="logo">ToolBox</Link>
        <nav className="nav">
          <Link href="/tools" aria-current={current === "tools" ? "page" : undefined}>All Tools</Link>
          <Link href="/pricing" aria-current={current === "pricing" ? "page" : undefined}>Pricing</Link>
        </nav>
        <button className="search-trigger" type="button">
          Search... <kbd>Ctrl K</kbd>
        </button>
        <div className="user-area">
          <span className="points-badge">0 pts</span>
          <Link href="/account" className="btn btn-outline">Account</Link>
        </div>
      </div>
    </header>
  );
}
