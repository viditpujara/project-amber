import { GoogleGenAI, Type } from "@google/genai";

export type HabitTag =
  | 'stress'
  | 'boredom'
  | 'social'
  | 'post-meal'
  | 'habit'
  | 'anxiety'
  | 'reward';

export type TrendDirection = 'improving' | 'worsening' | 'stable';

export interface HabitPattern {
  tag: HabitTag;
  recommendation: string;
}

export interface InsightsResponse {
  summary: string;
  trend: TrendDirection;
  moodPattern: string;
  peakTime: string;
  financialInsight: string;
  habits: HabitPattern[];
}

const WINDOW_CONTEXT: Record<string, string> = {
  '7D':  'Focus on this week\'s immediate patterns and short-term triggers.',
  '30D': 'Look for monthly patterns, weekly rhythms, and financial trends.',
  '3M':  'Identify seasonal or multi-month behavioural shifts and financial impact over 3 months.',
  'all': 'Look for long-term behavioural trends, milestones, and overall lifestyle patterns.',
};

export interface GeminiModelOption {
  id: string;
  label: string;
  description: string;
}

export const GEMINI_MODELS: GeminiModelOption[] = [
  { id: 'gemini-2.5-flash',               label: '2.5 Flash',      description: 'Balanced · Default'   },
  { id: 'gemini-2.5-flash-lite',          label: '2.5 Flash Lite', description: 'Lightweight · Lean'   },
  { id: 'gemini-2.5-pro',                 label: '2.5 Pro',        description: 'Powerful · Thorough'  },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function getHabitInsights(
  data: any[],
  apiKey: string,
  windowLabel: string = '7D',
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<InsightsResponse> {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add it in your profile.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const windowContext = WINDOW_CONTEXT[windowLabel] ?? '';
  const windowDisplay = windowLabel === 'all' ? 'all time' : `last ${windowLabel}`;

  const prompt = `
    Analyze this tobacco habit tracking data (${windowDisplay}) and provide mindful, judgement-free insights.
    The goal is awareness of patterns (behavioral and financial) — not quitting pressure.
    ${windowContext}

    Data:
    ${JSON.stringify(data)}

    Provide:
    1. An empathetic, one-paragraph summary of the period.
    2. A trend direction: "improving" if frequency is clearly decreasing over time, "worsening" if clearly increasing, "stable" otherwise.
    3. The specific peak smoking time window (e.g. "9–11 PM on weekdays") derived from timestamps.
    4. Any mood, time-of-day, or contextual patterns detected.
    5. A specific financial insight — include a monthly or annual spend projection based on the observed rate.
    6. 2–4 actionable mindful recommendations. For each, assign the single most relevant trigger tag from this fixed list only: stress, boredom, social, post-meal, habit, anxiety, reward.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary:          { type: Type.STRING },
          trend:            { type: Type.STRING, enum: ['improving', 'worsening', 'stable'] },
          moodPattern:      { type: Type.STRING },
          peakTime:         { type: Type.STRING },
          financialInsight: { type: Type.STRING },
          habits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tag: {
                  type: Type.STRING,
                  enum: ['stress', 'boredom', 'social', 'post-meal', 'habit', 'anxiety', 'reward'],
                },
                recommendation: { type: Type.STRING },
              },
              required: ['tag', 'recommendation'],
            },
          },
        },
        required: ['summary', 'trend', 'moodPattern', 'peakTime', 'financialInsight', 'habits'],
      },
    },
  });

  if (!response.text) throw new Error('Empty response from AI');
  return JSON.parse(response.text.trim());
}
