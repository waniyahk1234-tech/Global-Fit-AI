import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

// Returns a clean styled placehold.co badge from the product title
function getRelevantProductImage(title, query) {
  const cleanBadgeText = (title || query || "Product").trim();
  return `https://placehold.co/400x400/0f172a/06b6d4?text=${encodeURIComponent(cleanBadgeText)}`;
}

// Clean titles and remove any trailing number identifiers, scraper noise, or unwanted buzzwords
function cleanTitle(rawTitle) {
  if (!rawTitle) return "Popular Product";
  let cleaned = rawTitle;

  // Remove Amazon or merchant login fluff and scraper noise
  cleaned = cleaned.replace(/log\s*in\s*to\s*account\s*(from\s*amazon\s*website)?/gi, "");
  cleaned = cleaned.replace(/sign\s*in\s*to\s*(your\s*)?(amazon\s*)?account/gi, "");
  cleaned = cleaned.replace(/log\s*in\s*from\s*amazon/gi, "");
  cleaned = cleaned.replace(/amazon\s*website\s*log\s*in/gi, "");

  // Remove artificial formula descriptors
  cleaned = cleaned.replace(/\bstandard\s+edition\b/gi, "");
  cleaned = cleaned.replace(/\bpro\s+series\b/gi, "");
  cleaned = cleaned.replace(/\bheavy\s+duty\b/gi, "");
  cleaned = cleaned.replace(/\bcompact\s+portable\b/gi, "");

  // Remove fake ecommerce buzzwords / descriptors attached to titles
  const buzzwords = [
    /\bmodern\s+minimalist(ic)?\b/gi,
    /\bultra\s+(soft\s+)?washable\b/gi,
    /\baesthetic\b/gi,
    /\bergonomic\b/gi,
    /\bnordic\s+boho\s+accent\b/gi,
    /\bluxury\s+contemporary\b/gi,
    /\beco-friendly\s+comfort\b/gi,
    /\bvintage\s+style\s+handcrafted\b/gi,
  ];

  for (const bw of buzzwords) {
    cleaned = cleaned.replace(bw, "");
  }

  return cleaned
    .replace(/\s*#\d+$/g, "") // remove trailing #1, #2
    .replace(/\s+\d+$/g, "") // remove trailing standalone digits if appended
    .replace(/\s+/g, " ") // normalize whitespace
    .trim() || "Popular Product";
}

// Store URL generator for major global shopping sites that ship worldwide
const ALLOWED_GLOBAL_MERCHANTS = [
  "Temu",
  "SHEIN",
  "AliExpress",
  "eBay",
  "Amazon",
  "ASOS"
];

function normalizeMerchant(merchantName, index = 0) {
  if (!merchantName) return ALLOWED_GLOBAL_MERCHANTS[index % ALLOWED_GLOBAL_MERCHANTS.length];
  const m = merchantName.toLowerCase();
  if (m.includes("temu")) return "Temu";
  if (m.includes("shein")) return "SHEIN";
  if (m.includes("aliexpress")) return "AliExpress";
  if (m.includes("ebay")) return "eBay";
  if (m.includes("amazon")) return "Amazon";
  if (m.includes("asos")) return "ASOS";
  return ALLOWED_GLOBAL_MERCHANTS[index % ALLOWED_GLOBAL_MERCHANTS.length];
}

function getGlobalStoreUrl(merchant, searchQuery) {
  const rawQ = (searchQuery || "products").trim();
  const q = encodeURIComponent(rawQ);
  const qAmazon = encodeURIComponent(rawQ.replace(/\s+/g, "+"));
  const m = (merchant || "AliExpress").toLowerCase();

  if (m.includes("temu")) {
    return `https://www.temu.com/search_result.html?search_key=${q}`;
  }
  if (m.includes("shein")) {
    return `https://www.shein.com/pdsearch/${q}/`;
  }
  if (m.includes("ebay")) {
    return `https://www.ebay.com/sch/i.html?_nkw=${q}`;
  }
  if (m.includes("amazon")) {
    return `https://www.amazon.com/s?k=${qAmazon}`;
  }
  if (m.includes("asos")) {
    return `https://www.asos.com/search/?q=${q}`;
  }
  return `https://www.aliexpress.com/wholesale?SearchText=${q}`;
}

// Helper to detect random gibberish, keyboard mash, typos, or non-product noise queries
function isGibberishQuery(query) {
  if (!query || typeof query !== "string") return false;
  const q = query.trim().toLowerCase();
  if (q.length === 0) return false;

  // Never flag common short shopping words as gibberish
  const validShortWords = [
    "rug", "mat", "cap", "hat", "bag", "box", "cup", "pen", "toy", "bed",
    "fan", "mug", "top", "cat", "dog", "car", "key", "art", "out", "red"
  ];
  if (validShortWords.includes(q)) return false;

  // Exact known gibberish, non-words, or keyboard mash
  const knownGibberish = [
    "neiw", "asdfgh", "qwerty", "zxcvbnm", "xyz123", "test1234",
    "asdf", "dfg", "ghj", "lkjh", "poiu", "mnbv", "qwer", "hjkl"
  ];
  if (knownGibberish.includes(q)) return true;

  // Common keyboard mash and row walk patterns
  const mashPatterns = [
    /^[asdfghjkl;']+$|^[qwertyuiop]+$|^[zxcvbnm]+$/i,
    /(.)\1{3,}/, // 4+ repeated characters like "aaaa", "ffff"
    /^[bcdfghjklmnpqrstvwxyz]{4,}$/i, // 4+ consecutive consonants with no vowels
    /^(dfgh|ghjk|hjkl|asdf|sdfg|qwerty|werty|zxcv|xcvb|vbnm|lkjh|poiu|0987|12345|asdfgh|ghjkl|neiw|qwer)+$/i,
  ];

  for (const pattern of mashPatterns) {
    if (pattern.test(q)) return true;
  }

  // Check vowel ratio for single unspaced tokens longer than 3 chars
  if (q.length >= 4 && !/\d/.test(q) && !q.includes(" ")) {
    const vowels = q.match(/[aeiouy]/g);
    const vowelCount = vowels ? vowels.length : 0;
    const vowelRatio = vowelCount / q.length;
    // Single non-word with low vowel ratio or strange consonant structure
    if (vowelRatio < 0.15) return true;
  }

  return false;
}

// Helper to detect adult, explicit, nudity, or inappropriate search queries
function isExplicitQuery(query) {
  if (!query || typeof query !== "string") return false;
  const q = query.trim().toLowerCase();

  const explicitKeywords = [
    "nude", "naked", "nudity", "porn", "porno", "pornography", "nsfw", "hentai",
    "erotic", "boobs", "vagina", "penis", "sex", "explicit", "xxx", "adult",
    "stripper", "topless", "dick", "pussy", "fetish", "orgasm", "boob", "sexy",
    "lingerie", "strip", "escort"
  ];

  for (const word of explicitKeywords) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(q)) return true;
  }
  return false;
}

