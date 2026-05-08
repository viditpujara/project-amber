import React, { useState, useEffect } from 'react';
import { subDays, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { getHabitInsights, InsightsResponse } from '../services/geminiService';
import { Sparkles, Brain, Activity } from 'lucide-react';
import { motion } from 'motion/react';

export default function Insights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const sevenDaysAgoISO = startOfDay(subDays(new Date(), 7)).toISOString();
      const { data: entriesData, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', sevenDaysAgoISO)
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;

      // Ensure timestamp is a Date object for the Gemini service
      const formattedEntries = (entriesData || []).map(doc => ({
        ...doc,
        timestamp: new Date(doc.timestamp)
      }));

      if (!profile?.gemini_api_key) {
        throw new Error("Please configure your Gemini API Key in the Profile tab first.");
      }
      
      const response = await getHabitInsights(formattedEntries, profile.gemini_api_key);
      setInsights(response);
    } catch (err: any) {
      console.error("Failed to generate insights:", err);
      setError(err.message || "Failed to generate insights. Please check your Gemini API key in the configuration.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-screen label-caps animate-pulse text-gold-accent italic">Decoding patterns...</div>;

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      <header className="mb-12 flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <p className="label-caps text-gold-accent mb-1">AI Diagnostics</p>
          <h1 className="text-4xl font-light tracking-tight">Pattern <span className="italic opacity-50">Cloud</span></h1>
        </div>
        <button 
          onClick={fetchInsights}
          disabled={refreshing}
          className="p-3 border border-white/10 rounded-full hover:bg-white/5 transition-colors text-gold-accent disabled:opacity-30"
        >
          <Sparkles size={20} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {insights ? (
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-sophisticated relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gold-accent" />
            <div className="flex items-center gap-3 mb-6">
              <Brain size={16} className="text-gold-accent" />
              <h3 className="label-caps opacity-50">The Synthesis</h3>
            </div>
            <p className="text-xl font-serif italic leading-relaxed text-white">"{insights.summary}"</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-sophisticated"
          >
             <div className="flex items-center gap-3 mb-4">
              <Activity size={16} className="text-gold-accent" />
              <h3 className="label-caps opacity-50">Telemetry Rhythm</h3>
            </div>
            <p className="leading-relaxed opacity-80">{insights.moodPattern}</p>
          </motion.div>

          <div className="space-y-4">
             <h3 className="label-caps opacity-30 px-2">Mindful Interventions</h3>
             {insights.habits.map((habit, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + (i * 0.1) }}
                  className="p-6 bg-white/5 rounded-2xl border border-white/5"
                >
                  <div className="label-caps text-[11px] text-gold-accent mb-3">{habit.trigger}</div>
                  <div className="text-sm text-white/70 leading-relaxed font-serif italic">"{habit.recommendation}"</div>
                </motion.div>
             ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 opacity-20 label-caps tracking-[0.5em]">
          Insufficient Data
        </div>
      )}
    </div>
  );
}
