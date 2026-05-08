import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfDay } from 'date-fns';
import { supabase, OperationType, handleDatabaseError } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { Plus, Cigarette, Search, ChevronDown, History as HistoryIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SMOKING_REASONS = [
  'Socially',
  'Had a craving',
  'Got anxiety',
  'Stress management',
  'Boredom',
  'After meal',
  'Morning routine',
  'Work break',
  'Habit / Automatic',
  'Driving',
  'Drinking alcohol',
  'Phone call'
];

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceInput, setPriceInput] = useState<string>('');
  const [reasonSearch, setReasonSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('Had a craving');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const filteredReasons = useMemo(() => {
    return SMOKING_REASONS.filter(r => 
      r.toLowerCase().includes(reasonSearch.toLowerCase())
    );
  }, [reasonSearch]);

  const fetchInitialData = async () => {
    if (!user) return;
    try {
      // Fetch today's entries
      const startOfTodayISO = startOfDay(new Date()).toISOString();
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', startOfTodayISO)
        .order('timestamp', { ascending: false });

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Fetch today's summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .limit(1);

      if (summaryError) {
        throw summaryError;
      }
      
      setDailySummary((summaryData && summaryData.length > 0) ? summaryData[0] : { count: 0, total_spent: 0, date: today });
      setLoading(false);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'entries/daily_summaries');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchInitialData();

    // Set up Realtime subscriptions
    const entriesSubscription = supabase.channel('entries_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'entries',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Simple strategy: refetch to ensure correct ordering and filtering
        // Or manually update the state
        fetchInitialData();
      })
      .subscribe();

    const summariesSubscription = supabase.channel('summaries_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'daily_summaries',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new && (payload.new as any).date === today) {
           setDailySummary(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(entriesSubscription);
      supabase.removeChannel(summariesSubscription);
    };
  }, [user, today]);

  const addEntry = async (type: string) => {
    if (!user) return;

    try {
      const price = parseFloat(priceInput) || 0;

      // 1. Add Entry
      const entryData = {
        user_id: user.id,
        type,
        price,
        reason: selectedReason,
        mood: 'neutral',
      };
      
      const { error: entryError } = await supabase
        .from('entries')
        .insert([entryData]);

      if (entryError) throw entryError;

      // 2. Update Daily Summary
      const currentCount = dailySummary?.count || 0;
      const currentSpent = dailySummary?.total_spent || 0;
      
      const { error: summaryError } = await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          count: currentCount + 1,
          total_spent: currentSpent + price,
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_id, date' });

      if (summaryError) throw summaryError;

      setShowAdd(false);
      setPriceInput('');
      
      // Ensure UI is updated immediately
      await fetchInitialData();
    } catch (error) {
      handleDatabaseError(error, OperationType.WRITE, 'entries');
    }
  };

  const deleteEntry = async (entryId: string, price: number) => {
    if (!user) return;
    setIsDeleting(entryId);

    try {
      // 1. Update Summary first
      const currentCount = dailySummary?.count || 0;
      const currentSpent = dailySummary?.total_spent || 0;

      await supabase
        .from('daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          count: Math.max(0, currentCount - 1),
          total_spent: Math.max(0, currentSpent - price),
          last_updated: new Date().toISOString()
        }, { onConflict: 'user_id, date' });

      // 2. Delete the doc
      const { error } = await supabase
        .from('entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      
      // Update UI immediately since Realtime might not be enabled for entries table
      setEntries(prev => prev.filter(e => e.id !== entryId));
      
    } catch (error) {
      handleDatabaseError(error, OperationType.DELETE, `entries/${entryId}`);
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen label-caps animate-pulse text-gold-accent">Calibrating...</div>;

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      <header className="mb-12 flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <p className="label-caps text-gold-accent mb-1">Session Data</p>
          <h1 className="text-4xl font-light tracking-tight">Aware<span className="italic opacity-50">ness</span></h1>
        </div>
        <div className="text-right">
           <div className="inline-flex items-center gap-2 px-3 py-1 border border-white/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-gold-accent shadow-[0_0_8px_#D4AF37]"></div>
            <span className="text-[10px] uppercase tracking-widest font-medium opacity-60">Live</span>
          </div>
        </div>
      </header>

      <div className="card-sophisticated mb-10 text-center py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
           <span className="label-caps text-white/20">Count</span>
        </div>
        <div className="text-8xl font-serif italic text-gold-accent mb-2">{dailySummary?.count || 0}</div>
        <div className="label-caps opacity-40">Today's Intake</div>
        
        {profile?.daily_goal && (
          <div className="mt-8 flex flex-col items-center">
             <div className="w-full bg-white/5 h-[1px] max-w-[140px] mb-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((dailySummary?.count || 0) / profile.daily_goal) * 100, 100)}%` }}
                  className="h-full bg-gold-accent shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                />
             </div>
             <span className="text-[10px] uppercase tracking-widest opacity-30">Allowance: {profile.daily_goal}</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="label-caps opacity-40 px-2 flex items-center gap-2">
          <HistoryIcon size={12} />
          Chronology
        </h2>
        
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-white/20 italic font-serif">A clean slate for now.</div>
          ) : (
            entries.map((entry, i) => (
              <motion.div 
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-5 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 border border-white/10 rounded-lg text-gold-accent">
                    <Cigarette size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium tracking-wide uppercase text-white">{entry.reason || 'LOGGED ENTRY'}</div>
                    <div className="text-[10px] uppercase tracking-widest opacity-40 mt-1">
                      {format(new Date(entry.timestamp), 'h:mm a')}
                      {entry.price > 0 && <span className="text-gold-accent opacity-80 font-serif lowercase ml-2 border-l border-white/10 pl-2">₹{entry.price.toFixed(2)}</span>}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => deleteEntry(entry.id, entry.price || 0)}
                  disabled={isDeleting === entry.id}
                  className="sm:opacity-0 group-hover:opacity-100 opacity-100 p-2 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-[#111] rounded-t-[40px] border-t border-white/10 p-10 z-50 shadow-2xl"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
              <h2 className="text-2xl font-serif italic mb-8 text-center">Log Moment</h2>
              
              <div className="space-y-6 mb-8">
                <div>
                  <label className="label-caps text-[10px] opacity-40 mb-3 block text-center">Why are you smoking?</label>
                  <div className="relative">
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 flex justify-between items-center text-sm group hover:border-gold-accent/30 transition-colors"
                    >
                      <span className={selectedReason ? 'text-white' : 'text-white/20'}>
                        {selectedReason || "Select Reason"}
                      </span>
                      <ChevronDown size={16} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute bottom-full mb-2 left-0 right-0 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                        >
                          <div className="p-3 border-b border-white/5">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                              <input 
                                type="text"
                                placeholder="Search reason..."
                                value={reasonSearch}
                                onChange={(e) => setReasonSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-gold-accent/50"
                              />
                            </div>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {filteredReasons.map((reason) => (
                              <button
                                key={reason}
                                onClick={() => {
                                  setSelectedReason(reason);
                                  setIsDropdownOpen(false);
                                }}
                                className="w-full text-left px-6 py-3 text-sm hover:bg-gold-accent/10 hover:text-gold-accent transition-colors border-b border-white/5 last:border-0"
                              >
                                {reason}
                              </button>
                            ))}
                            {filteredReasons.length === 0 && (
                              <div className="px-6 py-4 text-xs text-white/20 italic">No results found</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div>
                  <label className="label-caps text-[10px] opacity-40 mb-3 block text-center">Expense</label>
                  <div className="relative max-w-[120px] mx-auto">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-accent font-serif">₹</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={priceInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setPriceInput(val);
                        }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-center text-gold-accent focus:outline-none focus:border-gold-accent/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-4">
                <button 
                  onClick={() => addEntry('cigarette')}
                  className="flex items-center justify-center gap-4 p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-gold-accent/50 hover:bg-gold-accent/10 transition-all group"
                >
                  <Cigarette size={32} className="text-white/40 group-hover:text-gold-accent" />
                  <span className="label-caps text-xs">Confirm Cigarette</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setShowAdd(true)}
        className="fixed bottom-28 right-6 w-16 h-16 bg-gold-accent text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 transition-transform z-30"
      >
        <Plus size={32} />
      </button>
    </div>
  );
}
