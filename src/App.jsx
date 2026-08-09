import React, { useState, useEffect } from "react";
import SearchBar from "./components/SearchBar";
import ProductGrid from "./components/ProductGrid";
import LoadingSkeleton from "./components/LoadingSkeleton";
import FeedbackSection from "./components/FeedbackSection";
import Footer from "./components/Footer";
import { searchProductsWithAI } from "./services/aiService";
import { FALLBACK_PRODUCTS } from "./data/fallbackProducts";

export default function App() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState("Real-Time Viral Trending Products");
  const [searchedQuery, setSearchedQuery] = useState("");

  // Fetch live trending products from Google Search AI on initial page load
  useEffect(() => {
    let isMounted = true;

    async function loadTrendingOnOpen() {
      setIsLoading(true);
      try {
        const liveTrending = await searchProductsWithAI({ isInitialLoad: true });
        if (isMounted) {
          if (liveTrending && liveTrending.length > 0) {
            setProducts(liveTrending);
          } else {
            setProducts(FALLBACK_PRODUCTS);
          }
        }
      } catch (error) {
        console.error("Failed to load live trending items:", error);
        if (isMounted) setProducts(FALLBACK_PRODUCTS);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadTrendingOnOpen();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = async (searchData) => {
    setIsLoading(true);
    const queryName = searchData.text || (searchData.image ? "Image Search" : "Search");
    setSearchedQuery(searchData.text || queryName);
    setSearchTitle(`Results for "${queryName}"`);

    try {
      const results = await searchProductsWithAI({
        text: searchData.text,
        image: searchData.image,
      });
      // Show actual results returned (which will be empty array [] when not available)
      setProducts(results);
    } catch (error) {
      console.error("Search error:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Top Brand Header */}
      <header className="w-full border-b border-neutral-900 bg-black/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
              Global Fit <span className="text-cyan-400">AI</span>
            </span>
          </div>
          <button
            onClick={() => {
              document.getElementById("feedback-section")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/50 text-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Give Feedback
          </button>
        </div>
      </header>

      <main className="grow px-3 sm:px-6">
        <section className="pt-6 sm:pt-10 pb-4 sm:pb-6 text-center max-w-2xl mx-auto relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-[11px] sm:text-xs font-medium mb-3 shadow-sm max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="truncate">Global Fit AI — Find Outfits & Products Worldwide</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-1.5 px-1">
            International Shopping,{" "}
            <span className="text-cyan-400">Delivered Worldwide.</span>
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md mx-auto font-normal">
            From photo to cart in seconds. Smart visual search for your style.
          </p>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </section>

        <section className="pb-8 max-w-6xl mx-auto">
          {isLoading ? (
            <LoadingSkeleton count={6} />
          ) : (
            <ProductGrid
              products={products}
              title={searchTitle}
              searchedQuery={searchedQuery}
            />
          )}
        </section>

        <FeedbackSection />
      </main>
      <Footer />
    </div>
  );
}
