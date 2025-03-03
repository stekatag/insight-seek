"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleContentProps {
  content: React.ReactNode;
  maxHeight?: number;
  className?: string;
}

export function CollapsibleContent({
  content,
  maxHeight = 400,
  className,
}: CollapsibleContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  React.useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > maxHeight);
    }
  }, [content, maxHeight]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden transition-all duration-300",
          !isExpanded && `max-h-[${maxHeight}px]`,
        )}
        style={{ maxHeight: isExpanded ? "none" : `${maxHeight}px` }}
      >
        {content}
      </div>

      {isOverflowing && (
        <div
          className={cn(
            "flex justify-center pt-2",
            !isExpanded &&
              "absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pt-8",
          )}
        >
          <Button
            variant="ghost"
            type="button"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 border bg-muted text-muted-foreground shadow-md hover:text-foreground"
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
