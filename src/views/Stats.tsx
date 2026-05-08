import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Stats() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: rawData, error } = await supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(7);
          
        if (error) throw error;
        
        // Sort and map
        const formattedData = (rawData || []).reverse().map(d => ({
          name: format(new Date(d.date), 'EEE'),
          count: d.count,
          spent: Number(d.total_spent) || 0
        }));
        
        setData(formattedData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-screen label-caps animate-pulse text-gold-accent">Aggregating...</div>;

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      <header className="mb-12 border-b border-white/10 pb-6">
        <p className="label-caps text-gold-accent mb-1">Time Series</p>
        <h1 className="text-4xl font-light tracking-tight text-white">Trend <span className="italic opacity-50">Analysis</span></h1>
      </header>

      <div className="card-sophisticated mb-8 h-80 relative">
         <div className="absolute top-6 left-6">
            <h3 className="label-caps opacity-30">Weekly Volume</h3>
         </div>
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 60, bottom: 0, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#E0E0E0', opacity: 0.3, fontWeight: 600 }} 
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                contentStyle={{ 
                  backgroundColor: '#111', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '8px 12px'
                }}
                itemStyle={{ color: '#D4AF37', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#D4AF37' : 'rgba(255,255,255,0.1)'} />
                ))}
              </Bar>
            </BarChart>
         </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">Weekly Avg</div>
          <div className="text-4xl font-serif italic text-gold-accent">
            {(data.reduce((acc, curr) => acc + curr.count, 0) / (data.length || 1)).toFixed(1)}
          </div>
        </div>
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">Weekly Spent</div>
          <div className="text-4xl font-serif italic text-gold-accent">
            ₹{data.reduce((acc, curr) => acc + curr.spent, 0).toFixed(2)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="card-sophisticated p-6">
          <div className="label-caps opacity-30 mb-2">Consistency</div>
          <div className="text-4xl font-serif italic text-gold-accent">
            {data.filter(d => d.count > 0).length}/7 days
          </div>
        </div>
      </div>
    </div>
  );
}
