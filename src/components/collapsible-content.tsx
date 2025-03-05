"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleContentProps {
  content: React.ReactNode;
  maxHeight?: number;
  className?: string;
  showButton?: boolean;
}

export function CollapsibleContent({
  content,
  maxHeight = 400,
  className,
  showButton = true,
}: CollapsibleContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content overflows when it changes or on window resize
  useEffect(() => {
    const checkOverflow = () => {
      if (contentRef.current) {
        const hasOverflow = contentRef.current.scrollHeight > maxHeight;
        setIsOverflowing(hasOverflow);
      }
    };

    // Use a small timeout to ensure content is properly rendered before checking
    const timeoutId = setTimeout(checkOverflow, 100);
    
    // Also check on window resize
    window.addEventListener("resize", checkOverflow);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [content, maxHeight]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={contentRef}
        style={{
          maxHeight: isExpanded ? "none" : isOverflowing ? `${maxHeight}px` : "none",
          overflow: "hidden",
          transition: "max-height 0.3s ease"
        }}
        className={cn(
          "transition-all duration-300"
        )}
      >
        {content}
      </div>

      {isOverflowing && showButton && (
        <div
          className={cn(
            "flex justify-center pt-2",
            !isExpanded &&
              "absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pt-8"
          )}
        >
          <Button
            variant="ghost"
            type="button"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                <span>Show more</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
