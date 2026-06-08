import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Setup types
interface Channel {
  name: string;
  url: string;
  logo: string;
  tvgId: string;
  countryCode: string;
  countryName: string;
  group: string;
}

interface CountryGroup {
  countryCode: string;
  countryName: string;
  channels: Channel[];
}

// In-Memory cache
let cachedNews: CountryGroup[] = [];
let cachedSports: Channel[] = [];
let cachedBangladesh: Channel[] = [];
let lastFetchedTime = 0;
const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours

const countryMap: { [key: string]: string } = {
  "BD": "Bangladesh",
  "US": "United States",
  "GB": "United Kingdom",
  "IN": "India",
  "PK": "Pakistan",
  "CA": "Canada",
  "AU": "Australia",
  "DE": "Germany",
  "FR": "France",
  "AE": "United Arab Emirates",
  "SA": "Saudi Arabia",
  "QA": "Qatar",
  "TR": "Turkiye",
  "JP": "Japan",
  "CN": "China",
  "KR": "South Korea",
  "RU": "Russia",
  "IT": "Italy",
  "ES": "Spain",
  "BR": "Brazil",
  "ZA": "South Africa",
  "SG": "Singapore",
  "MY": "Malaysia",
  "ID": "Indonesia",
  "TH": "Thailand",
  "VN": "Vietnam",
  "PH": "Philippines",
  "NZ": "New Zealand",
  "NL": "Netherlands",
  "BE": "Belgium",
  "CH": "Switzerland",
  "SE": "Sweden",
  "NO": "Norway",
  "DK": "Denmark",
  "FI": "Finland",
  "IE": "Ireland",
  "PT": "Portugal",
  "GR": "Greece",
  "MX": "Mexico",
  "AR": "Argentina",
  "CO": "Colombia",
  "CL": "Chile",
  "PE": "Peru",
  "VE": "Venezuela",
  "NP": "Nepal",
  "LK": "Sri Lanka",
  "AF": "Afghanistan",
  "IR": "Iran",
  "IQ": "Iraq",
  "EG": "Egypt",
  "UA": "Ukraine",
  "INT": "International"
};

function getCountryName(code: string): string {
  const cleanCode = code.toUpperCase().trim();
  return countryMap[cleanCode] || cleanCode || "Other";
}

// Helper M3U parser
function parseM3U(content: string, defaultCountry = "INT", defaultGroup = "General"): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split("\n");
  let currentInfo: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const nameMatch = line.match(/,(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : "Unknown Channel";

      // Parse attrs
      const attrs: any = {};
      const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let match;
      while ((match = attrRegex.exec(line)) !== null) {
        attrs[match[1]] = match[2];
      }

      currentInfo = {
        name,
        logo: attrs["tvg-logo"] || attrs["logo"] || "",
        tvgId: attrs["tvg-id"] || "",
        countryCode: (attrs["tvg-country"] || attrs["country"] || defaultCountry).toUpperCase().trim(),
        group: attrs["group-title"] || defaultGroup,
      };
    } else if (line.startsWith("http://") || line.startsWith("https://") || line.startsWith("rtmp://")) {
      if (currentInfo) {
        currentInfo.url = line;
        currentInfo.countryName = getCountryName(currentInfo.countryCode);
        channels.push(currentInfo as Channel);
        currentInfo = null;
      }
    }
  }
  return channels;
}

