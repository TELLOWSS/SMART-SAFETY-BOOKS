import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/summarize-hazards", async (req, res) => {
    try {
      const { hazards, actions } = req.body;
      
      const prompt = `다음은 건설현장 일일 안전점검에서 발견된 위험요소와 그에 대한 시정조치 내용입니다.
이 내용을 바탕으로 주요 핵심 위험 요소를 2~3문장으로 간결하게 자동 요약해주세요.

[위험요소]
${hazards}

[시정조치]
${actions}

요약결과:`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro',
        contents: prompt,
      });

      res.json({ summary: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