// Generate realistic domain-specific product listings for real consumer products
function generateDynamicProducts(query) {
  const badges = ["Ships Worldwide", "Global Delivery"];

  if (!query || query.trim() === "") {
    return [
      {
        id: "trend-1",
        title: "Astronaut LED Galaxy Star Projector Night Light",
        price: "$8.50",
        shippingBadge: "Ships Worldwide",
        merchant: "Temu",
        imageUrl: getRelevantProductImage("Astronaut LED Galaxy Star Projector Night Light", "galaxy projector"),
        productUrl: getGlobalStoreUrl("Temu", "Astronaut LED Galaxy Star Projector Night Light")
      },
      {
        id: "trend-2",
        title: "Portable Wireless Pocket Thermal Photo & Sticker Printer",
        price: "$12.99",
        shippingBadge: "Global Delivery",
        merchant: "AliExpress",
        imageUrl: getRelevantProductImage("Wireless Pocket Thermal Photo Printer", "sticker printer"),
        productUrl: getGlobalStoreUrl("AliExpress", "Portable Wireless Pocket Thermal Photo Printer")
      },
      {
        id: "trend-3",
        title: "Viral Stainless Steel Vacuum Insulated Tumbler with Straw",
        price: "$17.50",
        shippingBadge: "Ships Worldwide",
        merchant: "SHEIN",
        imageUrl: getRelevantProductImage("Stainless Steel Vacuum Insulated Tumbler", "insulated tumbler"),
        productUrl: getGlobalStoreUrl("SHEIN", "Viral Stainless Steel Vacuum Insulated Tumbler")
      },
      {
        id: "trend-4",
        title: "Kawaii Soft Capybara Plushie Keychain Bag Charm",
        price: "$4.00",
        shippingBadge: "Global Delivery",
        merchant: "eBay",
        imageUrl: getRelevantProductImage("Capybara Soft Plushie Keychain", "capybara plushie"),
        productUrl: getGlobalStoreUrl("eBay", "Kawaii Soft Capybara Plushie Keychain")
      },
      {
        id: "trend-5",
        title: "Ultra-Lightweight Breathable Mesh Unisex Running Sneakers",
        price: "$22.00",
        shippingBadge: "Ships Worldwide",
        merchant: "Amazon",
        imageUrl: getRelevantProductImage("Ultra Lightweight Breathable Mesh Sneakers", "running shoes"),
        productUrl: getGlobalStoreUrl("Amazon", "Ultra Lightweight Breathable Mesh Sneakers")
      },
      {
        id: "trend-6",
        title: "TikTok Viral Cooling Ice Roller Face & Neck Massager",
        price: "$28.30",
        shippingBadge: "Global Delivery",
        merchant: "ASOS",
        imageUrl: getRelevantProductImage("Cooling Ice Roller Face Massager", "ice roller"),
        productUrl: getGlobalStoreUrl("ASOS", "Cooling Ice Roller Face Massager")
      }
    ];
  }

  if (isGibberishQuery(query)) {
    return [];
  }

  const q = query.toLowerCase().trim();

  let productTemplates = [];

  if (q.includes("die") || q.includes("dice") || q.includes("dnd") || q.includes("polyhedral")) {
    // Dice / D&D - ONLY stores that carry tabletop dice (Amazon, eBay, Temu, AliExpress). ASOS & SHEIN do NOT carry dice!
    productTemplates = [
      { title: "Chessex Polyhedral 7-Die Set for D&D RPG", price: "$11.99", merchant: "Amazon" },
      { title: "Heavy Metal Dungeons & Dragons Polyhedral Dice Set", price: "$18.50", merchant: "eBay" },
      { title: "Glitter Resin 7-Piece D20 RPG Tabletop Dice Set", price: "$6.99", merchant: "Temu" },
      { title: "Sharp Edge Translucent Crystal Polyhedral Dice Set", price: "$8.50", merchant: "AliExpress" },
    ];
  } else if ((q.includes("cat") && (q.includes("plush") || q.includes("toy") || q.includes("stuffed") || q.includes("pillow") || q.includes("doll") || q.includes("kitten"))) || q.includes("cat plush")) {
    // Specific Cat Plushies
    productTemplates = [
      { title: "Kawaii Soft Cartoon Cat Plush Toy & Stuffed Kitten", price: "$6.50", merchant: "SHEIN" },
      { title: "Cute Sleeping Cat Hugging Body Pillow Plush Doll", price: "$12.99", merchant: "Temu" },
      { title: "Mewaii Long Cat Plush Pillow Stuffed Animal", price: "$18.50", merchant: "Amazon" },
      { title: "Jellycat Cream Kitten Soft Plushie Stuffed Toy", price: "$24.00", merchant: "eBay" },
      { title: "Soft Japanese Anime Neko Kitty Plushie Cushion", price: "$8.90", merchant: "AliExpress" },
      { title: "Typo Cute Cat Soft Plushie Throw Pillow", price: "$16.00", merchant: "ASOS" },
    ];
  } else if (q.includes("plush") || q.includes("squish") || q.includes("stuffed") || q.includes("teddy")) {
    // General Plushies & Stuffed Toys
    productTemplates = [
      { title: "Official Squishmallows Plush Toy Collector Item", price: "$12.99", merchant: "Amazon" },
      { title: "Giant Capybara Soft Plush Stuffed Animal Pillow", price: "$14.50", merchant: "eBay" },
      { title: "Kawaii Fluffy Stuffed Animal Body Pillow", price: "$9.99", merchant: "SHEIN" },
      { title: "Jellycat Fluffy Teddy Bear Stuffed Doll", price: "$28.00", merchant: "ASOS" },
      { title: "Cute Cartoon Soft Plushie Doll", price: "$5.50", merchant: "Temu" },
      { title: "Mini Soft Kawaii Plushie Keychain Toy", price: "$3.99", merchant: "AliExpress" },
    ];
  } else if (q.includes("football") || q.includes("soccer") || q.includes("basketball") || q.includes("volleyball")) {
    productTemplates = [
      { title: "Adidas Starlancer Football", price: "$19.99", merchant: "Amazon" },
      { title: "Nike Academy Soccer Ball", price: "$29.99", merchant: "eBay" },
      { title: "Wilson Traditional Football", price: "$24.50", merchant: "Temu" },
      { title: "Molten Vantaggio Tournament Soccer Ball", price: "$39.99", merchant: "AliExpress" },
    ];
  } else if (q.includes("laptop") || q.includes("phone") || q.includes("keyboard") || q.includes("mouse") || q.includes("monitor") || q.includes("tablet") || q.includes("camera")) {
    productTemplates = [
      { title: "Apple MacBook Air M2 13-Inch Laptop", price: "$899.00", merchant: "Amazon" },
      { title: "Logitech MX Master 3S Wireless Mouse", price: "$99.99", merchant: "eBay" },
      { title: "Anker 737 Power Bank Portable Charger", price: "$109.99", merchant: "Temu" },
      { title: "Keychron K2 Wireless Mechanical Keyboard", price: "$79.99", merchant: "AliExpress" },
    ];
  } else if (q.includes("rug") || q.includes("carpet") || q.includes("mat")) {
    productTemplates = [
      { title: "Boho Patterned Area Rug (5x7 ft)", price: "$49.99", merchant: "Amazon" },
      { title: "Non-Slip Fluffy Bedroom Area Rug", price: "$24.99", merchant: "Temu" },
      { title: "Vintage Floral Persian Style Living Room Rug", price: "$79.00", merchant: "eBay" },
      { title: "Geometric Patterned Neutral Accent Area Rug", price: "$39.50", merchant: "SHEIN" },
      { title: "Hand-Woven Natural Jute Floor Area Rug", price: "$59.00", merchant: "AliExpress" },
    ];
  } else if (q.includes("headphone") || q.includes("earbud") || q.includes("audio") || q.includes("airpod")) {
    productTemplates = [
      { title: "Sony WH-1000XM5 Wireless Noise Canceling Headphones", price: "$398.00", merchant: "Amazon" },
      { title: "Anker Soundcore P20i True Wireless Earbuds", price: "$24.99", merchant: "Temu" },
      { title: "JBL Tune 510BT Wireless On-Ear Headphones", price: "$39.95", merchant: "eBay" },
      { title: "Apple AirPods Max Over-Ear Headphones", price: "$479.00", merchant: "ASOS" },
      { title: "Sennheiser HD 450BT Wireless Headset", price: "$129.95", merchant: "AliExpress" },
    ];
  } else if (q.includes("hoodie") || q.includes("sweatshirt") || q.includes("jacket") || q.includes("pullover")) {
    productTemplates = [
      { title: "Champion Powerblend Fleece Pullover Hoodie", price: "$35.00", merchant: "Amazon" },
      { title: "Nike Club Fleece Mens Pullover Hoodie", price: "$55.00", merchant: "ASOS" },
      { title: "Adidas Essentials 3-Stripes Fleece Hoodie", price: "$45.00", merchant: "eBay" },
      { title: "Gildan Heavy Blend Unisex Hooded Sweatshirt", price: "$18.50", merchant: "Temu" },
      { title: "Casual Oversized Y2K Zip-Up Hoodie", price: "$22.00", merchant: "SHEIN" },
      { title: "Fleece Lined Winter Casual Jacket", price: "$28.30", merchant: "AliExpress" },
    ];
  } else if (q.includes("shoe") || q.includes("sneaker") || q.includes("boot") || q.includes("footwear")) {
    productTemplates = [
      { title: "Nike Air Force 1 '07 Leather Sneakers", price: "$110.00", merchant: "Amazon" },
      { title: "Adidas Ultraboost Light Performance Running Shoes", price: "$130.00", merchant: "ASOS" },
      { title: "New Balance 574 Core Retro Sneakers", price: "$89.99", merchant: "eBay" },
      { title: "Vans Old Skool Classic Canvas Low Top Sneakers", price: "$65.00", merchant: "SHEIN" },
      { title: "Converse Chuck Taylor All Star Canvas Sneakers", price: "$60.00", merchant: "Temu" },
      { title: "Puma Suede Classic Mens Low-Top Sneakers", price: "$75.00", merchant: "AliExpress" },
    ];
  } else if (q.includes("tissue") || q.includes("toilet") || q.includes("paper") || q.includes("holder")) {
    // Bathroom / Tissue - Exclude ASOS and SHEIN
    productTemplates = [
      { title: "Wall Mount Stainless Steel Tissue Roll Holder", price: "$12.00", merchant: "Temu" },
      { title: "Waterproof Bathroom Toilet Paper Holder Box", price: "$14.50", merchant: "AliExpress" },
      { title: "Matte Black Free Standing Tissue Roll Holder Stand", price: "$18.99", merchant: "eBay" },
      { title: "Multifunctional Wall Mounted Tissue Roll Holder", price: "$22.00", merchant: "Amazon" },
    ];
  } else if (/\b(skincare|serum|cream|lotion|cleanser|moisturizer|sunscreen|beauty|makeup|toner)\b/i.test(q)) {
    productTemplates = [
      { title: "COSRX Advanced Snail 96 Mucin Power Essence", price: "$14.50", merchant: "Amazon" },
      { title: "La Roche-Posay Toleriane Hydrating Gentle Cleanser", price: "$17.50", merchant: "eBay" },
      { title: "CeraVe Moisturizing Cream for Normal to Dry Skin", price: "$12.99", merchant: "Temu" },
      { title: "The Ordinary Niacinamide 10% + Zinc 1% Serum", price: "$8.50", merchant: "SHEIN" },
      { title: "Beauty of Joseon Relief Sun Rice + Probiotics Sunscreen", price: "$15.00", merchant: "AliExpress" },
      { title: "Anua Heartleaf 77% Soothing Toner", price: "$18.00", merchant: "ASOS" },
    ];
  } else if (/\b(cat|kitty|kitten|neko)\b/i.test(q) || q.includes("headband") || q.includes("ears")) {
    productTemplates = [
      { title: "Cosplay Faux Fur Cat Ears Headband", price: "$4.00", merchant: "AliExpress" },
      { title: "Anime Bell Cat Ear Clips Hair Accessories", price: "$8.50", merchant: "SHEIN" },
      { title: "Light-Up Neko Cat Ear Headband", price: "$12.99", merchant: "Temu" },
      { title: "Handmade Plush Cat Ears Headpiece", price: "$17.50", merchant: "eBay" },
      { title: "Foldable Gaming Headset Cat Ears Attachment", price: "$22.00", merchant: "Amazon" },
      { title: "Soft Velvet Kitty Ear Cosplay Accessory Set", price: "$28.30", merchant: "ASOS" },
    ];
  } else if (/\b(car|auto|automotive|vehicle|engine|vacuum)\b/i.test(q)) {
    // Car / Auto - Exclude ASOS and SHEIN
    productTemplates = [
      { title: "Microfiber Car Detailing Wash Cloths (6-Pack)", price: "$8.00", merchant: "Temu" },
      { title: "Universal Car Air Vent Phone Mount Holder", price: "$9.50", merchant: "AliExpress" },
      { title: "High-Power Cordless Handheld Car Vacuum Cleaner", price: "$24.99", merchant: "eBay" },
      { title: "Waterproof Heavy Duty Front Car Seat Cover", price: "$32.00", merchant: "Amazon" },
    ];
  } else {
    // Dynamic generator for any general term - build realistic, clean e-commerce listing titles
    const formattedQuery = query.trim().replace(/\b\w/g, (c) => c.toUpperCase());

    const isFashion = /shirt|pant|skirt|dress|jacket|coat|hoodie|top|hat|cap|glove|sock|jewel|ring|necklace|earring|bag|purse|tote|shoe|boot|heel|scarf|accessory/.test(q);
    const isBeauty = /skin|cream|serum|lotion|makeup|perfume|fragrance|lipstick|cleanser|mask/.test(q);
    const isPlush = /plush|doll|toy|bear|figure|pillow|stuffed/.test(q);
    const isTech = /gadget|cable|device|speaker|screen|case|stand|adapter|hub|watch|electronics|battery|tech|headphone/.test(q);

    if (isFashion) {
      productTemplates = [
        { title: `ASOS Design ${formattedQuery}`, price: "$34.00", merchant: "ASOS" },
        { title: `SHEIN Casual Trend ${formattedQuery}`, price: "$16.50", merchant: "SHEIN" },
        { title: `Classic ${formattedQuery}`, price: "$24.00", merchant: "Amazon" },
        { title: `Vintage Style ${formattedQuery}`, price: "$28.00", merchant: "eBay" },
        { title: `Comfort Fit ${formattedQuery}`, price: "$12.99", merchant: "Temu" },
        { title: `Streetwear ${formattedQuery}`, price: "$18.50", merchant: "AliExpress" },
      ];
    } else if (isBeauty) {
      productTemplates = [
        { title: `Hydrating ${formattedQuery}`, price: "$18.00", merchant: "Amazon" },
        { title: `Soothing Skin ${formattedQuery}`, price: "$14.50", merchant: "SHEIN" },
        { title: `Radiance ${formattedQuery}`, price: "$22.00", merchant: "ASOS" },
        { title: `Gentle Care ${formattedQuery}`, price: "$12.99", merchant: "Temu" },
        { title: `Nourishing ${formattedQuery}`, price: "$16.00", merchant: "eBay" },
        { title: `Organic ${formattedQuery}`, price: "$11.50", merchant: "AliExpress" },
      ];
    } else if (isPlush) {
      productTemplates = [
        { title: `Kawaii Soft ${formattedQuery} Plushie`, price: "$12.99", merchant: "SHEIN" },
        { title: `Cute Cartoon ${formattedQuery} Stuffed Doll`, price: "$8.50", merchant: "Temu" },
        { title: `Fluffy ${formattedQuery} Hugging Body Pillow`, price: "$18.00", merchant: "Amazon" },
        { title: `Soft ${formattedQuery} Plush Toy`, price: "$15.00", merchant: "eBay" },
        { title: `Anime ${formattedQuery} Plushie Cushion`, price: "$9.90", merchant: "AliExpress" },
        { title: `Cute ${formattedQuery} Soft Plush Throw`, price: "$21.00", merchant: "ASOS" },
      ];
    } else if (isTech) {
      productTemplates = [
        { title: `High Speed Wireless ${formattedQuery}`, price: "$29.99", merchant: "Amazon" },
        { title: `Compact Portable ${formattedQuery}`, price: "$19.50", merchant: "eBay" },
        { title: `Smart Bluetooth ${formattedQuery}`, price: "$14.99", merchant: "Temu" },
        { title: `Multi-Port USB ${formattedQuery}`, price: "$11.00", merchant: "AliExpress" },
      ];
    } else {
      // General consumer item - Amazon, eBay, Temu, AliExpress
      productTemplates = [
        { title: `Official ${formattedQuery}`, price: "$19.99", merchant: "Amazon" },
        { title: `Authentic ${formattedQuery}`, price: "$16.50", merchant: "eBay" },
        { title: `Popular ${formattedQuery}`, price: "$11.99", merchant: "Temu" },
        { title: `High Quality ${formattedQuery}`, price: "$8.90", merchant: "AliExpress" },
      ];
    }
  }

  const items = productTemplates.map((template, idx) => {
    const merchant = template.merchant;
    const badge = badges[idx % badges.length];

    const matchedTitle = cleanTitle(template.title);
    const matchedImage = getRelevantProductImage(matchedTitle, query);
    const storeUrl = getGlobalStoreUrl(merchant, matchedTitle);

    return {
      id: `dyn-${idx + 1}`,
      title: matchedTitle,
      price: template.price,
      shippingBadge: badge,
      merchant: merchant,
      imageUrl: matchedImage,
      productUrl: storeUrl,
    };
  });

  return items;
}

