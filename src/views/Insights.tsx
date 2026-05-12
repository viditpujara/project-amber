import React, { useState } from 'react';
import { subDays, subMonths, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import {
  getHabitInsights,
  InsightsResponse,
  HabitTag,
  TrendDirection,
  GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
} from '../services/geminiService';
import {
  Sparkles,
  Brain,
  Activity,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TimeWindow = '7D' | '30D' | '3M' | 'all';

const TIME_WINDOW_OPTIONS: { label: string; value: TimeWindow }[] = [
  { label: '7D',  value: '7D'  },
  { label: '30D', value: '30D' },
  { label: '3M',  value: '3M'  },
  { label: 'All', value: 'all' },
];

// ── Styling maps ──────────────────────────────────────────────────────────────

const TAG_STYLES: Record<HabitTag, { bg: string; text: string; label: string }> = {
  stress:     { bg: 'rgba(229,115,115,0.15)', text: '#E57373', label: 'Stress'     },
  boredom:    { bg: 'rgba(121,134,203,0.15)', text: '#7986CB', label: 'Boredom'    },
  social:     { bg: 'rgba(77,182,172,0.15)',  text: '#4DB6AC', label: 'Social'     },
  'post-meal':{ bg: 'rgba(255,183,77,0.15)',  text: '#FFB74D', label: 'Post-meal'  },
  habit:      { bg: 'rgba(144,164,174,0.15)', text: '#90A4AE', label: 'Habit'      },
  anxiety:    { bg: 'rgba(186,104,200,0.15)', text: '#BA68C8', label: 'Anxiety'    },
  reward:     { bg: 'rgba(212,175,55,0.15)',  text: '#D4AF37', label: 'Reward'     },
};

const TREND_CONFIG: Record<TrendDirection, { icon: React.ReactNode; color: string; label: string }> = {
  improving: {
    icon: <TrendingDown size={13} />,
    color: '#66BB6A',
    label: 'Improving',
  },
  worsening: {
    icon: <TrendingUp size={13} />,
    color: '#EF5350',
    label: 'Worsening',
  },
  stable: {
    icon: <Minus size={13} />,
    color: '#78909C',
    label: 'Stable',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCutoff(window: TimeWindow): string | null {
  const now = new Date();
  switch (window) {
    case '7D':  return startOfDay(subDays(now, 7)).toISOString();
    case '30D': return startOfDay(subDays(now, 30)).toISOString();
    case '3M':  return startOfDay(subMonths(now, 3)).toISOString();
    case 'all': return null;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: TrendDirection }) {
  const { icon, color, label } = TREND_CONFIG[trend];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}22`, color }}
    >
      {icon}
      {label}
    </span>
  );
}

function TagChip({ tag }: { tag: HabitTag }) {
  const { bg, text, label } = TAG_STYLES[tag] ?? TAG_STYLES['habit'];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Insights() {
  const { user, profile } = useAuth();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7D');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeKeySuffix, setActiveKeySuffix] = useState<string>('');

  /** Parse Gemini API errors into friendly messages */
  function parseGeminiError(err: any): string {
    const raw: string = err?.message ?? '';
    // Try to extract structured error JSON embedded in the message
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const code: number = parsed?.error?.code;
        const status: string = parsed?.error?.status ?? '';
        if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
          const retryMatch = raw.match(/retry in ([\d.]+)s/i);
          if (retryMatch) {
            const seconds = Math.ceil(Number(retryMatch[1]));
            return `Rate limit reached. Quotas are tied to your Google account/project, so changing keys won't bypass this.\n\nPlease wait ${seconds} seconds before trying again.`;
          }
          return `Gemini API rate limit reached. Quotas are tied to your Google account, so changing API keys from the same account won't bypass this.`;
        }
      }
    } catch {
      // fall through to raw message
    }
    if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota') || raw.includes('429')) {
      return 'Gemini API rate limit reached. Quotas apply per Google account/project. Please wait a minute and try again.';
    }
    return raw || 'Failed to generate insights. Please check your Gemini API key.';
  }

  const fetchInsights = async (
    window: TimeWindow = timeWindow,
    model: string = selectedModel,
  ) => {
    if (!user) return;
    setRefreshing(true);
    setLoading(true);
    setError(null);
    
    let currentKeySuffix = '?';

    try {
      const cutoff = getCutoff(window);

      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(200);

      if (cutoff) {
        query = query.gte('timestamp', cutoff);
      }

      const { data: entriesData, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const formattedEntries = (entriesData || []).map((doc) => ({
        ...doc,
        timestamp: new Date(doc.timestamp),
      }));

      // Always fetch the key fresh from DB
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user.id)
        .single();

      const apiKey = freshProfile?.gemini_api_key?.trim();
      
      if (!apiKey) {
        throw new Error('Please configure your Gemini API Key in the Profile tab first.');
      }
      
      // Save suffix for UI debugging and error reporting
      currentKeySuffix = apiKey.length > 4 ? apiKey.slice(-4) : 'none';
      setActiveKeySuffix(currentKeySuffix);
      console.log(`[Insights] Calling Gemini. Model: ${model}. Key ends with: ${currentKeySuffix}`);

      const response = await getHabitInsights(formattedEntries, apiKey, window, model);
      setInsights(response);
    } catch (err: any) {
      console.error('Failed to generate insights:', err);
      // Append the key suffix to the error to prove which key failed
      const parsedErr = parseGeminiError(err);
      setError(`${parsedErr}\n\n(Debug: Sent using key ending in ...${currentKeySuffix})`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleWindowChange = (w: TimeWindow) => {
    setTimeWindow(w);
    // Only auto-refresh if insights are already showing
    if (insights) {
      setInsights(null);
      fetchInsights(w, selectedModel);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    // Only auto-refresh if insights are already showing
    if (insights) {
      setInsights(null);
      fetchInsights(timeWindow, modelId);
    }
  };

  // No auto-fetch on mount — user must explicitly generate insights

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen label-caps animate-pulse text-gold-accent italic">
        Decoding patterns…
      </div>
    );

  /** Empty state shown before the user has ever generated insights */
  const showEmptyPrompt = !insights && !error && !loading;

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      {/* ── Header ── */}
      <header className="mb-8 flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <p className="label-caps text-gold-accent">AI Diagnostics</p>
            {activeKeySuffix && (
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] text-white/30 font-mono tracking-widest">
                KEY: ...{activeKeySuffix}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-light tracking-tight">
            Pattern <span className="italic opacity-50">Cloud</span>
          </h1>
        </div>
        <button
          onClick={() => fetchInsights()}
          disabled={refreshing}
          className="p-3 border border-white/10 rounded-full hover:bg-white/5 transition-colors text-gold-accent disabled:opacity-30"
        >
          <Sparkles size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* ── Time Window Selector ── */}
      <div className="flex items-center gap-2 mb-4">
        {TIME_WINDOW_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handleWindowChange(value)}
            className={`flex-1 py-2 rounded-xl label-caps text-[10px] transition-all ${
              timeWindow === value
                ? 'bg-gold-accent text-black font-bold'
                : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Model Selector ── */}
      <div className="mb-8">
        <p className="label-caps opacity-20 text-[9px] mb-2 px-0.5">Model</p>
        <div className="relative">
          {/* Trigger button */}
          <button
            onClick={() => setIsModelOpen((o) => !o)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-5 flex justify-between items-center text-sm hover:border-gold-accent/30 transition-colors"
          >
            <span className="text-white text-xs font-medium">
              {GEMINI_MODELS.find((m) => m.id === selectedModel)?.label ?? 'Select model'}
              <span className="ml-2 opacity-40 font-normal">
                — {GEMINI_MODELS.find((m) => m.id === selectedModel)?.description}
              </span>
            </span>
            <ChevronDown
              size={14}
              className={`opacity-40 transition-transform duration-300 ${isModelOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Animated panel */}
          <AnimatePresence>
            {isModelOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 left-0 right-0 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="max-h-[240px] overflow-y-auto">
                  {GEMINI_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        handleModelChange(m.id);
                        setIsModelOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 text-sm transition-colors border-b border-white/5 last:border-0 flex justify-between items-center ${
                        selectedModel === m.id
                          ? 'bg-gold-accent/10 text-gold-accent'
                          : 'hover:bg-gold-accent/5 hover:text-gold-accent text-white/70'
                      }`}
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[10px] opacity-50">{m.description}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Error State ── */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm leading-relaxed whitespace-pre-wrap">
          {error}
        </div>
      )}

      {insights ? (
        <div className="space-y-6">

          {/* ── The Synthesis ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-sophisticated relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gold-accent" />
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Brain size={16} className="text-gold-accent" />
                <h3 className="label-caps opacity-50">The Synthesis</h3>
              </div>
              <TrendBadge trend={insights.trend} />
            </div>
            <p className="text-xl font-serif italic leading-relaxed text-white">
              "{insights.summary}"
            </p>
          </motion.div>

          {/* ── Peak Time + Telemetry row ── */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="card-sophisticated p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-gold-accent" />
                <h3 className="label-caps opacity-50 text-[9px]">Peak Hours</h3>
              </div>
              <p className="text-sm leading-snug text-white/80 font-serif italic">
                "{insights.peakTime}"
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="card-sophisticated p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={14} className="text-gold-accent" />
                <h3 className="label-caps opacity-50 text-[9px]">Spend Forecast</h3>
              </div>
              <p className="text-sm leading-snug text-white/80 font-serif italic">
                "{insights.financialInsight}"
              </p>
            </motion.div>
          </div>

          {/* ── Telemetry Rhythm ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="card-sophisticated"
          >
            <div className="flex items-center gap-3 mb-4">
              <Activity size={16} className="text-gold-accent" />
              <h3 className="label-caps opacity-50">Telemetry Rhythm</h3>
            </div>
            <p className="leading-relaxed opacity-80">{insights.moodPattern}</p>
          </motion.div>

          {/* ── Mindful Interventions ── */}
          <div className="space-y-4">
            <h3 className="label-caps opacity-30 px-2">Mindful Interventions</h3>
            {insights.habits.map((habit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.08 }}
                className="p-6 bg-white/5 rounded-2xl border border-white/5"
              >
                <div className="mb-3">
                  <TagChip tag={habit.tag} />
                </div>
                <p className="text-sm text-white/70 leading-relaxed font-serif italic">
                  "{habit.recommendation}"
                </p>
              </motion.div>
            ))}
          </div>

        </div>
      ) : (
        showEmptyPrompt && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-gold-accent opacity-60">
              <Sparkles size={28} />
            </div>
            <p className="label-caps opacity-30 tracking-[0.4em] text-center">
              Awaiting analysis
            </p>
            <button
              onClick={() => fetchInsights()}
              className="px-8 py-3 bg-gold-accent text-black font-bold label-caps text-xs rounded-2xl hover:opacity-90 active:scale-95 transition-all"
            >
              Generate Insights
            </button>
          </div>
        )
      )}
    </div>
  );
}
