import React, { useState, useEffect, useRef } from "react";

export default function FeedbackSection() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const listContainerRef = useRef(null);

  // Helper to deduplicate feedbacks by unique key (prefers comment content + author name)
  const sanitizeFeedbacks = (list = []) => {
    const map = new Map();
    list.forEach((item) => {
      if (item && item.comment && !item.id?.startsWith("fb-seed-")) {
        // Unique key based on author name and comment text
        const normKey = `${(item.name || "").trim().toLowerCase()}::${item.comment.trim().toLowerCase()}`;
        if (!map.has(normKey)) {
          map.set(normKey, item);
        }
      }
    });
    const result = Array.from(map.values());
    result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return result;
  };

  // Fetch feedbacks from server on load
  useEffect(() => {
    let isMounted = true;

    // Load local storage first for instant display
    let localSaved = [];
    try {
      const rawLocal = localStorage.getItem("app_user_feedbacks");
      if (rawLocal) {
        localSaved = JSON.parse(rawLocal);
      }
    } catch {
      // ignore
    }

    if (localSaved.length > 0) {
      setFeedbacks(sanitizeFeedbacks(localSaved));
    }

    // Fetch from server and merge
    fetch("/api/feedbacks")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          const serverList = data.success && Array.isArray(data.feedbacks) ? data.feedbacks : [];
          const merged = sanitizeFeedbacks([...serverList, ...localSaved]);
          setFeedbacks(merged);
          try {
            localStorage.setItem("app_user_feedbacks", JSON.stringify(merged));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // network error fallback already loaded localSaved
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanComment = comment.trim();

    // Anti-spam / empty submission check
    if (!cleanComment || cleanComment.length < 3) {
      setErrorMessage("Please enter a feedback message (at least 3 characters).");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    const payload = {
      name: name.trim() || "Shopper",
      rating: rating || 5,
      comment: cleanComment,
    };

    try {
      const response = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      let updatedList = [];
      if (data.success && Array.isArray(data.feedbacks)) {
        updatedList = sanitizeFeedbacks(data.feedbacks);
      } else {
        // Client fallback if server response was malformed
        const fallbackItem = {
          id: `fb-${Date.now()}`,
          name: payload.name,
          rating: payload.rating,
          comment: payload.comment,
          date: "Just now",
          timestamp: Date.now(),
        };
        updatedList = sanitizeFeedbacks([fallbackItem, ...feedbacks]);
      }

      setFeedbacks(updatedList);

      try {
        localStorage.setItem("app_user_feedbacks", JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      setName("");
      setComment("");
      setRating(5);
      setSubmitted(true);

      // Scroll review stream container to top so new review is immediately seen
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }

      setTimeout(() => {
        setSubmitted(false);
      }, 4000);
    } catch (error) {
      console.error("Failed to submit feedback to server:", error);

      // Network error fallback
      const fallbackItem = {
        id: `fb-${Date.now()}`,
        name: payload.name,
        rating: payload.rating,
        comment: payload.comment,
        date: "Just now",
        timestamp: Date.now(),
      };
      const updatedList = sanitizeFeedbacks([fallbackItem, ...feedbacks]);
      setFeedbacks(updatedList);

      try {
        localStorage.setItem("app_user_feedbacks", JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      setName("");
      setComment("");
      setRating(5);
      setSubmitted(true);

      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }

      setTimeout(() => {
        setSubmitted(false);
      }, 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="feedback-section" className="w-full max-w-5xl mx-auto my-8 px-2 sm:px-4">
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-6 backdrop-blur-sm shadow-xl">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-[11px] font-medium mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            User Feedback & Ratings
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1">
            How was your Global Fit AI experience?
          </h2>
          <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
            Rate your experience and share how accurately Global Fit AI identified your requested items or outfits across global stores.
          </p>
        </div>

        {/* Content Grid: Left Form, Right Real Reviews Stream */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Submission Form */}
          <div className="md:col-span-5 bg-neutral-950/70 border border-neutral-800/90 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
            <h3 className="text-sm font-semibold text-white mb-3">
              Leave Feedback
            </h3>

            {submitted ? (
              <div className="bg-cyan-950/60 border border-cyan-500/40 rounded-lg p-4 text-center my-auto">
                <div className="w-8 h-8 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white mb-0.5">Thank you for your feedback!</p>
                <p className="text-xs text-neutral-400">Your review has been saved and is now live.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Gemini Rating Prompt */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    How well did Gemini AI identify your item or outfit?
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating || rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 text-neutral-600 hover:scale-110 transition-transform focus:outline-none"
                          aria-label={`Rate ${star} stars`}
                        >
                          <svg
                            className={`w-5 h-5 ${active ? "text-cyan-400 fill-cyan-400" : "text-neutral-700 fill-none"}`}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        </button>
                      );
                    })}
                    <span className="text-xs font-semibold text-cyan-400 ml-2">
                      {rating} / 5 Stars
                    </span>
                  </div>
                </div>

                {/* Name Input (Optional) */}
                <div>
                  <label htmlFor="feedback-name" className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Name <span className="text-neutral-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="feedback-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name or leave blank"
                    maxLength={30}
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Feedback Message */}
                <div>
                  <label htmlFor="feedback-comment" className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Feedback Message *
                  </label>
                  <textarea
                    id="feedback-comment"
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="Share your thoughts on the search results or overall experience..."
                    rows={3}
                    maxLength={280}
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 resize-none"
                  />
                  {errorMessage && (
                    <p className="text-[11px] text-red-400 font-medium mt-1">
                      {errorMessage}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Submit Feedback"}
                </button>
              </form>
            )}
          </div>

          {/* Feedback Display Stream with Scrollable Container */}
          <div ref={listContainerRef} className="md:col-span-7 flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-1 px-1 sticky top-0 bg-neutral-900/90 py-1 z-10 backdrop-blur-md">
              <span className="text-xs font-semibold text-neutral-300">User Reviews</span>
              <span className="text-[10px] text-cyan-400 font-medium">
                {feedbacks.length} {feedbacks.length === 1 ? "review" : "reviews"}
              </span>
            </div>

            {feedbacks.length === 0 ? (
              <div className="bg-neutral-950/40 border border-neutral-800/60 border-dashed rounded-xl p-8 text-center my-auto flex flex-col items-center justify-center">
                <svg className="w-8 h-8 text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-xs font-medium text-neutral-400 mb-0.5">
                  No reviews submitted yet
                </p>
                <p className="text-[11px] text-neutral-500">
                  Be the first to share your experience with Gemini AI!
                </p>
              </div>
            ) : (
              feedbacks.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 flex flex-col gap-1.5 transition-all hover:border-neutral-700/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                        {(item.name || "S").charAt(0)}
                      </span>
                      <span className="text-xs font-semibold text-neutral-200 truncate">
                        {item.name || "Shopper"}
                      </span>
                    </div>

                    {/* Stars Display */}
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex text-cyan-400">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-3.5 h-3.5 ${i < item.rating ? "fill-cyan-400 text-cyan-400" : "fill-none text-neutral-700"}`}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[10px] text-neutral-400 ml-1">{item.date || "Recently"}</span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed pl-8">
                    "{item.comment}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
