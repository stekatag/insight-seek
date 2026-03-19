interface ReviewProps {
  image: string;
  name: string;
  userName: string;
  comment: string;
  rating: number;
}

export const reviewList: ReviewProps[] = [
  {
    image: "testimonial_avatars/petko.jpg",
    name: "Petko Gospodinov",
    userName: "Software Developer",
    comment:
      "InsightSeek saves hours onboarding new projects. The repository analysis feature is a game changer for understanding complex architectures.",
    rating: 5,
  },
  {
    image: "testimonial_avatars/petar.jpeg",
    name: "Petar Tsvetanov",
    userName: "Front-end Developer",
    comment:
      "Meeting analysis revolutionized our team workflows. Quickly extract key discussions and action items without watching hours of recordings.",
    rating: 5,
  },
  {
    image: "testimonial_avatars/svetlyo.jpeg",
    name: "Svetoslav Ivanov",
    userName: "Full-stack Developer",
    comment:
      "InsightSeek truly understands context, unlike other tools. Commit summaries and repository Q&A deliver remarkable accuracy for code documentation.",
    rating: 5,
  },
  {
    image: "testimonial_avatars/dimitar.jpeg",
    name: "Dimitar Dimitrov",
    userName: "UX/UI Designer",
    comment:
      "InsightSeek significantly improved our sprint retrospectives. Code and meeting insights in one platform helps identify patterns and improve team velocity.",
    rating: 5,
  },
];
