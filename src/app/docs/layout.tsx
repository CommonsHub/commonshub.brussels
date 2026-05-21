import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation — Commons Hub Brussels",
  description: "Documentation for Commons Hub Brussels.",
};

type NavItem =
  | { href: string; label: string; children?: never }
  | { href?: never; label: string; children: Array<{ href: string; label: string }> };

const navItems: NavItem[] = [
  { href: "/docs", label: "Overview" },
];

function Sidebar() {
  return (
    <nav className="w-64 shrink-0 hidden lg:block">
      <div className="sticky top-20 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 px-3">
          Documentation
        </p>
        {navItems.map((item, i) => {
          if ("children" in item && item.children) {
            return (
              <div key={i} className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1 px-3">
                  {item.label}
                </p>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="block px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href!}
              className="block px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MobileNav() {
  return (
    <div className="lg:hidden mb-8 border-b border-neutral-200 pb-4">
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700 flex items-center gap-2">
          <svg
            className="w-4 h-4 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          Navigation
        </summary>
        <div className="mt-2 ml-6 space-y-1">
          {navItems.map((item, i) => {
            if ("children" in item && item.children) {
              return (
                <div key={i} className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                    {item.label}
                  </p>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block py-1 text-sm text-neutral-600 hover:text-neutral-900"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href!}
                className="block py-1 text-sm text-neutral-600 hover:text-neutral-900"
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </details>
    </div>
  );
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex gap-12">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <MobileNav />
          <article className="docs-prose max-w-none">
            {children}
          </article>
        </div>
      </div>
    </div>
  );
}
