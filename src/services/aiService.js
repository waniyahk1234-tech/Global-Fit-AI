async function compressImage(file, maxDimension = 1024, quality = 0.8) {
  if (!file) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function searchProductsWithAI({ text, image, isInitialLoad }) {
  try {
    let imageBase64 = null;
    if (image) {
      if (typeof image === "string") {
        imageBase64 = image;
      } else {
        imageBase64 = await compressImage(image);
      }
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, imageBase64, isInitialLoad }),
    });

    if (!response.ok) {
      console.warn("Search endpoint returned non-OK status:", response.status);
      return [];
    }

    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error("Failed to fetch products from server:", error);
    return [];
  }
}

