"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

export function HeroImage() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mounting, we have access to the theme
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative group mt-14">
      <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>

      {/* Hide all images until mounted (prevents flash) */}
      {mounted ? (
        <Image
          width={1200}
          height={1200}
          className="w-full md:w-[1200px] mx-auto rounded-lg relative rouded-lg leading-none flex items-center border border-t-2 border-secondary border-t-primary/30"
          src={
            theme === "dark" || resolvedTheme === "dark"
              ? "/hero-image-dark.png"
              : "/hero-image-light.png"
          }
          alt="InsightSeek dashboard showing code and meeting analysis"
          priority
        />
      ) : (
        <div className="w-full md:w-[1200px] h-[600px] mx-auto rounded-lg bg-muted/30 border border-t-2 border-secondary border-t-primary/30 animate-pulse"></div>
      )}

      <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg"></div>
    </div>
  );
}
