import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, LayoutDashboard, Brain, User as UserIcon, CalendarDays } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-dark text-ink-light">
      <main className="pb-24">
        {children}
      </main>
      
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-bg-dark/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4 sm:px-8 z-20">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-gold-accent' : 'text-white/20 hover:text-white/40'}`
          }
        >
          <LayoutDashboard size={20} strokeWidth={1.5} />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Logs</span>
        </NavLink>
        
        <NavLink 
          to="/history" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-gold-accent' : 'text-white/20 hover:text-white/40'}`
          }
        >
          <CalendarDays size={20} strokeWidth={1.5} />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold">History</span>
        </NavLink>

        <NavLink 
          to="/insights" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-gold-accent' : 'text-white/20 hover:text-white/40'}`
          }
        >
          <Brain size={20} strokeWidth={1.5} />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Patterns</span>
        </NavLink>

        <NavLink 
          to="/stats" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-gold-accent' : 'text-white/20 hover:text-white/40'}`
          }
        >
          <BarChart3 size={20} strokeWidth={1.5} />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Trends</span>
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className={({ isActive }) => 
            `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-gold-accent' : 'text-white/20 hover:text-white/40'}`
          }
        >
          <UserIcon size={20} strokeWidth={1.5} />
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Me</span>
        </NavLink>
      </nav>
    </div>
  );
}
