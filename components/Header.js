"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const current = (href) => (pathname === href ? "page" : undefined);
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href="/">
          <span className="logo">CK</span>CKD Screening
        </Link>
        <nav aria-label="Main">
          <Link href="/" aria-current={current("/")}>About</Link>
          <Link className="cta" href="/check" aria-current={current("/check")}>Check CKD Model</Link>
        </nav>
      </div>
    </header>
  );
}
