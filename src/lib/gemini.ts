import { GoogleGenAI } from "@google/genai";

export const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function calculateQueryCost(model: string, payload: any): Promise<number> {
  try {
    const ai = getAI();
    
    // Create a shallow copy of the payload
    const countPayload = { ...payload };
    
    // Remove systemInstruction and tools from config if present, as countTokens doesn't support them in config
    if (countPayload.config) {
      const { systemInstruction, tools, ...restConfig } = countPayload.config;
      countPayload.config = restConfig;
    }

    const response = await ai.models.countTokens({
      model,
      ...countPayload
    });
    return response.totalTokens || 0;
  } catch (error) {
    console.error("Error calculating token count:", error);
    return 0;
  }
}

export async function fetchLiveContext(userPrompt: string): Promise<string> {
  try {
    const ai = getAI();
    
    // Using gemini-3-pro-preview which supports googleSearch grounding.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: userPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are a neutral global news aggregator. Search the web for the user's topic and provide a concise, highly factual, 3-bullet-point summary of the current reality. Do not offer opinions."
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error fetching live context:", error);
    return ""; // Return empty string on failure so the app continues without it
  }
}
