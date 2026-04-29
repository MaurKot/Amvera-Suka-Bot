import { GoogleGenAI } from "@google/genai";

  const apiKey = process.env["GOOGLE_API_KEY"];

  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY must be set. Get one at https://aistudio.google.com/apikey",
    );
  }

  export const ai = new GoogleGenAI({ apiKey });
  