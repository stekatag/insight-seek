import { headers } from "next/headers";
import { db } from "@/server/db";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set.");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get the headers (await needed)
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing Svix headers");
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying Clerk webhook:", err);
    return new Response("Error occurred during verification", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  // Handle the user.deleted event
  if (eventType === "user.deleted") {
    if (!id) {
      console.error("User deleted event is missing user ID");
      return new Response("Error: Missing user ID in payload", { status: 400 });
    }

    try {
      // Important: Ensure the ID from the webhook matches the ID in your database
      // Clerk user IDs usually look like 'user_xxxxxxxx...'
      await db.user.delete({
        where: {
          id: id, // Use the ID from the webhook payload
        },
      });

      return new Response("User deleted successfully", { status: 200 });
    } catch (dbError: any) {
      // Handle potential errors, e.g., user not found in DB (might have been deleted already)
      if (dbError.code === "P2025") {
        // Prisma code for 'Record to delete does not exist.'
        console.warn(
          `User with ID ${id} not found in database. Already deleted?`,
        );
        return new Response("User not found in DB, assumed already deleted", {
          status: 200,
        });
      } else {
        console.error(`Database error deleting user ${id}:`, dbError);
        return new Response("Database error occurred", { status: 500 });
      }
    }
  }

  return new Response("Webhook received, event processed/ignored", {
    status: 200,
  });
}
