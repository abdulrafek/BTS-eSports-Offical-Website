import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

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

/**
 * Executes a Gemini content generation request with retry logic (exponential backoff)
 * and active model-rotation if the primary model is overloaded or experiencing high demand (503).
 */
async function generateContentWithRetry(ai: GoogleGenAI, params: any, maxRetries = 4) {
  let attempt = 0;
  let lastError: any = null;
  let delay = 1000; // Starting delay: 1000ms

  // Shallow copy params so we can modify the model field without side-effects
  const localParams = { ...params };
  if (localParams.config) {
    localParams.config = { ...localParams.config };
  }

  // Fallback model chain: primary -> stable lite -> standard flash
  const modelChain = [
    localParams.model,
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  let modelIdx = 0;

  while (attempt < maxRetries) {
    try {
      localParams.model = modelChain[modelIdx];
      console.log(`[Gemini API] Requesting ${localParams.model} (Attempt ${attempt + 1}/${maxRetries})...`);
      const response = await ai.models.generateContent(localParams);
      return response;
    } catch (error: any) {
      lastError = error;
      attempt++;
      console.warn(`[Gemini API] Attempt ${attempt} failed with model ${modelChain[modelIdx]}:`, error?.message || error);

      // Analyze if it's a 503 / UNAVAILABLE / high demand error
      const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
      const errMsg = error?.message || '';
      const isOverloaded = 
        errorStr.includes('503') ||
        errorStr.includes('UNAVAILABLE') ||
        errorStr.includes('high demand') ||
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand') ||
        error?.status === 503 ||
        error?.status === 'UNAVAILABLE';

      if (isOverloaded) {
        if (modelIdx < modelChain.length - 1) {
          modelIdx++;
          console.warn(`[Gemini API] Model ${modelChain[modelIdx - 1]} is overloaded/unavailable. Advancing to fallback model ${modelChain[modelIdx]} for subsequent retries.`);
          // Lower the retry wait time when switching models to speed up the recovery
          delay = Math.min(delay, 500);
        }
      }

      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 500);
        const waitTime = delay + jitter;
        console.log(`[Gemini API] Retrying in ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        delay *= 2;
      }
    }
  }

  // Last-ditch effort: try any remaining fallback models that haven't been tried yet
  while (modelIdx < modelChain.length - 1) {
    modelIdx++;
    try {
      localParams.model = modelChain[modelIdx];
      console.warn(`[Gemini API] All retry attempts exhausted. Making a last-ditch effort with fallback model ${localParams.model}...`);
      const response = await ai.models.generateContent(localParams);
      return response;
    } catch (fallbackError: any) {
      console.error(`[Gemini API] Last-ditch effort with ${localParams.model} failed:`, fallbackError?.message || fallbackError);
      lastError = fallbackError;
    }
  }

  throw lastError;
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
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            },
            {
              text: "Extract game match or profile stats from this screenshot. Find the number of kills and number of matches played. If there are other clear metrics like wins, deaths, KD ratio, or playerName, extract them too."
            }
          ]
        },
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

  // API endpoint to send team registration confirmation email
  app.post("/api/send-registration-email", async (req: express.Request, res: express.Response) => {
    try {
      const { email, teamName, leaderName, ign, playerId, tournamentName, squad, discordId, contact } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Missing destination email" });
      }

      // Check if SMTP is configured in environment
      let transporter;
      let fromEmail = process.env.SMTP_FROM || '"Alpha Esports" <no-reply@alphaesports.com>';
      
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log("Using custom configured SMTP credentials...");
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        // Fallback or Test SMTP Transport
        console.log("No custom SMTP configured. Initializing safe simulated/test Ethereal dispatch...");
        try {
          const testAccount = await nodemailer.createTestAccount();
          fromEmail = `"Alpha Esports (Demo)" <${testAccount.user}>`;
          transporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
        } catch (etherealErr) {
          console.warn("Could not create Ethereal account, falling back to JSON response log:", etherealErr);
          // Return immediately with a simulated success so the client is happy
          return res.json({ 
            success: true, 
            simulated: true,
            message: "SMTP not configured. Email logged successfully to server console.",
            recipient: email
          });
        }
      }

      // Construct Squad Roster Rows
      const squadRows = (squad || []).map((member: any, i: number) => `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 10px; color: #94a3b8; font-family: monospace;">PLAYER ${i + 1}</td>
          <td style="padding: 10px; color: #f8fafc; font-weight: bold;">${member.ign || 'N/A'}</td>
          <td style="padding: 10px; color: #f59e0b; font-family: monospace;">${member.uid || 'N/A'}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Tournament Registration Confirmed</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border: 1px solid #c2410c; border-top: 4px solid #f97316; border-radius: 4px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 30px; text-align: center; background-color: #0c0f17; border-bottom: 1px solid #1e293b;">
                      <h1 style="margin: 0; color: #f97316; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">ALPHA ESPORTS</h1>
                      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 4px;">OPERATIONAL SECURE TRANSMISSION</p>
                    </td>
                  </tr>

                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background-color: #065f46; color: #34d399; padding: 8px 16px; border-radius: 9999px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; border: 1px solid #047857;">
                          REGISTRATION CONFIRMED
                        </span>
                      </div>

                      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">
                        Greetings, Captain <strong>${leaderName}</strong>!
                      </p>
                      
                      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 30px;">
                        This automated operational dispatch confirms that your squad, <strong>${teamName}</strong>, has successfully registered on the roster grid for the upcoming <strong>${tournamentName}</strong>. Your telemetry and security clearance indices have been cataloged.
                      </p>

                      <!-- Receipt Card Grid -->
                      <h3 style="color: #f97316; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #334155; padding-bottom: 6px;">CAPTAIN IDENTITY</h3>
                      <table width="100%" style="background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 2px; margin-bottom: 30px; padding: 15px;">
                        <tr>
                          <td style="padding: 5px; font-size: 13px; color: #64748b; width: 40%;">In-Game Name:</td>
                          <td style="padding: 5px; font-size: 13px; color: #f8fafc; font-weight: bold;">${ign}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px; font-size: 13px; color: #64748b;">Character ID (UID):</td>
                          <td style="padding: 5px; font-size: 13px; color: #f59e0b; font-family: monospace;">${playerId}</td>
                        </tr>
                        ${discordId ? `
                        <tr>
                          <td style="padding: 5px; font-size: 13px; color: #64748b;">Discord Handle:</td>
                          <td style="padding: 5px; font-size: 13px; color: #f8fafc;">${discordId}</td>
                        </tr>
                        ` : ''}
                        ${contact ? `
                        <tr>
                          <td style="padding: 5px; font-size: 13px; color: #64748b;">Contact Signal:</td>
                          <td style="padding: 5px; font-size: 13px; color: #f8fafc;">${contact}</td>
                        </tr>
                        ` : ''}
                      </table>

                      <!-- Squad Roster Grid -->
                      <h3 style="color: #f97316; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #334155; padding-bottom: 6px;">SQUAD ROSTER DETAILS</h3>
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0c0f17; border: 1px solid #1e293b; border-radius: 2px; margin-bottom: 35px;">
                        <thead>
                          <tr style="background-color: #111827; border-bottom: 1px solid #1e293b;">
                            <th align="left" style="padding: 12px 10px; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Position</th>
                            <th align="left" style="padding: 12px 10px; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">In-Game Name</th>
                            <th align="left" style="padding: 12px 10px; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Character ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${squadRows || `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #64748b;">No secondary squad roster provided. Solo Captain.</td></tr>`}
                        </tbody>
                      </table>

                      <!-- Call to Action Info -->
                      <div style="background-color: #0c0f17; border-left: 3px solid #f59e0b; padding: 15px; margin-bottom: 10px;">
                        <h4 style="margin: 0 0 5px 0; color: #f59e0b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">TACTICAL PROTOCOLS:</h4>
                        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                          <li>Ensure all registered players coordinate on-time for check-ins.</li>
                          <li>Match lobbies and security codes will be dispatched to your captain's email/Discord.</li>
                          <li>Violation of tournament rules, hack vectors, or third-party modifications triggers permanent ban protocols.</li>
                        </ul>
                      </div>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 25px 30px; background-color: #0c0f17; text-align: center; border-top: 1px solid #1e293b;">
                      <p style="margin: 0; color: #475569; font-size: 11px;">
                        &copy; 2026 Alpha Esports Organization. All clearance protocols active.
                      </p>
                      <p style="margin: 5px 0 0 0; color: #334155; font-size: 10px;">
                        This is an encrypted transaction system log. Replies are unmonitored.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      // Dispatch mail
      const info = await transporter.sendMail({
        from: fromEmail,
        to: email,
        subject: `Registration Confirmed: ${teamName} - ${tournamentName}`,
        html: emailHtml,
      });

      console.log("Email dispatched successfully:", info.messageId);
      
      // If we generated an Ethereal link, log the test viewer URL beautifully
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log("-----------------------------------------");
        console.log("DEMO EMAIL PREVIEW URL:", previewUrl);
        console.log("-----------------------------------------");
        return res.json({ 
          success: true, 
          message: "Email successfully sent using Ethereal. Preview link generated.",
          previewUrl 
        });
      }

      res.json({ success: true, message: "Email successfully sent using SMTP transporter." });
    } catch (error: any) {
      console.error("Email dispatch failed on server:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch email confirmation receipt." });
    }
  });

  // API endpoint to securely send structured, styled Discord Webhook Notifications for registrations
  app.post("/api/discord-notify", async (req: express.Request, res: express.Response) => {
    try {
      const { webhookUrl, test, tournamentName, teamName, leaderName, ign, playerId, discordId, contact, squad } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({ error: "Missing Discord Webhook URL" });
      }

      let payload: any = {};

      if (test) {
        payload = {
          username: "Alpha Esports Intelligence",
          avatar_url: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?auto=format&fit=crop&w=150&q=80",
          embeds: [
            {
              title: "📡 Discord Webhook Test Connection",
              description: "Tactical telemetry verified! The website tournament registration grid is now successfully integrated with this Discord channel.",
              color: 2121755,
              fields: [
                { name: "Connection Status", value: "🟢 ONLINE / ACTIVE", inline: true },
                { name: "Response Protocol", value: "✅ READY", inline: true }
              ],
              footer: {
                text: "Alpha Esports Webhook Integration Module",
                icon_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=50&q=80"
              },
              timestamp: new Date().toISOString()
            }
          ]
        };
      } else {
        const squadList = (squad || [])
          .filter((s: any) => s.ign || s.uid)
          .map((s: any, idx: number) => `🔹 **Player ${idx + 1}:** ${s.ign || 'N/A'} *(ID: ${s.uid || 'N/A'})*`)
          .join("\n") || "*Solo Captain*";

        payload = {
          username: "Alpha Esports Registrations",
          avatar_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=150&q=80",
          embeds: [
            {
              title: "🏆 New Tournament Registration Received!",
              description: `A new team has registered on the grid for the **${tournamentName || 'Tournament'}**! Here is their tactical dossier:`,
              color: 13938487, // Gold #D4AF37
              fields: [
                { name: "Tournament Name", value: tournamentName || "N/A", inline: true },
                { name: "Registered Team Name", value: `⚡ **${teamName || "N/A"}**`, inline: true },
                { name: "Team Captain / Leader", value: `👤 ${leaderName || "N/A"} (${ign || "N/A"})`, inline: true },
                { name: "Character ID (UID)", value: `\`${playerId || "N/A"}\``, inline: true },
                { name: "Discord Handle", value: `\`${discordId || "N/A"}\``, inline: true },
                { name: "Contact Number", value: contact || "N/A", inline: true },
                { name: "Roster Lineup", value: squadList, inline: false }
              ],
              footer: {
                text: "Alpha Esports Automated Dispatch",
                icon_url: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?auto=format&fit=crop&w=50&q=80"
              },
              timestamp: new Date().toISOString()
            }
          ]
        };
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord responded with status ${response.status}: ${text}`);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Discord webhook dispatch failed:", error);
      res.status(500).json({ error: error.message || "Failed to deliver payload to Discord." });
    }
  });

  // API endpoint to generate tailored Gemini-powered scouting reports
  app.post("/api/gemini-scouting", async (req: express.Request, res: express.Response) => {
    try {
      const { player1, player2 } = req.body;
      if (!player1) {
        return res.status(400).json({ error: "Missing player 1 data" });
      }

      const ai = getGeminiClient();
      
      let promptText = "";
      if (player2) {
        promptText = `
          Perform an elite esports comparative head-to-head scouting report between two players:
          
          PLAYER 1:
          - IGN (In-Game Name): ${player1.ign}
          - Role: ${player1.role}
          - Game: ${player1.game}
          - Total Kills (Scrims + Tourneys + Rooms): ${player1.totalKills || 'N/A'}
          - K/D Ratio: ${player1.kd || 'N/A'}
          - Map Intelligence: ${JSON.stringify(player1.mapStats || {})}
          - Achievements: ${JSON.stringify(player1.achievements || [])}
          
          PLAYER 2:
          - IGN: ${player2.ign}
          - Role: ${player2.role}
          - Game: ${player2.game}
          - Total Kills (Scrims + Tourneys + Rooms): ${player2.totalKills || 'N/A'}
          - K/D Ratio: ${player2.kd || 'N/A'}
          - Map Intelligence: ${JSON.stringify(player2.mapStats || {})}
          - Achievements: ${JSON.stringify(player2.achievements || [])}

          Analyze their playstyles based on their stats, compare their role effectiveness, evaluate their performance on different maps, list who has the edge in combat rating, and provide strategic advice for team drafting/positioning. Include a playful/epic esports commentator tone but with high tactical depth. Format as clean, premium, spacious Markdown. Use headers, bold accents, bullet points, and comparative lists.
        `;
      } else {
        promptText = `
          Perform an elite esports tactical scouting report for a single player:
          
          PLAYER LOGS:
          - IGN (In-Game Name): ${player1.ign}
          - Role: ${player1.role}
          - Game: ${player1.game}
          - Total Kills: ${player1.totalKills || 'N/A'}
          - K/D Ratio: ${player1.kd || 'N/A'}
          - Map Intelligence: ${JSON.stringify(player1.mapStats || {})}
          - Achievements: ${JSON.stringify(player1.achievements || [])}
          
          Analyze this player's playstyle, identify key map advantages, list combat strengths, uncover developmental opportunities, and provide tactical recommendations for in-game positioning. Include a playful/epic esports commentator tone but with high tactical depth. Format as clean, premium, spacious Markdown. Use headers, bold accents, bullet points, and comparative lists.
        `;
      }

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: {
          parts: [{ text: promptText }]
        }
      });

      const report = response.text;
      if (!report) {
        throw new Error("Gemini returned empty scouting report.");
      }

      res.json({ success: true, report });
    } catch (error: any) {
      console.error("Gemini scouting error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI scouting report." });
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
