import React from "react";

function getFallbackStoreUrl(merchant, query) {
  const rawQ = (query || "product").trim();
  const q = encodeURIComponent(rawQ);
  const qAmazon = encodeURIComponent(rawQ.replace(/\s+/g, "+"));
  const m = (merchant || "AliExpress").toLowerCase();
  if (m.includes("temu")) return `https://www.temu.com/search_result.html?search_key=${q}`;
  if (m.includes("shein")) return `https://www.shein.com/pdsearch/${q}/`;
  if (m.includes("ebay")) return `https://www.ebay.com/sch/i.html?_nkw=${q}`;
  if (m.includes("amazon")) return `https://www.amazon.com/s?k=${qAmazon}`;
  if (m.includes("asos")) return `https://www.asos.com/search/?q=${q}`;
  return `https://www.aliexpress.com/wholesale?SearchText=${q}`;
}

export default function ProductCard({ product }) {
  if (!product) return null;

  const merchantName = product.merchant || "AliExpress";
  const targetUrl =
    product.productUrl && product.productUrl.startsWith("http")
      ? product.productUrl
      : getFallbackStoreUrl(merchantName, product.title);

  const badgeText = product.shippingBadge || "Ships Worldwide";

  return (
    <a
      href={targetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-950/30 transition-all flex flex-col group cursor-pointer"
    >
      {/* Icon Header Container */}
      <div className="h-32 sm:h-40 w-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border-b border-neutral-800/80 p-2.5 sm:p-3 relative flex flex-col justify-between overflow-hidden">
        {/* Ambient Glow Background Effect */}
        <div className="absolute inset-0 bg-radial from-cyan-500/5 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Top Badges */}
        <div className="flex items-center justify-between w-full z-10 gap-1">
          <span className="bg-neutral-800/90 border border-neutral-700/80 text-neutral-200 text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-md backdrop-blur-md shadow-sm truncate">
            {merchantName}
          </span>
          <span className="bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full backdrop-blur-md shrink-0">
            {badgeText}
          </span>
        </div>

        {/* Centered Shopping Icon */}
        <div className="my-auto flex items-center justify-center z-10">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:border-cyan-400 group-hover:bg-cyan-950/90 group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all duration-300">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
        </div>

        {/* Store Indicator Footnote */}
        <div className="text-center z-10">
          <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium tracking-wide uppercase group-hover:text-cyan-400 transition-colors">
            {merchantName} Store
          </span>
        </div>
      </div>

      {/* Content Container */}
      <div className="p-3 sm:p-4 flex flex-col grow justify-between bg-neutral-900">
        <div>
          <h3 className="font-semibold text-xs sm:text-sm text-neutral-100 line-clamp-2 mb-1.5 group-hover:text-cyan-300 transition-colors leading-snug">
            {product.title}
          </h3>
          <div className="flex items-center justify-between gap-1 mb-2.5 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] sm:text-[11px] font-medium text-neutral-400">Est.</span>
              <p className="text-cyan-400 font-bold text-sm sm:text-base">
                {product.price || "Check Store"}
              </p>
            </div>
            <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium bg-neutral-800/80 px-1.5 py-0.5 rounded border border-neutral-700/60 whitespace-nowrap">
              Prices may vary
            </span>
          </div>
        </div>

        <div>
          <div className="w-full py-2 sm:py-2.5 bg-cyan-500 group-hover:bg-cyan-400 text-black font-bold text-[11px] sm:text-xs rounded-lg text-center transition-colors flex items-center justify-center gap-1 shadow-sm">
            <span>View on {merchantName}</span>
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </div>

          <p className="text-[9px] sm:text-[10px] text-neutral-400 text-center mt-1 font-medium">
            Log in to {merchantName} account from website
          </p>
        </div>
      </div>
    </a>
  );
}
