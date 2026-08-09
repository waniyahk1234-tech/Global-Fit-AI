import React, { useState, useRef } from "react";

const SUGGESTIONS = [
  { label: "skincare", query: "skincare" },
  { label: "toys", query: "toys" },
  { label: "shoes", query: "shoes" },
  { label: "tops", query: "tops" },
  { label: "vest", query: "vest" },
  { label: "accessories", query: "accessories" },
  { label: "headphones", query: "headphones" },
  { label: "hoodies", query: "hoodies" },
];

export default function SearchBar({ onSearch, isLoading }) {
  const [textQuery, setTextQuery] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      if (onSearch) {
        onSearch({ text: textQuery, image: file });
      }
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fileToUse = imageFile || fileInputRef.current?.files[0] || null;
    if (!textQuery.trim() && !fileToUse) return;
    if (onSearch) {
      onSearch({
        text: textQuery,
        image: fileToUse,
      });
    }
  };

  const handleTagClick = (tagQuery) => {
    setTextQuery(tagQuery);
    if (onSearch) {
      onSearch({ text: tagQuery, image: null });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2.5">
      {/* Search Input Box */}
      <form
        onSubmit={handleSubmit}
        className="bg-neutral-900 border border-cyan-500/40 rounded-full px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2.5 sm:gap-3 shadow-lg shadow-cyan-950/40 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all w-full"
      >
        {/* Search Lens Icon */}
        <svg
          className="w-5 h-5 text-cyan-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Main Input */}
        <input
          type="text"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          placeholder="Search anything or click camera to search by photo..."
          className="w-full bg-transparent text-white placeholder-neutral-500 text-xs sm:text-sm outline-none font-medium"
          disabled={isLoading}
        />

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />

        {/* Camera/Photo Icon OR Image Preview */}
        {imagePreview ? (
          <div className="relative shrink-0 flex items-center">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-8 h-8 object-cover rounded-full border-2 border-cyan-400 shadow-md"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-1 -right-1 bg-black text-cyan-400 hover:text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center border border-cyan-500"
              title="Remove image"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="text-neutral-400 hover:text-cyan-400 bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 hover:border-cyan-500/50 p-2 rounded-full transition-all shrink-0 flex items-center justify-center cursor-pointer"
            title="Upload image / photo to visual search"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}
      </form>

      {/* Search Suggestions Bar (Strictly 1 line scrollable) */}
      <div className="w-full overflow-x-auto scrollbar-none flex items-center gap-2 py-1 px-1">
        <span className="text-[11px] text-neutral-500 font-medium whitespace-nowrap shrink-0">
          Suggestions:
        </span>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {SUGGESTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleTagClick(item.query)}
              disabled={isLoading}
              className="shrink-0 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/50 text-neutral-300 hover:text-cyan-300 text-xs px-3 py-1 rounded-full transition-all"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

