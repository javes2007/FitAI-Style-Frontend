import { createContext, useContext, useMemo, useState } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState({ style: "Smart Casual", palette: "Por descubrir" });

  const value = useMemo(() => ({
    profile,
    setProfile,
    preferences,
    setPreferences,
  }), [profile, preferences]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext debe usarse dentro de AppProvider");
  return context;
}