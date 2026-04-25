import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  // Using process.env.PORT is critical for deployment platforms!
  const PORT = Number(process.env.PORT) || 3000; 

  app.use(express.json());

  // API routes FIRST
  app.get("/api/env", (req, res) => {
    res.json({ 
      keySet: !!process.env.GEMINI_API_KEY, 
      keyLength: process.env.GEMINI_API_KEY?.length,
      keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 4)
    });
  });

  // Frontend Serving Logic
  if (process.env.NODE_ENV !== "production") {
    // DEVELOPMENT MODE: Let Vite handle the frontend
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // PRODUCTION MODE: Serve the built static files
    // 1. Tell Express to serve files from the 'dist' folder
    app.use(express.static(path.join(process.cwd(), "dist")));

    // 2. Catch-all route to serve index.html for SPA routing
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log("GEMINI_API_KEY status:", process.env.GEMINI_API_KEY ? "Set" : "Not set");
  });
}

startServer();