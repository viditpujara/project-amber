import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { supabase, handleDatabaseError, OperationType } from '../lib/supabase';
import { LogOut, User as UserIcon, Bell, Shield, Trash2, AlertTriangle, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile() {
  const { profile, user, refreshProfile } = useAuth();
  const [apiKey, setApiKey] = useState(profile?.gemini_api_key || '');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const handleSaveKey = async () => {
    if (!user) return;
    setIsSavingKey(true);
    const trimmedKey = apiKey.trim();
    console.log('[Profile] Saving API key. User ID:', user.id, '| Key starts with:', trimmedKey.slice(0, 8));
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ gemini_api_key: trimmedKey })
        .eq('id', user.id)
        .select('gemini_api_key')
        .single();

      if (error) {
        console.error('[Profile] Update error:', error);
        throw error;
      }

      console.log('[Profile] Update succeeded. Row returned:', data);

      await refreshProfile();
      console.log('[Profile] refreshProfile() done. Context profile key starts with:', profile?.gemini_api_key?.slice(0, 8));
    } catch (error) {
      handleDatabaseError(error, OperationType.UPDATE, 'profiles');
    } finally {
      setTimeout(() => setIsSavingKey(false), 2000);
    }
  };


  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="max-w-md mx-auto p-6 pb-32">
      <header className="mb-12 text-center">
        <div className="w-24 h-24 bg-white/5 border border-gold-accent/20 rounded-full mx-auto mb-4 flex items-center justify-center relative shadow-[0_0_40px_rgba(212,175,55,0.05)]">
           {profile?.photo_url ? (
             <img src={profile.photo_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
           ) : (
             <UserIcon size={40} className="text-gold-accent opacity-50" />
           )}
           <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gold-accent rounded-full border-4 border-bg-dark" />
        </div>
        <p className="label-caps text-gold-accent/40 mb-1">Authenticated Account</p>
        <h1 className="text-3xl font-light tracking-tight">{profile?.display_name || 'Aware User'}</h1>
        <p className="text-sm opacity-40 font-serif italic">{profile?.email}</p>
      </header>

      <div className="space-y-4">
        <div className="card-sophisticated p-3">
          <div className="flex flex-col p-4 rounded-xl transition-colors">
            <label className="text-sm font-medium mb-3 flex items-center gap-2">
              <Key size={18} className="text-gold-accent" />
              Gemini API Key
            </label>
            <p className="text-xs text-white/40 mb-3">
              Required to generate AI insights on your smoking patterns. Your key is synced to your database profile for seamless access across devices.
            </p>
            <div className="flex gap-2">
              <input 
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-[#111] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-gold-accent/50 transition-colors"
              />
              <button 
                onClick={handleSaveKey}
                disabled={isSavingKey}
                className="px-4 bg-gold-accent/10 text-gold-accent border border-gold-accent/20 rounded-lg text-sm font-medium hover:bg-gold-accent/20 transition-colors disabled:opacity-50"
              >
                {isSavingKey ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>


        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-3 p-5 text-ink-light/40 font-bold border border-white/5 hover:bg-white/5 rounded-2xl transition-all label-caps text-[11px]"
        >
          <LogOut size={16} />
          Terminate Session
        </button>
      </div>


      <div className="mt-12 text-center label-caps text-white/10">
        Ember v1.0.4 • Security Locked
      </div>
    </div>
  );
}
