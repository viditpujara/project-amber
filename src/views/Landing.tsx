import React from 'react';
import { signInWithGoogle } from '../lib/supabase';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg-dark text-ink-light relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gold-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-center relative z-10"
      >
        <p className="label-caps text-gold-accent mb-4 tracking-[0.5em]">Project Ember</p>
        <h1 className="text-8xl font-light mb-6 tracking-tighter">
          Aware<span className="italic text-gold-accent">.</span>
        </h1>
        <p className="text-xl mb-12 opacity-60 font-serif italic max-w-sm mx-auto leading-relaxed">
          "Judgment-free awareness as a vehicle for change."
        </p>
        
        <button 
          onClick={() => signInWithGoogle()}
          className="inline-flex items-center gap-4 bg-white text-black px-10 py-4 rounded-full font-bold text-sm tracking-widest uppercase hover:bg-gold-accent transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
        >
          <LogIn size={18} />
          Begin Session
        </button>
      </motion.div>
      
      <div className="absolute bottom-12 label-caps text-white/20">
        Confidential & Private
      </div>
    </div>
  );
}