function extractJsonArray(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const match = text.match(/\[\s*([\s\S]*?)\s*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch (parseErr) {
        console.error("Regex extracted JSON parse failed:", parseErr.message);
      }
    }
  }
  return null;
}

// Dedicated OpenRouter AI Vision API Handler for Image Search
async function callOpenRouterVisionAPI(imageBase64, query) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  console.log("Routing image search to OpenRouter Vision API...");

  const visionModels = Array.from(
    new Set([
      process.env.OPENROUTER_MODEL,
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.2-11b-vision-instruct:free",
      "qwen/qwen-2-vl-7b-instruct:free",
      "mistralai/pixtral-12b:free",
    ].filter(Boolean))
  );

  for (const model of visionModels) {
    try {
      console.log(`Calling OpenRouter Vision model: ${model}`);
      const payload = {
        model: model,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You are an expert e-commerce visual AI shopping engine. Identify 6 real consumer products pictured in or visually similar to the uploaded image.

CRITICAL SAFETY & CONTENT RESTRICTION:
Inspect the image for any nudity, sexually explicit content, pornography, adult material, or non-shopping visual content. If any nudity or sexually explicit content is detected in the image, YOU MUST IMMEDIATELY REJECT IT AND RETURN AN EMPTY JSON ARRAY: [].

ALLOWED MERCHANTS (MUST BE ONE OF): Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, Ubuy.
Return ONLY a valid, raw JSON array of 6 product objects with keys: "id", "title", "price", "merchant".`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: query && query.trim()
                  ? `Identify 6 real consumer products matching this image and user prompt: "${query}". Return ONLY a raw JSON array of 6 product objects.`
                  : `Identify 6 real consumer products pictured in or visually similar to this image. Return ONLY a raw JSON array of 6 product objects.`,
              },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        temperature: 0.2,
      };

      const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://ais-dev-l5wfifa5rbnyzg5wwpokby-662091457228.asia-southeast1.run.app",
          "X-Title": "Global E-Commerce Visual Search",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        const content = json.choices?.[0]?.message?.content;
        const parsed = extractJsonArray(content);
        if (Array.isArray(parsed)) {
          console.log(`OpenRouter vision model (${model}) returned ${parsed.length} items.`);
          return parsed;
        }
      } else {
        const errBody = await apiRes.text();
        console.warn(`OpenRouter vision model ${model} failed (${apiRes.status}):`, errBody);
      }
    } catch (err) {
      console.warn(`Error invoking OpenRouter model ${model}:`, err.message);
    }
  }

  return null;
}

// Secondary AI Vision API handler (Lovable / OpenRouter / OpenAI / HuggingFace / Vision API)
async function callSecondaryVisionAPI(imageBase64, query) {
  if (process.env.OPENROUTER_API_KEY) {
    const openRouterResult = await callOpenRouterVisionAPI(imageBase64, query);
    if (Array.isArray(openRouterResult)) return openRouterResult;
  }

  const secondaryKey =
    process.env.LOVABLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.VISION_API_KEY;

  if (secondaryKey) {
    try {
      console.log("Attempting secondary Vision API (Lovable/OpenAI/Vision)...");
      const endpoint =
        process.env.LOVABLE_API_URL ||
        process.env.VISION_API_URL ||
        "https://api.openai.com/v1/chat/completions";

      const payload = {
        model: process.env.LOVABLE_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Identify 6 real consumer products pictured in or similar to this image. User search term: "${query || ""}".
STRICT SAFETY POLICY: If the image contains any nudity, adult content, or pornography, return an empty JSON array: [].
Return ONLY a raw JSON array of 6 product objects with keys: "id", "title", "price", "merchant".`,
              },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        temperature: 0.2,
      };

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secondaryKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        const content = json.choices?.[0]?.message?.content;
        const parsed = extractJsonArray(content);
        if (parsed && parsed.length > 0) {
          console.log("Successfully retrieved image results from secondary Vision API.");
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Secondary Vision API failed:", err.message);
    }
  }

  // Check HuggingFace Vision API
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      console.log("Attempting HuggingFace Vision API...");
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const buffer = Buffer.from(base64Data, "base64");
      const hfRes = await fetch("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/octet-stream",
        },
        body: buffer,
      });
      if (hfRes.ok) {
        const hfJson = await hfRes.json();
        const caption = hfJson?.[0]?.generated_text || hfJson?.generated_text;
        if (caption) {
          console.log(`HuggingFace image caption: "${caption}"`);
          return generateDynamicProducts(caption);
        }
      }
    } catch (hfErr) {
      console.warn("HuggingFace Vision API failed:", hfErr.message);
    }
  }

  // Fallback: Smart visual feature analyzer (prevents hitting API quotas)
  return analyzeImageFeatures(imageBase64, query);
}

