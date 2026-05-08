import { GoogleGenAI, Type } from "@google/genai";

export interface HabitPattern {
  trigger: string;
  recommendation: string;
}

export interface InsightsResponse {
  summary: string;
  moodPattern: string;
  habits: HabitPattern[];
}

export async function getHabitInsights(data: any, apiKey: string): Promise<InsightsResponse> {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add it in your profile.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze this tobacco habit tracking data for the last 7 days and provide mindful, judgement-free insights.
    The goal is awareness of patterns (both behavioral and financial), not quitting pressure.
    
    Data:
    ${JSON.stringify(data)}
    
    Provide:
    1. A empathetic summary of the week, including a brief note on financial impact if relevant.
    2. Any mood/time/cost patterns detected.
    3. Actionable mindful recommendations.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          moodPattern: { type: Type.STRING },
          habits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                trigger: { type: Type.STRING },
                recommendation: { type: Type.STRING }
              },
              required: ["trigger", "recommendation"]
            }
          }
        },
        required: ["summary", "moodPattern", "habits"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Empty response from AI");
  }

  return JSON.parse(response.text.trim());
}
