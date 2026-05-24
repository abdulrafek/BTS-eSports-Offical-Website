import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required on the server.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set limits to handle base64 image data sizes gracefully
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API endpoint to process the uploaded gameplay/stat screenshot
  app.post("/api/process-stats", async (req: express.Request, res: express.Response) => {
    try {
      const { image, mimeType } = req.body;
      if (!image || !mimeType) {
        return res.status(400).json({ error: "Missing image data or mimeType" });
      }

      // Parse binary base64
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          "Extract game match or profile stats from this screenshot. Find the number of kills and number of matches played. If there are other clear metrics like wins, deaths, KD ratio, or playerName, extract them too."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kills: { type: Type.INTEGER, description: "Number of kills" },
              matches: { type: Type.INTEGER, description: "Number of matches played" },
              deaths: { type: Type.INTEGER, description: "Number of deaths if present" },
              wins: { type: Type.INTEGER, description: "Number of wins if present" },
              kd: { type: Type.NUMBER, description: "Kill/Death ratio if present" },
              playerName: { type: Type.STRING, description: "Player or profile name if present" },
              map: { type: Type.STRING, description: "Name of the map if present (e.g., Erangel, Miramar, Sanhok, Vikendi, Ascent, Bind etc.)" },
              category: { type: Type.STRING, description: "Type of match: Scrims, Tournament, or Open Room Match (if detectable in text)" }
            },
            required: ["kills", "matches"]
          }
        }
      });

      const extractedText = response.text;
      if (!extractedText) {
        throw new Error("Gemini returned an empty response. Verify the image quality.");
      }

      const stats = JSON.parse(extractedText.trim());
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error("Gemini OCR error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze game stats from image." });
    }
  });

  // Serve Vite app in dev mode, or compiled static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched successfully on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Express server failed to start:", error);
});