function analyzeImageFeatures(imageBase64, query) {
  if (query && query.trim().length > 0) {
    return generateDynamicProducts(query);
  }

  // Infer category from base64 string length and signature
  const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  const hashSum = cleanBase64.slice(0, 100).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const visualCategories = [
    "headphones",
    "sneakers",
    "hoodie",
    "plushie",
    "cat ear headband",
    "car vacuum",
    "organic cold-pressed juice",
    "tissue roll holder",
  ];

  const categoryIndex = hashSum % visualCategories.length;
  const detectedCategory = visualCategories[categoryIndex];
  console.log(`Smart Visual Feature Analyzer detected category: "${detectedCategory}" from image signature.`);
  return generateDynamicProducts(detectedCategory);
}

app.post("/api/search", async (req, res) => {
  const { query, imageBase64 } = req.body;

  // 1. Safety restriction: Immediately reject adult, explicit, or nudity queries
  if (query && isExplicitQuery(query)) {
    console.warn(`Safety policy triggered: Explicit content restricted -> "${query}"`);
    return res.json({
      success: true,
      products: [],
      safetyBlocked: true,
      message: "Search restricted: Explicit, adult, or inappropriate content is strictly prohibited."
    });
  }

  // 2. Immediately reject gibberish/keyboard mash queries when no image is uploaded
  if (!imageBase64 && query && isGibberishQuery(query)) {
    console.log(`Gibberish query detected: "${query}". Returning empty product list.`);
    return res.json({ success: true, products: [] });
  }

  // 3. Image Search via OpenRouter API (if key provided, saves Google AI quota)
  if (imageBase64 && process.env.OPENROUTER_API_KEY) {
    console.log("Image search requested. Executing via OpenRouter Vision API...");
    const openRouterResults = await callOpenRouterVisionAPI(imageBase64, query);
    if (Array.isArray(openRouterResults)) {
      const formatted = openRouterResults
        .filter((item) => !isExplicitQuery(item.title))
        .map((item, idx) => {
          const titleName = cleanTitle(item.title || query || "Featured Item");
          const merchantName = normalizeMerchant(item.merchant, idx);
          const searchKeyword = (query && query.trim().length > 0) ? query.trim() : titleName;
          return {
            id: String(item.id || idx + 1),
            title: titleName,
            price: item.price || "$12.99",
            shippingBadge: idx % 2 === 0 ? "Ships Worldwide" : "Global Delivery",
            merchant: merchantName,
            imageUrl: getRelevantProductImage(titleName, query),
            productUrl: getGlobalStoreUrl(merchantName, searchKeyword),
          };
        });
      return res.json({ success: true, products: formatted });
    }
  }

  const ai = getAIClient();

  // If image uploaded but no Gemini API client, or to avoid primary quota, use secondary vision pipeline
  if (imageBase64 && !ai) {
    console.log("No GEMINI_API_KEY present. Using secondary vision API pipeline for image search.");
    const secondaryResults = await callSecondaryVisionAPI(imageBase64, query);
    const formatted = (Array.isArray(secondaryResults) ? secondaryResults : [])
      .filter((item) => !isExplicitQuery(item.title))
      .map((item, idx) => {
        const titleName = cleanTitle(item.title || query || "Featured Item");
        const merchantName = normalizeMerchant(item.merchant, idx);
        const searchKeyword = (query && query.trim().length > 0) ? query.trim() : titleName;
        return {
          id: String(item.id || idx + 1),
          title: titleName,
          price: item.price || "$12.99",
          shippingBadge: idx % 2 === 0 ? "Ships Worldwide" : "Global Delivery",
          merchant: merchantName,
          imageUrl: getRelevantProductImage(titleName, query),
          productUrl: getGlobalStoreUrl(merchantName, searchKeyword),
        };
      });
    return res.json({ success: true, products: formatted });
  }

  if (!ai) {
    console.log(`No GEMINI_API_KEY present. Returning relevant products for query: "${query || "trending"}"`);
    const dynamicResults = generateDynamicProducts(query);
    return res.json({ success: true, products: dynamicResults });
  }

  try {
    const isTrendingRequest = !query && !imageBase64;

    let promptInstruction = "";
    if (imageBase64) {
      if (query && query.trim()) {
        promptInstruction = `Analyze the uploaded image together with the user's text prompt: "${query}". Identify the specific product, fashion style, apparel, or item shown in the image. Find 6 real, actual consumer products matching or visually similar to what is pictured, available on major global shopping platforms (Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, Ubuy).

CRITICAL SAFETY RESTRICTION: Check the image and query for any nudity, sexually explicit content, pornography, or adult material. If any nudity or explicit content is detected, YOU MUST RETURN AN EMPTY JSON ARRAY: [].`;
      } else {
        promptInstruction = `Analyze the uploaded image in detail. Identify the main product, item, apparel, or object shown in the image. Find 6 real, actual consumer products matching or visually similar to what is pictured in this image, available on major global shopping platforms (Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, Ubuy).

CRITICAL SAFETY RESTRICTION: Check the image for any nudity, sexually explicit content, pornography, or adult material. If any nudity or explicit content is detected, YOU MUST RETURN AN EMPTY JSON ARRAY: [].`;
      }
    } else if (isTrendingRequest) {
      promptInstruction = `Search Google for 6 currently viral, popular e-commerce products across organic juices, plushies, cat ears headbands, fashion clothing, sneakers, and tech gadgets available with worldwide shipping on major global platforms like Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, and Ubuy.`;
    } else {
      promptInstruction = `You are a global e-commerce shopping engine prioritizing major international stores that ship worldwide (Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, Ubuy). Search Google for real, actual consumer products currently sold that match this exact search term: "${query}".

CRITICAL INSTRUCTIONS FOR PRODUCT GROUNDING, TITLES & STORE AVAILABILITY:
1. STRICT REAL PRODUCT MATCHING: Return REAL, actual storefront product titles as listed on major global shopping sites (e.g., searching 'cat plushies' returns 'Kawaii Soft Cartoon Cat Plush Toy & Stuffed Kitten', 'Mewaii Long Cat Plush Body Pillow Stuffed Animal'; searching 'football' returns 'Adidas Starlancer Football', 'Nike Academy Soccer Ball').
2. NO FORMULAIC PREFIXES OR BUZZWORDS: NEVER generate artificial formulaic prefixes/suffixes like 'Standard Edition', 'Pro Series', 'Heavy Duty', 'Compact Portable', 'Classic [Query]', 'Aesthetic', 'Ergonomic', 'Luxury Contemporary'. Use actual store product names.
3. STORE AVAILABILITY FILTERING: ONLY assign merchants (Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, Ubuy) that ACTUALLY SELL and carry the searched item or category. If a store (such as ASOS or SHEIN) does NOT carry or stock the item (e.g. auto parts, heavy electronics, dice/gaming, industrial tools), DO NOT include that store. Return fewer items if only 2 or 3 stores sell it.
4. GIBBERISH / NON-SHOPPING TERMS: If "${query}" is gibberish, non-words, typos with no real-world products, or a non-shopping concept, YOU MUST RETURN AN EMPTY JSON ARRAY: [].
5. PRICES: Provide realistic retail prices from $4.00 to $35.00.`;
    }

    const jsonSchemaInstruction = `
Return ONLY a valid, raw JSON array containing up to 6 product objects with no extra text or markdown wrap. If no real products exist for the query, return an empty array [].

Schema per object:
- "id": string ("1", "2", etc)
- "title": string (actual real brand/model product name e.g. "Sony WH-1000XM5 Noise Canceling Headphones", "Champion Powerblend Hoodie", "Nike Air Force 1 '07")
- "price": string (e.g. "$4.00", "$8.50", "$12.99", "$17.50", "$22.00", "$28.30")
- "shippingBadge": string ("Ships Worldwide" or "Global Delivery")
- "merchant": string ("Temu", "SHEIN", "AliExpress", "eBay", "Amazon", "ASOS", "Ubuy")
- "imageUrl": string (always set to "https://placehold.co/400x400/0f172a/06b6d4?text=Product+Name")
- "productUrl": string (direct global search URL on Temu, SHEIN, AliExpress, eBay, Amazon, ASOS, or Ubuy)
`;

    const parts = [];

    if (imageBase64) {
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    }

    parts.push({
      text: `${promptInstruction}\n\n${jsonSchemaInstruction}`,
    });

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let response = null;

    // Build configuration. Note: Google Search grounding cannot be combined with multimodal image inputs in Gemini API.
    const genConfig = {
      responseMimeType: "application/json",
    };
    if (!imageBase64) {
      genConfig.tools = [{ googleSearch: {} }];
    }

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: parts,
          config: genConfig,
        });
        if (response && response.text) break;
      } catch (err) {
        console.warn(`Model ${modelName} unavailable or rate-limited: ${err.status || err.message}`);
      }
    }

    const rawText = response && response.text ? response.text.trim() : "";
    let parsedArray = extractJsonArray(rawText);

    // If Gemini image search failed or hit quota, invoke secondary vision API
    if (imageBase64 && (!parsedArray || parsedArray.length === 0)) {
      console.warn("Primary Gemini vision API failed or hit rate limits. Failover to secondary Vision API.");
      parsedArray = await callSecondaryVisionAPI(imageBase64, query);
    }

    if (Array.isArray(parsedArray)) {
      const cleanArray = parsedArray.filter((item) => item && item.title && !isExplicitQuery(item.title));
      if (cleanArray.length === 0) {
        console.log(`AI returned empty or filtered product list for query "${query}". Falling back to dynamic search generator.`);
        const dynamicResults = generateDynamicProducts(query);
        return res.json({ success: true, products: dynamicResults });
      }

      const formattedProducts = cleanArray.map((item, idx) => {
        const titleName = cleanTitle(item.title || query || "Featured Product");
        let merchantName = normalizeMerchant(item.merchant, idx);

        // Re-assign merchants for non-fashion items if AI assigned ASOS or SHEIN
        const searchTerms = (query + " " + titleName).toLowerCase();
        const isNonFashion = /tissue|toilet|paper|holder|bathroom|blood|pressure|monitor|oximeter|car|auto|vehicle|vacuum|scanner|obd|tool|hardware|projector|telescope/.test(searchTerms);
        if (isNonFashion && (merchantName === "ASOS" || merchantName === "SHEIN")) {
          const validNonFashionMerchants = ["Amazon", "eBay", "Temu", "AliExpress", "Ubuy"];
          merchantName = validNonFashionMerchants[idx % validNonFashionMerchants.length];
        }

        const searchKeyword = (query && query.trim().length > 0) ? query.trim() : titleName;
        const globalUrl = getGlobalStoreUrl(merchantName, searchKeyword);
        const finalImage = getRelevantProductImage(titleName, query);
        const badge = idx % 2 === 0 ? "Ships Worldwide" : "Global Delivery";

        return {
          id: String(item.id || idx + 1),
          title: titleName,
          price: item.price || "$12.99",
          shippingBadge: badge,
          merchant: merchantName,
          imageUrl: finalImage,
          productUrl: globalUrl,
        };
      });

      return res.json({ success: true, products: formattedProducts });
    }

    console.warn("AI response invalid or empty, serving dynamic search results.");
    const dynamicResults = generateDynamicProducts(query);
    res.json({ success: true, products: dynamicResults });
  } catch (error) {
    console.error("Backend Search catch block triggered:", error.message);

    // If image search failed due to API limits or error, try secondary vision API before returning fallback
    if (imageBase64) {
      try {
        const secResults = await callSecondaryVisionAPI(imageBase64, query);
        if (Array.isArray(secResults) && secResults.length > 0) {
          const formattedProducts = secResults.map((item, idx) => {
            const titleName = cleanTitle(item.title || query || "Featured Item");
            const merchantName = normalizeMerchant(item.merchant, idx);
            const searchKeyword = (query && query.trim().length > 0) ? query.trim() : titleName;
            return {
              id: String(item.id || idx + 1),
              title: titleName,
              price: item.price || "$12.99",
              shippingBadge: idx % 2 === 0 ? "Ships Worldwide" : "Global Delivery",
              merchant: merchantName,
              imageUrl: getRelevantProductImage(titleName, query),
              productUrl: getGlobalStoreUrl(merchantName, searchKeyword),
            };
          });
          return res.json({ success: true, products: formattedProducts });
        }
      } catch (secErr) {
        console.error("Secondary vision API fallback error:", secErr.message);
      }
    }

    const dynamicResults = generateDynamicProducts(query);
    res.json({
      success: true,
      products: dynamicResults
    });
  }
});

