import React, { useState, useEffect } from 'react';
import { supabase, handleDatabaseError, OperationType } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { format, parseISO } from 'date-fns';
import { ChevronDown, Cigarette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DailySummary {
  date: string;
  count: number;
  total_spent: number;
}

interface Entry {
  id: string;
  type: string;
  price: number;
  reason: string;
  timestamp: string;
}

export default function History() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Map of date string to entries
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<Record<string, Entry[]>>({});
  const [loadingEntries, setLoadingEntries] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (error) throw error;
        setSummaries(data || []);
      } catch (error) {
        handleDatabaseError(error, OperationType.LIST, 'daily_summaries');
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, [user]);

  const toggleDay = async (dateStr: string) => {
    if (expandedDate === dateStr) {
      setExpandedDate(null);
      return;
    }
    
    setExpandedDate(dateStr);
    
    // If we haven't fetched entries for this day yet
    if (!dayEntries[dateStr]) {
      setLoadingEntries(dateStr);
      try {
        // Parse the local date string to local boundaries
        const start = new Date(`${dateStr}T00:00:00`);
        const end = new Date(`${dateStr}T23:59:59.999`);
        
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', user?.id)
          .gte('timestamp', start.toISOString())
          .lte('timestamp', end.toISOString())
          .order('timestamp', { ascending: false });

        if (error) throw error;
        
        setDayEntries(prev => ({ ...prev, [dateStr]: data || [] }));
      } catch (error) {
        handleDatabaseError(error, OperationType.LIST, `entries for ${dateStr}`);
      } finally {
        setLoadingEntries(null);
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen label-caps animate-pulse text-gold-accent">Retrieving...</div>;

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      <header className="mb-12 border-b border-white/10 pb-6">
        <p className="label-caps text-gold-accent mb-1">Chronology</p>
        <h1 className="text-4xl font-light tracking-tight text-white">History</h1>
      </header>

      <div className="space-y-4">
        {summaries.length === 0 ? (
          <div className="text-center py-12 text-white/20 italic font-serif">No history found.</div>
        ) : (
          summaries.map((summary) => (
            <div key={summary.date} className="card-sophisticated p-0 overflow-hidden">
              <button 
                onClick={() => toggleDay(summary.date)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div>
                  <h3 className="font-medium text-white">{format(parseISO(summary.date), 'MMMM d, yyyy')}</h3>
                  <div className="text-xs text-white/40 mt-1 flex gap-3">
                    <span>{summary.count} logs</span>
                    <span>•</span>
                    <span>₹{Number(summary.total_spent).toFixed(2)}</span>
                  </div>
                </div>
                <ChevronDown 
                  size={18} 
                  className={`text-gold-accent/50 transition-transform duration-300 ${expandedDate === summary.date ? 'rotate-180' : ''}`} 
                />
              </button>

              <AnimatePresence>
                {expandedDate === summary.date && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-black/20"
                  >
                    <div className="p-5 border-t border-white/5 space-y-3">
                      {loadingEntries === summary.date ? (
                        <div className="text-center text-xs text-gold-accent animate-pulse py-4">Loading entries...</div>
                      ) : dayEntries[summary.date]?.length === 0 ? (
                        <div className="text-center text-xs text-white/20 py-4 italic">No specific logs found for this date.</div>
                      ) : (
                        dayEntries[summary.date]?.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="p-2 bg-black/40 rounded-md text-gold-accent">
                              <Cigarette size={14} />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-medium uppercase tracking-wide text-white">{entry.reason || 'LOGGED ENTRY'}</div>
                              <div className="text-[9px] uppercase tracking-widest opacity-40 mt-1">
                                {format(new Date(entry.timestamp), 'h:mm a')}
                              </div>
                            </div>
                            <div className="text-xs font-serif text-gold-accent opacity-80">
                              ₹{entry.price.toFixed(2)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
