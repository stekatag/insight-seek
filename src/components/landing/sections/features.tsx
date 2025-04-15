import { icons } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

// Import the features data and type
import { featuresList } from "../data/features-data";

export const FeaturesSection = () => {
  return (
    <section id="features" className="container py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
        Our Features
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featuresList.map(({ icon, title, description }) => {
          const LucideIcon = icons[icon as keyof typeof icons];

          return (
            <Card key={title} className="feature-card">
              <CardContent className="pt-6">
                <div className="mb-4">
                  {LucideIcon ? (
                    <LucideIcon
                      size={28}
                      color="hsl(var(--primary))"
                      className="text-primary"
                    />
                  ) : (
                    <div className="text-primary">Icon not found</div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
