import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any | null;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profile: null,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    console.log("🔥 [AuthProvider] Mount. Waiting for Supabase INITIAL_SESSION...");

    // A shorter failsafe just in case onAuthStateChange completely dies
    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.error("🚨 [AuthProvider] Failsafe: Forcing loading to false.");
          return false;
        }
        return prev;
      });
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`📡 [AuthProvider] Auth event: ${event}`, session?.user?.id);
        
        if (!mounted) return;

        // INSTANTLY unblock the UI the millisecond we get an auth event
        if (session?.user) {
          setUser(session.user);
          setLoading(false);
          // Run profile fetch in the background without blocking the render!
          fetchOrCreateProfile(session.user).catch(err => {
            console.error("Background profile sync failed:", err);
          });
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log("🛑 [AuthProvider] Unmount.");
      clearTimeout(timeoutId);
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchOrCreateProfile = async (currentUser: User) => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .limit(1);

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    const existingProfile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!existingProfile) {
      // Row not found, create new profile
      const newProfile = {
        id: currentUser.id,
        email: currentUser.email,
        display_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0],
        photo_url: currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture,
        onboarding_complete: false,
        daily_goal: 10,
      };

      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (!insertError) {
        setProfile(insertedProfile);
      } else {
        console.error("Error creating profile:", insertError);
        setProfile(null);
      }
    } else if (existingProfile) {
      // Update missing data from Google
      const googleName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
      const googlePhoto = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture;

      let needsUpdate = false;
      const updates: any = {};

      if (googleName && existingProfile.display_name !== googleName) {
        updates.display_name = googleName;
        needsUpdate = true;
      }
      if (googlePhoto && existingProfile.photo_url !== googlePhoto) {
        updates.photo_url = googlePhoto;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', currentUser.id)
          .select()
          .single();

        if (!updateError) {
          setProfile(updatedProfile);
          return;
        }
      }

      setProfile(existingProfile);
    } else {
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
