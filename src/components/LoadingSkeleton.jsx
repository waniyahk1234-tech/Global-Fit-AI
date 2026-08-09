import React from "react";

export default function LoadingSkeleton({ count = 6 }) {
  const skeletons = Array.from({ length: count });

  return (
    <div className="w-full my-4">
      {/* Skeleton Header Title */}
      <div className="h-6 w-52 bg-neutral-900 rounded-lg animate-pulse mb-6 border border-neutral-800" />

      {/* Grid of Skeleton Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {skeletons.map((_, index) => (
          <div
            key={index}
            className="bg-neutral-900 rounded-xl border border-neutral-800/80 overflow-hidden flex flex-col animate-pulse"
          >
            {/* Header Icon Box Placeholder */}
            <div className="h-44 w-full bg-neutral-800/60 relative flex items-center justify-center">
              <div className="absolute top-2 left-2 h-4 w-16 bg-neutral-700/50 rounded" />
              <div className="absolute top-2 right-2 h-4 w-20 bg-cyan-950/60 rounded-full" />
              <div className="w-12 h-12 rounded-xl bg-neutral-700/40" />
            </div>

            {/* Details Placeholder */}
            <div className="p-4 flex flex-col grow justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-neutral-800 rounded w-5/6" />
                <div className="h-4 bg-neutral-800 rounded w-2/3" />
                <div className="h-5 bg-cyan-950/60 border border-cyan-900/30 rounded w-1/3 mt-2" />
              </div>

              {/* Button Placeholder */}
              <div className="h-9 bg-neutral-800 rounded-lg w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
