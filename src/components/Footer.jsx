import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
      <p>© {new Date().getFullYear()} Global Fit AI. All rights reserved.</p>
    </footer>
  );
}