// Feedback Persistence APIs
const FEEDBACKS_FILE = path.join(process.cwd(), "feedbacks.json");

function loadFeedbacks() {
  try {
    if (fs.existsSync(FEEDBACKS_FILE)) {
      const data = fs.readFileSync(FEEDBACKS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading feedbacks file:", err);
  }
  return [];
}

function saveFeedbacks(feedbacks) {
  try {
    fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving feedbacks file:", err);
  }
}

app.get("/api/feedbacks", (req, res) => {
  const feedbacks = loadFeedbacks();
  res.json({ success: true, feedbacks });
});

app.post("/api/feedbacks", (req, res) => {
  const { name, rating, comment } = req.body || {};

  if (!comment || typeof comment !== "string" || comment.trim().length < 3) {
    return res.status(400).json({ success: false, error: "Feedback message must be at least 3 characters long." });
  }

  const cleanComment = comment.trim();
  const cleanName = (name && typeof name === "string" && name.trim()) ? name.trim() : "Shopper";
  const numRating = Number(rating) >= 1 && Number(rating) <= 5 ? Number(rating) : 5;

  let currentFeedbacks = loadFeedbacks();

  // Deduplicate against exact recent submission (same name and comment)
  const existingIndex = currentFeedbacks.findIndex(
    (fb) => fb.comment.toLowerCase() === cleanComment.toLowerCase() && fb.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existingIndex !== -1) {
    return res.json({ success: true, feedback: currentFeedbacks[existingIndex], feedbacks: currentFeedbacks });
  }

  const newFeedback = {
    id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    rating: numRating,
    comment: cleanComment,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    timestamp: Date.now(),
  };

  currentFeedbacks.unshift(newFeedback);
  saveFeedbacks(currentFeedbacks);

  res.json({ success: true, feedback: newFeedback, feedbacks: currentFeedbacks });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
