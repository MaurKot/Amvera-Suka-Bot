import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (_ai) return _ai;
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY must be set. Get one at https://aistudio.google.com/apikey",
    );
  }
  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

export const ai: GoogleGenAI = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return Reflect.get(getAi() as unknown as object, prop);
  },
});