// Fetch lists from IPTV-org and process them
async function refreshIPTVData() {
  try {
    console.log("Fetching IPTV playlists...");

    // Fetch Bangladesh M3U
    const bdRes = await fetch("https://iptv-org.github.io/iptv/countries/bd.m3u");
    let bdChannels: Channel[] = [];
    if (bdRes.ok) {
      const bdText = await bdRes.text();
      bdChannels = parseM3U(bdText, "BD", "Bangladesh");
      cachedBangladesh = bdChannels;
    }

    // Capture BD URLs for quick matching
    const bdUrls = new Set(bdChannels.map(c => c.url.toLowerCase()));
    const bdNames = new Set(bdChannels.map(c => c.name.toLowerCase()));

    // Fetch News M3U
    const newsRes = await fetch("https://iptv-org.github.io/iptv/categories/news.m3u");
    let newsChannels: Channel[] = [];
    if (newsRes.ok) {
      const newsText = await newsRes.text();
      newsChannels = parseM3U(newsText, "INT", "News");
    }

    // Fetch Sports M3U
    const sportsRes = await fetch("https://iptv-org.github.io/iptv/categories/sports.m3u");
    if (sportsRes.ok) {
      const sportsText = await sportsRes.text();
      const sportsRaw = parseM3U(sportsText, "INT", "Sports");
      
      // If a sports channel has a BD url/name, prioritize BD country code
      sportsRaw.forEach(c => {
        if (bdUrls.has(c.url.toLowerCase()) || bdNames.has(c.name.toLowerCase())) {
          c.countryCode = "BD";
          c.countryName = "Bangladesh";
        }
      });
      cachedSports = sportsRaw;
    }

    // Process News channels: map countries and ensure BD channels are correctly detected
    newsChannels.forEach(c => {
      // Check if this news channel is indeed BD-related
      if (
        c.countryCode === "BD" || 
        bdUrls.has(c.url.toLowerCase()) || 
        bdNames.has(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes("bangla") ||
        c.name.toLowerCase().includes("dhaka")
      ) {
        c.countryCode = "BD";
        c.countryName = "Bangladesh";
      }
    });

    // Group News by Country
    const groupedNewsMap = new Map<string, Channel[]>();
    newsChannels.forEach(c => {
      const countryCode = c.countryCode || "INT";
      if (!groupedNewsMap.has(countryCode)) {
        groupedNewsMap.set(countryCode, []);
      }
      groupedNewsMap.get(countryCode)!.push(c);
    });

    // Format groupedNews
    const groupedList: CountryGroup[] = [];
    groupedNewsMap.forEach((channels, countryCode) => {
      groupedList.push({
        countryCode,
        countryName: getCountryName(countryCode),
        channels
      });
    });

    // Sort countries alphabetically
    groupedList.sort((a, b) => a.countryName.localeCompare(b.countryName));

    // Place Bangladesh (BD) at the very top of News if it exists, otherwise provide from BD checklist
    const bdNewsIndex = groupedList.findIndex(g => g.countryCode === "BD");
    let bdNewsGroup: CountryGroup;

    if (bdNewsIndex !== -1) {
      bdNewsGroup = groupedList.splice(bdNewsIndex, 1)[0];
    } else {
      // Create news group for Bangladesh from we parsed in BD list if missing
      const bdNewsFromBD = bdChannels.filter(c => 
        c.name.toLowerCase().includes("news") || 
        c.name.toLowerCase().includes("somoy") ||
        c.name.toLowerCase().includes("jamuna") ||
        c.name.toLowerCase().includes("independent") ||
        c.name.toLowerCase().includes("channel 24") ||
        c.name.toLowerCase().includes("dbc") ||
        c.name.toLowerCase().includes("ekattor") ||
        c.name.toLowerCase().includes("atn")
      );
      bdNewsGroup = {
        countryCode: "BD",
        countryName: "Bangladesh",
        channels: bdNewsFromBD.length > 0 ? bdNewsFromBD : bdChannels.slice(0, 10)
      };
    }

    // Put Bangladesh at top of the array
    cachedNews = [bdNewsGroup, ...groupedList];
    lastFetchedTime = Date.now();
    console.log(`IPTV data initialized successfully. News: ${newsChannels.length}, Sports: ${cachedSports.length}, Bangladesh Total: ${cachedBangladesh.length}`);
  } catch (error) {
    console.error("Error refreshing IPTV data:", error);
  }
}

// Run immediately on boot
refreshIPTVData();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Static assets or JSON helper
  app.get("/api/iptv/news", async (req, res) => {
    if (Date.now() - lastFetchedTime > CACHE_DURATION || cachedNews.length === 0) {
      await refreshIPTVData();
    }
    res.json({
      success: true,
      lastUpdated: lastFetchedTime,
      data: cachedNews
    });
  });

  app.get("/api/iptv/sports", async (req, res) => {
    if (Date.now() - lastFetchedTime > CACHE_DURATION || cachedSports.length === 0) {
      await refreshIPTVData();
    }
    res.json({
      success: true,
      lastUpdated: lastFetchedTime,
      data: cachedSports
    });
  });

  app.get("/api/iptv/bangladesh", async (req, res) => {
    if (Date.now() - lastFetchedTime > CACHE_DURATION || cachedBangladesh.length === 0) {
      await refreshIPTVData();
    }
    res.json({
      success: true,
      lastUpdated: lastFetchedTime,
      data: cachedBangladesh
    });
  });

  app.post("/api/iptv/refresh", async (req, res) => {
    await refreshIPTVData();
    res.json({ success: true, message: "IPTV cache refreshed manually" });
  });

  // HLS stream geo-bypass & CORS bypass proxy with URL Rewriting!
  app.get("/api/stream-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing URL parameter");
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": new URL(targetUrl).origin,
        }
      });

      if (!response.ok) {
        return res.status(response.status).send(`Proxy fetch failed: ${response.statusText}`);
      }

      // Add CORS headers to solve client limitations inside iframe
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      const contentType = response.headers.get("content-type") || "";
      const isM3U8 = contentType.includes("mpegurl") || 
                     contentType.includes("mpegURL") || 
                     contentType.includes("apple") || 
                     targetUrl.split("?")[0].endsWith(".m3u8");

      if (isM3U8) {
        // Parse and rewrite relative chunks or keys inside the HLS manifest
        const text = await response.text();
        const parentUrl = targetUrl.split("?")[0];
        const baseUrl = parentUrl.substring(0, parentUrl.lastIndexOf("/")) + "/";

        const rewrittenLines = text.split("\n").map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith("#")) {
            // Rewrite embedded encryption key URIs (CORS & Geo Block Bypass)
            let modified = line;
            const uriMatch = line.match(/URI="([^"]+)"/);
            if (uriMatch) {
              const relativeUri = uriMatch[1];
              let absoluteUri = relativeUri;
              if (!relativeUri.startsWith("http://") && !relativeUri.startsWith("https://")) {
                if (relativeUri.startsWith("/")) {
                  absoluteUri = new URL(targetUrl).origin + relativeUri;
                } else {
                  absoluteUri = baseUrl + relativeUri;
                }
              }
              const proxyUri = `${req.protocol}://${req.get("host")}/api/stream-proxy?url=${encodeURIComponent(absoluteUri)}`;
              modified = line.replace(`URI="${relativeUri}"`, `URI="${proxyUri}"`);
            }
            return modified;
          } else {
            // Rewrite media segment or sub-playlist URL to route through proxy
            let absoluteUrl = trimmed;
            if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
              if (trimmed.startsWith("/")) {
                absoluteUrl = new URL(targetUrl).origin + trimmed;
              } else {
                absoluteUrl = baseUrl + trimmed;
              }
            }
            return `${req.protocol}://${req.get("host")}/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`;
          }
        });

        res.setHeader("Content-Type", "application/x-mpegURL");
        return res.send(rewrittenLines.join("\n"));
      } else {
        // Stream binary segment chunks (e.g. .ts, .aac, .key)
        res.setHeader("Content-Type", contentType || "application/octet-stream");
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
          res.setHeader("Content-Length", contentLength);
        }

        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } else {
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
      }
    } catch (error: any) {
      console.error("Stream Proxy request error:", error.message);
      return res.status(500).send(`Stream proxy fetch failed: ${error.message}`);
    }
  });

  // Vite development / production middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fullstack Server running on http://localhost:${PORT}`);
  });
}

startServer();
