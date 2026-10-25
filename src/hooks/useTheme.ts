import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("pg-theme") || "light",
  );
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
  return { theme, setTheme };
}
