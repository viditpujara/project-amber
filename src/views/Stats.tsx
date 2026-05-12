import React, { useEffect, useState, useCallback } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameMonth,
  parseISO,
} from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ViewMode = 'weekly' | 'monthly';

interface DaySummary {
  date: string;
  count: number;
  total_spent: number;
}

interface ChartEntry {
  name: string;
  fullDate: string;
  count: number;
  spent: number;
  isCurrentPeriod: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Monday-based week bounds */
function weekBounds(anchor: Date) {
  return {
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  };
}

/** Calendar month bounds */
function monthBounds(anchor: Date) {
  return {
    start: startOfMonth(anchor),
    end: endOfMonth(anchor),
  };
}

function buildWeeklyData(rows: DaySummary[], anchor: Date): ChartEntry[] {
  const { start, end } = weekBounds(anchor);
  const days = eachDayOfInterval({ start, end });
  return days.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const row = rows.find((r) => r.date === key);
    return {
      name: format(day, 'EEE'),
      fullDate: key,
      count: row?.count ?? 0,
      spent: Number(row?.total_spent ?? 0),
      isCurrentPeriod: key === format(new Date(), 'yyyy-MM-dd'),
    };
  });
}

function buildMonthlyData(rows: DaySummary[], anchor: Date): ChartEntry[] {
  const { start, end } = monthBounds(anchor);
  // Group by week-of-month for a readable monthly chart
  const weekStarts = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).filter(
    (ws) => isSameMonth(ws, start) || isSameMonth(end, ws)
  );

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  return weekStarts.map((ws, i) => {
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    // Clamp to month boundary
    const rangeStart = ws < start ? start : ws;
    const rangeEnd = we > end ? end : we;
    const daysInRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    let totalCount = 0;
    let totalSpent = 0;
    let hasToday = false;

    daysInRange.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const row = rows.find((r) => r.date === key);
      totalCount += row?.count ?? 0;
      totalSpent += Number(row?.total_spent ?? 0);
      if (key === todayKey) hasToday = true;
    });

    return {
      name: `W${i + 1}`,
      fullDate: `${format(rangeStart, 'MMM d')}–${format(rangeEnd, 'd')}`,
      count: totalCount,
      spent: totalSpent,
      isCurrentPeriod: hasToday,
    };
  });
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry: ChartEntry = payload[0]?.payload;
  return (
    <div
      style={{
        background: '#111',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '10px 14px',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>
        {entry?.fullDate ?? label}
      </p>
      <p style={{ color: '#D4AF37', fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
        {entry?.count} smoked
      </p>
      {entry?.spent > 0 && (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
          ₹{entry.spent.toFixed(2)}
        </p>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Stats() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>('weekly');
  const [anchor, setAnchor] = useState(new Date());
  const [rows, setRows] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute date range from current mode + anchor
  const range = mode === 'weekly' ? weekBounds(anchor) : monthBounds(anchor);
  const rangeStart = format(range.start, 'yyyy-MM-dd');
  const rangeEnd = format(range.end, 'yyyy-MM-dd');

  // Fetch from Supabase whenever range changes
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('date, count, total_spent')
        .eq('user_id', user.id)
        .gte('date', rangeStart)
        .lte('date', rangeEnd)
        .order('date', { ascending: true });

      if (error) throw error;
      setRows((data as DaySummary[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, rangeStart, rangeEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation
  const goBack = () =>
    setAnchor((prev) => (mode === 'weekly' ? addWeeks(prev, -1) : addMonths(prev, -1)));
  const goForward = () =>
    setAnchor((prev) => (mode === 'weekly' ? addWeeks(prev, 1) : addMonths(prev, 1)));

  const isCurrentPeriod =
    mode === 'weekly'
      ? rangeStart === format(weekBounds(new Date()).start, 'yyyy-MM-dd')
      : rangeStart === format(monthBounds(new Date()).start, 'yyyy-MM-dd');

  // Build chart data
  const chartData =
    mode === 'weekly' ? buildWeeklyData(rows, anchor) : buildMonthlyData(rows, anchor);

  // Summary stats
  const totalCount = chartData.reduce((s, d) => s + d.count, 0);
  const totalSpent = chartData.reduce((s, d) => s + d.spent, 0);
  const activeDays = rows.filter((r) => r.count > 0).length;
  const daysInPeriod =
    mode === 'weekly'
      ? 7
      : eachDayOfInterval({ start: range.start, end: range.end }).length;
  const avgPerActiveDay = activeDays > 0 ? (totalCount / activeDays).toFixed(1) : '0';

  // Period label
  const periodLabel =
    mode === 'weekly'
      ? `${format(range.start, 'MMM d')} – ${format(range.end, 'MMM d, yyyy')}`
      : format(anchor, 'MMMM yyyy');

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen label-caps animate-pulse text-gold-accent">
        Aggregating…
      </div>
    );

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      {/* ── Header ── */}
      <header className="mb-8 border-b border-white/10 pb-6">
        <p className="label-caps text-gold-accent mb-1">Time Series</p>
        <h1 className="text-4xl font-light tracking-tight text-white">
          Trend <span className="italic opacity-50">Analysis</span>
        </h1>
      </header>

      {/* ── Mode Toggle ── */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => { setMode('weekly'); setAnchor(new Date()); }}
          className={`flex-1 py-2.5 rounded-xl label-caps text-[10px] transition-all ${
            mode === 'weekly'
              ? 'bg-gold-accent text-black font-bold'
              : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/20'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => { setMode('monthly'); setAnchor(new Date()); }}
          className={`flex-1 py-2.5 rounded-xl label-caps text-[10px] transition-all ${
            mode === 'monthly'
              ? 'bg-gold-accent text-black font-bold'
              : 'bg-white/5 border border-white/10 text-white/40 hover:border-white/20'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* ── Period Navigator ── */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={goBack}
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-gold-accent/40 hover:text-gold-accent transition-all"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-white">{periodLabel}</p>
          {isCurrentPeriod && (
            <span className="text-[9px] uppercase tracking-[0.18em] text-gold-accent opacity-70">
              Current {mode === 'weekly' ? 'Week' : 'Month'}
            </span>
          )}
        </div>

        <button
          onClick={goForward}
          disabled={isCurrentPeriod}
          className={`p-2 rounded-lg bg-white/5 border border-white/10 transition-all ${
            isCurrentPeriod
              ? 'opacity-20 cursor-not-allowed'
              : 'hover:border-gold-accent/40 hover:text-gold-accent'
          }`}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Chart ── */}
      <div className="card-sophisticated mb-8 h-72 relative">
        <div className="absolute top-5 left-6">
          <h3 className="label-caps opacity-30">
            {mode === 'weekly' ? 'Daily Volume' : 'Weekly Volume'}
          </h3>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 52, bottom: 0, left: 10, right: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#E0E0E0', opacity: 0.3, fontWeight: 600 }}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isCurrentPeriod
                      ? '#D4AF37'
                      : entry.count > 0
                      ? 'rgba(212,175,55,0.3)'
                      : 'rgba(255,255,255,0.07)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">
            {mode === 'weekly' ? 'Weekly' : 'Monthly'} Total
          </div>
          <div className="text-4xl font-serif italic text-gold-accent">{totalCount}</div>
        </div>
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">Total Spent</div>
          <div className="text-4xl font-serif italic text-gold-accent">
            ₹{totalSpent.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">Daily Avg</div>
          <div className="text-4xl font-serif italic text-gold-accent">
            {(totalCount / (daysInPeriod || 1)).toFixed(1)}
          </div>
          <div className="label-caps opacity-20 text-[8px] mt-1">per day</div>
        </div>
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">Consistency</div>
          <div className="text-4xl font-serif italic text-gold-accent">
            {activeDays}/{daysInPeriod}
          </div>
          <div className="label-caps opacity-20 text-[8px] mt-1">days active</div>
        </div>
      </div>
    </div>
  );
}
