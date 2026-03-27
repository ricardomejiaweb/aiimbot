import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import {
  savePromptVersion,
  getPromptHistory,
  restorePromptVersion,
  getActiveBrandConfig,
  togglePromptStar,
  updatePromptNotes,
  getReferenceImages,
  addReferenceImage,
  removeReferenceImage,
  exportBrandConfig,
  importBrandConfig,
} from "./db.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

const ALLOWED_HOST = "www.webstaurantstore.com";

function validateWebstaurantUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === ALLOWED_HOST || parsed.hostname.endsWith("." + ALLOWED_HOST);
  } catch {
    return false;
  }
}

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!validateWebstaurantUrl(url)) {
    return res.status(400).json({ error: "Only WebstaurantStore URLs are supported." });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Title
    const title =
      $('h1[data-testid="itemTitle"]').text().trim() ||
      $("h1").first().text().trim();

    // Brand
    const brand = title.split(/\s+/)[0] || "";

    // Gallery images
    const seenIds = new Set<string>();
    const galleryImages: string[] = [];

    function normalizeUrl(raw: string): string {
      if (!raw) return "";
      if (raw.startsWith("//")) return `https:${raw}`;
      if (raw.startsWith("/")) return `https://${ALLOWED_HOST}${raw}`;
      return raw;
    }

    function toLarge(url: string): string {
      return url.replace(
        /\/images\/products\/(?:small|medium|extra_large|thumb|tiny)\//,
        "/images/products/large/"
      );
    }

    function pushImage(raw: string | undefined) {
      if (!raw) return;
      const url = toLarge(normalizeUrl(raw.trim()));
      if (!url) return;
      const filename = url.split("/").pop() || url;
      if (!seenIds.has(filename)) {
        seenIds.add(filename);
        galleryImages.push(url);
      }
    }

    pushImage($("#GalleryImage").attr("src") || $("#GalleryImage").attr("data-src"));

    $('[data-testid="gallery"] img, [class*="gallery"] img, [class*="Gallery"] img').each((_, el) => {
      pushImage($(el).attr("data-src") || $(el).attr("src"));
    });

    $("#GalleryImage").closest("div").parent().find("img").each((_, el) => {
      pushImage($(el).attr("data-src") || $(el).attr("src"));
    });

    if (galleryImages.length === 0) {
      pushImage($('meta[property="og:image"]').attr("content"));
    }

    // Price
    const price =
      $('[data-testid="price"]').first().text().trim() ||
      $(".price-main .price").first().text().trim() ||
      $('[itemprop="price"]').attr("content") ||
      "";

    // Item #, MFR # and UPC
    const rawItemText = $('[data-testid="itemNumber"]').text() ||
      $("span:contains('Item #')").parent().text() || "";
    const itemMatch = rawItemText.match(/Item\s*#:?\s*([A-Za-z0-9\-]+)/i);
    const itemNumber = itemMatch ? itemMatch[1].trim() : "";

    const rawMfrText = $('[data-testid="mfrNumber"]').text() ||
      $("span:contains('MFR #')").parent().text() || "";
    const mfrMatch = rawMfrText.match(/MFR\s*#:?\s*([A-Za-z0-9\-]+)/i);
    const mfrNumber = mfrMatch ? mfrMatch[1].trim() : "";

    // UPC
    let upc = $('[data-testid="upc"]').text().trim() || "";
    if (!upc) {
      $("*:contains('UPC Code')").each((_, el) => {
        const text = $(el).text().trim();
        const match = text.match(/UPC\s*Code\s*:\s*(\d+)/i);
        if (match) upc = match[1];
      });
    }
    if (!upc) {
      upc = $("span:contains('UPC')").parent().text().replace(/UPC\s*:\s*/i, '').trim();
    }

    // Description & Features
    const features: string[] = [];
    $('[data-testid="itemDescription"] li, .description li, #ProductOverview li, .product-overview li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) features.push(text);
    });

    const description = $('[data-testid="itemDescription"], .description, #ProductOverview').first().find('p').first().text().trim() || 
                        $('[data-testid="itemDescription"], .description, #ProductOverview').first().text().trim();

    // Feature details — rich heading + paragraph sections
    const featureDetails: Record<string, string> = {};
    $("h3").each((_, heading) => {
      const h3 = $(heading);
      const headingText = h3.text().trim();
      if (!headingText) return;

      // Find the next paragraph, even if there are other elements in between
      let nextP = h3.next("p");
      if (!nextP.length) {
        // Try to find the first paragraph after this heading but before the next heading
        nextP = h3.nextUntil("h3, h2").filter("p").first();
      }
      
      if (nextP.length) {
        const paragraphText = nextP.text().trim();
        if (paragraphText) {
          featureDetails[headingText] = paragraphText;
        }
      }
    });

    // Long-form details section
    $("h2").each((_, heading) => {
      const h2 = $(heading);
      const text = h2.text().trim();
      if (text.toLowerCase().includes("details")) {
        const detailBlock = h2.next("div, p, section");
        if (detailBlock.length) {
          const detailText = detailBlock.text().trim();
          if (detailText && detailText.length > 30) {
            featureDetails["Details"] = detailText;
          }
        }
      }
    });

    // Specs
    const specs: Record<string, string> = {};
    $('[data-testid="specifications-group"] dt, #specifications-group dt').each((_, dt) => {
      const key = $(dt).text().trim();
      const dd = $(dt).next("dd");
      const value = dd.text().trim();
      if (key && value) {
        specs[key] = value;
      }
    });

    res.json({
      title,
      brand,
      galleryImages,
      price,
      itemNumber,
      mfrNumber,
      upc,
      features,
      featureDetails,
      description: description || "No description available.",
      specs,
    });
  } catch (error: any) {
    console.error("Scrape error:", error);
    res.status(500).json({ error: error.message || "Failed to scrape product" });
  }
});

