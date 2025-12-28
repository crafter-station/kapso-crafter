import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { generateText } from "ai";

// Initialize WhatsApp client lazily
function getWhatsAppClient() {
  const apiKey = process.env.KAPSO_API_KEY;
  if (!apiKey) {
    throw new Error("KAPSO_API_KEY environment variable is required");
  }
  return new WhatsAppClient({
    baseUrl: "https://api.kapso.ai/meta/whatsapp",
    kapsoApiKey: apiKey,
  });
}

// Kapso structured webhook payload types
interface KapsoWebhookPayload {
  message: {
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    from: string;
    kapso?: {
      direction: "inbound" | "outbound";
      status: string;
    };
  };
  conversation: {
    id: string;
    phone_number: string;
    phone_number_id: string;
  };
  phone_number_id: string;
  is_new_conversation: boolean;
  test?: boolean;
}

export async function POST(request: Request) {
  console.log("=== WEBHOOK RECEIVED ===");

  const payload: KapsoWebhookPayload = await request.json();
  console.log("Payload:", JSON.stringify(payload, null, 2));

  const { message, phone_number_id: phoneNumberId } = payload;

  // Only respond to inbound text messages
  if (message?.kapso?.direction !== "inbound" || message?.type !== "text") {
    console.log("Skipping - not an inbound text message");
    return new Response("OK", { status: 200 });
  }

  const userMessage = message.text?.body;
  const senderNumber = message.from.replace(/\D/g, ""); // Remove non-digits

  console.log("Processing message:", {
    userMessage,
    senderNumber,
    phoneNumberId,
  });

  if (!userMessage || !phoneNumberId) {
    console.log("Skipping - missing userMessage or phoneNumberId");
    return new Response("OK", { status: 200 });
  }

  try {
    console.log("Generating AI response...");
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      system:
        "You are a helpful assistant responding via WhatsApp. Keep responses concise and friendly.",
      prompt: userMessage,
    });
    console.log("AI response generated:", text);

    console.log("Sending reply via Kapso API...");
    const whatsappClient = getWhatsAppClient();
    const sendResult = await whatsappClient.messages.sendText({
      phoneNumberId: phoneNumberId,
      to: senderNumber,
      body: text,
    });
    console.log("Send result:", sendResult);

    console.log(`Replied to ${senderNumber}: ${text.substring(0, 50)}...`);
  } catch (error) {
    console.error("Error processing message:", error);
  }

  console.log("=== WEBHOOK COMPLETE ===");
  return new Response("OK", { status: 200 });
}
