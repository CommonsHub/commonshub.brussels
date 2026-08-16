/**
 * Notification services for sending emails and Discord messages
 * These are extracted into testable functions
 */

import { Resend } from "resend"
import settings from "@/settings/settings.json"
import { createThread, sendMessage, isDiscordConfigured } from "@/lib/discord"

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface EmailOptions {
  to: string
  subject: string
  html: string
  cc?: string[]
  replyTo?: string
}

export interface DiscordThreadOptions {
  channelId: string
  threadName: string
  content: string
}

/**
 * Send an email using Resend
 * If RESEND_API_KEY is not set, logs a warning instead
 */
/**
 * Which address we send from. It has to be one the API key is allowed to use —
 * a key restricted to a domain answers 403 for anything else — so deployments
 * on another domain set EMAIL_FROM.
 */
export function emailFrom(): string {
  return process.env.EMAIL_FROM || settings.email.from
}

export async function sendEmail(options: EmailOptions) {
  const { to, subject, html, cc, replyTo } = options

  if (!resend) {
    console.warn(`⚠️  Email not sent (RESEND_API_KEY not set): ${subject}`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    return {
      id: 'mock-email-id',
      error: null,
    };
  }

  const result = await resend.emails.send({
    from: `Commons Hub <${emailFrom()}>`,
    to,
    subject,
    html,
    cc,
    replyTo,
  })

  // Resend reports refusals in the body rather than by throwing. Ignoring that
  // is how "sent" ends up meaning "rejected, and nobody noticed".
  if (result.error) {
    console.error(
      `[email] Resend refused "${subject}" from ${emailFrom()}: ${result.error.message}`,
    )
  }

  return result
}

/**
 * Create a Discord thread and post a message
 * Use centralized Discord client
 */
export async function createDiscordThread(options: DiscordThreadOptions) {
  const { channelId, threadName, content } = options

  if (!isDiscordConfigured()) {
    console.error("DISCORD_BOT_TOKEN not set")
    return null
  }

  try {
    // Create thread
    const thread = await createThread(channelId, { name: threadName })

    // Post message to thread
    await sendMessage(thread.id, content)

    return thread
  } catch (error) {
    console.error("Failed to create Discord thread:", error)
    return null
  }
}

/**
 * Send booking confirmation email to customer
 */
export async function sendBookingConfirmation(data: {
  email: string
  name: string
  type: "room" | "workshop"
  details: string
}) {
  return sendEmail({
    to: data.email,
    subject: `Booking Request Received - Commons Hub`,
    html: `
      <h1>Thank you for your booking request, ${data.name}!</h1>
      <p>We have received your ${data.type} booking request with the following details:</p>
      <pre>${data.details}</pre>
      <p>We will get back to you shortly to confirm your booking.</p>
      <p>Best regards,<br>The Commons Hub Team</p>
    `,
    cc: [settings.email.to],
  })
}

/**
 * Send notification to Commons Hub about a new request
 */
export async function sendRequestNotification(data: {
  type: string
  subject: string
  html: string
  /** Email of the person who submitted the form, so a reply reaches them */
  replyTo?: string
}) {
  return sendEmail({
    to: settings.email.to,
    subject: data.subject,
    html: data.html,
    replyTo: data.replyTo,
  })
}

/**
 * Create a Discord thread for a new request
 */
export async function createRequestThread(data: {
  title: string
  content: string
}) {
  return createDiscordThread({
    channelId: settings.discord.channels.requests,
    threadName: data.title,
    content: data.content,
  })
}
