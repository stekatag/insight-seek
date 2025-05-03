"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export async function createCheckoutSession(
  credits: number,
  priceOverride?: number,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not found");
  }

  // Calculate the price in cents - use overridden price if provided, otherwise use standard rate
  const unitAmount = priceOverride
    ? Math.round(priceOverride * 100)
    : Math.round((credits / 50) * 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${credits} InsightSeek Credits`,
            description: priceOverride
              ? "Special package pricing"
              : "Standard pricing",
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    customer_creation: "always",
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?credits=${credits}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    client_reference_id: userId.toString(),
    metadata: {
      credits,
    },
  });

  return redirect(session.url!);
}
