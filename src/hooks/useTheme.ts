import { useEffect, useState, useSyncExternalStore } from "react";

const subscribeSystem = (changed: () => void) => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
};
const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("pg-theme") || "light",
  );
  const prefersDark = useSyncExternalStore(
    subscribeSystem,
    systemDark,
    () => false,
  );
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("pg-theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return {
    theme,
    setTheme,
    dark,
    toggleTheme: () => setTheme(dark ? "light" : "dark"),
  };
}
