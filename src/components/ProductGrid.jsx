import React, { useState, useEffect } from "react";
import ProductCard from "./ProductCard";

const STORE_OPTIONS = [
  { id: "ALL", name: "All Stores" },
  { id: "SHEIN", name: "SHEIN" },
  { id: "Temu", name: "Temu" },
  { id: "AliExpress", name: "AliExpress" },
  { id: "eBay", name: "eBay" },
  { id: "Amazon", name: "Amazon" },
  { id: "ASOS", name: "ASOS" },
];

function buildStoreUrl(merchant, searchQuery) {
  const rawQ = (searchQuery || "product").trim();
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

export default function ProductGrid({
  products = [],
  title = "Trending Deals",
  searchedQuery = "",
}) {
  const [selectedMerchant, setSelectedMerchant] = useState("ALL");

  // Reset filter when a new query search comes in
  useEffect(() => {
    setSelectedMerchant("ALL");
  }, [searchedQuery, products]);

  if (!products || products.length === 0) {
    return (
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 sm:p-10 text-center my-4 max-w-xl mx-auto backdrop-blur-sm shadow-xl">
        <div className="w-12 h-12 bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-cyan-950/40">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l4-4m0 4l-4-4" />
          </svg>
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5">
          Product Not Available
        </h3>

        <p className="text-neutral-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
          {searchedQuery
            ? `No matching items found for "${searchedQuery}". The product may be unavailable or out of stock.`
            : "No matching items available. Try searching for a specific product or upload an image."}
        </p>
      </div>
    );
  }

  // Filter or retarget products based on selected store preference
  let displayedProducts = products;

  if (selectedMerchant !== "ALL") {
    const matchingProducts = products.filter(
      (p) => p.merchant && p.merchant.toLowerCase() === selectedMerchant.toLowerCase()
    );

    // If items matching the merchant exist, use them. Otherwise, adapt the outfit products for the selected merchant!
    if (matchingProducts.length >= 2) {
      displayedProducts = matchingProducts;
    } else {
      displayedProducts = products.map((item) => ({
        ...item,
        merchant: selectedMerchant,
        productUrl: buildStoreUrl(selectedMerchant, item.title || searchedQuery),
      }));
    }
  }

  return (
    <div className="w-full">
      {/* Compact Store Preference Bar with Horizontal Sliding */}
      <div className="mb-4 sm:mb-6 bg-neutral-900/90 border border-neutral-800 rounded-xl p-2.5 sm:p-4 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="text-cyan-400 font-bold text-xs uppercase tracking-wider truncate">
              Prefer to buy from:
            </span>
          </div>
          <span className="text-neutral-400 text-[11px] shrink-0">
            {selectedMerchant === "ALL" ? "All stores" : selectedMerchant}
          </span>
        </div>

        {/* Interactive Horizontal Sliding Store Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 whitespace-nowrap">
          {STORE_OPTIONS.map((store) => {
            const isActive = selectedMerchant === store.id;
            return (
              <button
                key={store.id}
                onClick={() => setSelectedMerchant(store.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                  isActive
                    ? "bg-cyan-500 text-black border-cyan-400 shadow-sm font-bold"
                    : "bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 border-neutral-700/60"
                }`}
              >
                {store.name}
              </button>
            );
          })}
        </div>
      </div>

      {title && (
        <h2 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2 px-0.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          {title} {selectedMerchant !== "ALL" ? `(${selectedMerchant})` : ""}
        </h2>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
        {displayedProducts.map((item, index) => (
          <ProductCard key={item.id || index} product={item} />
        ))}
      </div>
    </div>
  );
}

