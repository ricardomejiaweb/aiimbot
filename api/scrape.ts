import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as cheerio from "cheerio";

const ALLOWED_HOST = "www.webstaurantstore.com";

function validateWebstaurantUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === ALLOWED_HOST || parsed.hostname.endsWith("." + ALLOWED_HOST);
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    const title =
      $('h1[data-testid="itemTitle"]').text().trim() ||
      $("h1").first().text().trim();

    const brand = title.split(/\s+/)[0] || "";

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

    const price =
      $('[data-testid="price"]').first().text().trim() ||
      $(".price-main .price").first().text().trim() ||
      $('[itemprop="price"]').attr("content") ||
      "";

    const rawItemText = $('[data-testid="itemNumber"]').text() ||
      $("span:contains('Item #')").parent().text() || "";
    const itemMatch = rawItemText.match(/Item\s*#:?\s*([A-Za-z0-9\-]+)/i);
    const itemNumber = itemMatch ? itemMatch[1].trim() : "";

    const rawMfrText = $('[data-testid="mfrNumber"]').text() ||
      $("span:contains('MFR #')").parent().text() || "";
    const mfrMatch = rawMfrText.match(/MFR\s*#:?\s*([A-Za-z0-9\-]+)/i);
    const mfrNumber = mfrMatch ? mfrMatch[1].trim() : "";

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

    const features: string[] = [];
    $('[data-testid="itemDescription"] li, .description li, #ProductOverview li, .product-overview li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) features.push(text);
    });

    const description = $('[data-testid="itemDescription"], .description, #ProductOverview').first().find('p').first().text().trim() || 
                        $('[data-testid="itemDescription"], .description, #ProductOverview').first().text().trim();

    const featureDetails: Record<string, string> = {};
    $("h3").each((_, heading) => {
      const h3 = $(heading);
      const headingText = h3.text().trim();
      if (!headingText) return;

      let nextP = h3.next("p");
      if (!nextP.length) {
        nextP = h3.nextUntil("h3, h2").filter("p").first();
      }
      
      if (nextP.length) {
        const paragraphText = nextP.text().trim();
        if (paragraphText) {
          featureDetails[headingText] = paragraphText;
        }
      }
    });

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
}
