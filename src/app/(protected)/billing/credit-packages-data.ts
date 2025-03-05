export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price: number;
  regularPrice?: number;
  projectCount: number;
  meetingMinutes: number;
  popular?: boolean;
  discount?: string;
  features: string[];
  highlighted?: boolean;
};

/**
 * Credit package definitions with special pricing
 */
export const creditPackages: CreditPackage[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    price: 2,
    projectCount: 1,
    meetingMinutes: 40,
    features: ["Perfect for small projects", "Single meeting analysis"],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Professional",
    credits: 500,
    price: 8, // Special price (regular would be $10)
    regularPrice: 10,
    projectCount: 5,
    meetingMinutes: 200,
    popular: true,
    discount: "20% off",
    features: [
      "Ideal for medium projects",
      "Multiple meeting analyses",
      "Priority support",
    ],
    highlighted: true, // This is our highlighted package
  },
  {
    id: "team",
    name: "Team",
    credits: 1500,
    price: 20, // Special price (regular would be $30)
    regularPrice: 30,
    projectCount: 15,
    meetingMinutes: 600,
    discount: "33% off",
    features: [
      "Multiple large projects",
      "Team collaboration",
      "Unlimited meeting analyses",
      "Priority support",
    ],
    highlighted: false,
  },
];
