// api/webhook/stripe

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe-config";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("Stripe-Signature") as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  console.log(event.type);

  if (event.type === "checkout.session.completed") {
    const credits = Number(session.metadata?.credits);
    const userId = session.client_reference_id;

    if (!userId || !credits) {
      return NextResponse.json(
        { error: "Missing userId or credits" },
        { status: 400 },
      );
    }

    await db.stripeTransaction.create({ data: { userId, credits } });
    await db.user.update({
      where: { id: userId },
      data: { credits: { increment: credits } },
    });

    return NextResponse.json(
      { message: "Credits added successfully" },
      { status: 200 },
    );
  }

  return NextResponse.json({ message: "Event not handled" }, { status: 200 });
}
