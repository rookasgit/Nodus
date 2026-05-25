import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: "hello",
    });
    console.log(res.text);
  } catch (e: any) {
    console.error("Test 1 error:", e.message);
  }
  
  try {
    const res = await ai.models.generateContent({
      model: "models/gemini-2.5-pro",
      contents: "hello",
    });
    console.log(res.text);
  } catch (e: any) {
    console.error("Test 2 error:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: "",
      contents: "hello",
    });
    console.log(res.text);
  } catch (e: any) {
    console.error("Test 3 error:", e.message);
  }
}

test();
