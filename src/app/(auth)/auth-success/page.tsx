import React from "react";

export default function AuthSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="p-8 bg-card rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-semibold text-card-foreground mb-4">
          Authentication Successful!
        </h1>
        <p className="text-muted-foreground">
          You have been successfully signed in/up. You can now close this tab
          and return to the InsightSeek Chrome Extension.
        </p>
      </div>
    </div>
  );
}
