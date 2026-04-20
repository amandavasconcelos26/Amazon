import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Inject environment variables into index.html at runtime
    app.get('*', (req, res) => {
      const htmlPath = path.join(distPath, 'index.html');
      try {
        if (fs.existsSync(htmlPath)) {
          let content = fs.readFileSync(htmlPath, 'utf8');
          const env = {
            GEMINI_API_KEY: process.env.GEMINI_API_KEY
          };
          const script = `<script>window.ENV = ${JSON.stringify(env)};</script>`;
          content = content.replace('</head>', `${script}</head>`);
          res.send(content);
        } else {
          res.status(404).send('Not found');
        }
      } catch (e) {
        console.error("Error serving index.html:", e);
        res.sendFile(htmlPath);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
