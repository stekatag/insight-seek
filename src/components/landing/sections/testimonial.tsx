"use client";

import { Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface ReviewProps {
  image: string;
  name: string;
  userName: string;
  comment: string;
  rating: number;
}

const reviewList: ReviewProps[] = [
  {
    image: "https://i.pravatar.cc/150?img=14",
    name: "Alex Chen",
    userName: "Senior Developer at TechCorp",
    comment:
      "InsightSeek saves hours onboarding new projects. The repository analysis feature is a game changer for understanding complex architectures.",
    rating: 5,
  },
  {
    image: "https://i.pravatar.cc/150?img=25",
    name: "Maria Rodriguez",
    userName: "Engineering Manager",
    comment:
      "Meeting analysis revolutionized our team workflows. Quickly extract key discussions and action items without watching hours of recordings.",
    rating: 5,
  },
  {
    image: "https://i.pravatar.cc/150?img=13",
    name: "James Wilson",
    userName: "Tech Lead at StartupX",
    comment:
      "InsightSeek truly understands context, unlike other tools. Commit summaries and repository Q&A deliver remarkable accuracy for code documentation.",
    rating: 5,
  },
  {
    image: "https://i.pravatar.cc/150?img=32",
    name: "Priya Sharma",
    userName: "DevOps Engineer",
    comment:
      "InsightSeek significantly improved our sprint retrospectives. Code and meeting insights in one platform helps identify patterns and improve team velocity.",
    rating: 5,
  },
];

export const TestimonialSection = () => {
  return (
    <section id="testimonials" className="container px-6 py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          Testimonials
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
          Hear What Our 1000+ Users Say
        </h2>
      </div>

      <Carousel
        opts={{
          align: "start",
        }}
        className="relative w-[80%] sm:w-[90%] lg:max-w-screen-xl mx-auto"
      >
        <CarouselContent className="py-1">
          {reviewList.map((review) => (
            <CarouselItem
              key={review.name}
              className="md:basis-1/2 lg:basis-1/3"
            >
              <Card className="bg-muted/50 dark:bg-card">
                <CardContent className="pt-6 pb-0">
                  <div className="flex gap-1 pb-6">
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                  </div>
                  {`"${review.comment}"`}
                </CardContent>

                <CardHeader>
                  <div className="flex flex-row items-center gap-4">
                    <Avatar>
                      <AvatarImage src={review.image} alt={review.name} />
                      <AvatarFallback>SV</AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col">
                      <CardTitle className="text-lg">{review.name}</CardTitle>
                      <CardDescription>{review.userName}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  );
};