// --- Prompt Endpoints ---

app.get("/api/prompts/:brandKey", (req, res) => {
  try {
    const config = getActiveBrandConfig(req.params.brandKey);
    res.json(config ?? {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/prompts", (req, res) => {
  try {
    const { brandKey, promptType, content, label, author, notes } = req.body;
    if (!brandKey || !promptType || content == null) {
      return res.status(400).json({ error: "brandKey, promptType, and content are required" });
    }
    const result = savePromptVersion({ brandKey, promptType, content, label, author, notes });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/prompts/:brandKey/history", (req, res) => {
  try {
    const promptType = req.query.type as string | undefined;
    const history = getPromptHistory(req.params.brandKey, promptType);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/prompts/:id/star", (req, res) => {
  try {
    const result = togglePromptStar(Number(req.params.id));
    if (!result) return res.status(404).json({ error: "Version not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/prompts/:id/notes", (req, res) => {
  try {
    const { notes } = req.body;
    if (notes == null) return res.status(400).json({ error: "notes is required" });
    const result = updatePromptNotes(Number(req.params.id), notes);
    if (!result) return res.status(404).json({ error: "Version not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/prompts/restore/:id", (req, res) => {
  try {
    const version = restorePromptVersion(Number(req.params.id));
    if (!version) return res.status(404).json({ error: "Version not found" });
    res.json(version);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Reference Image Endpoints ---

app.get("/api/references/:brandKey", (req, res) => {
  try {
    const refs = getReferenceImages(req.params.brandKey);
    res.json(refs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/references", (req, res) => {
  try {
    const { brandKey, url } = req.body;
    if (!brandKey || !url) {
      return res.status(400).json({ error: "brandKey and url are required" });
    }
    const result = addReferenceImage(brandKey, url);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/references/:id", (req, res) => {
  try {
    removeReferenceImage(Number(req.params.id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Export / Import ---

app.get("/api/export/:brandKey", (req, res) => {
  try {
    const data = exportBrandConfig(req.params.brandKey);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/import", (req, res) => {
  try {
    importBrandConfig(req.body);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
