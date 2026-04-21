import { Resend } from "resend"
import { NextResponse } from "next/server"
import { createDiscordThread } from "@/lib/discord"
import settings from "@/settings/settings.json"

const reasonLabels: Record<string, string> = {
  "booking-room": "Booking a room",
  "joining-community": "Joining the community",
  "fiscal-sponsorship": "Fiscal sponsorship application",
  research: "Research",
  visit: "Visit",
  media: "Media",
  other: "Other",
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    const { name, email, organisation, reason, message } = data

    // Spam protection: reject short messages
    const messageLength = message?.length || 0
    const wordCount = message?.trim().split(/\s+/).filter(Boolean).length || 0
    
    if (messageLength < 100 || wordCount < 20) {
      return NextResponse.json(
        { error: "Message is too short. Please provide more details (at least 100 characters and 20 words)." },
        { status: 400 }
      )
    }

    // Initialize Resend client at runtime, not at build time
    const resend = new Resend(process.env.RESEND_API_KEY)

    const reasonLabel = reasonLabels[reason] || reason

    // Email to Commons Hub
    await resend.emails.send({
      from: "Commons Hub Brussels <hello@commonshub.brussels>",
      to: ["hello@commonshub.brussels"],
      cc: [email],
      subject: `New Contact Form: ${reasonLabel} - ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>

        <h3>Contact Details</h3>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          ${organisation ? `<li><strong>Organisation/Community:</strong> ${organisation}</li>` : ""}
          <li><strong>Reason:</strong> ${reasonLabel}</li>
        </ul>

        <h3>Message</h3>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    })

    // Confirmation email to the sender
    await resend.emails.send({
      from: "Commons Hub Brussels <hello@commonshub.brussels>",
      to: [email],
      subject: `We received your message - Commons Hub Brussels`,
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>Hi ${name},</p>
        <p>We have received your message regarding <strong>${reasonLabel}</strong>.</p>

        <h3>Your Message</h3>
        <p>${message.replace(/\n/g, "<br>")}</p>

        <p>We will review your message and get back to you as soon as possible.</p>

        <p>Best regards,<br>The Commons Hub Brussels Team</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 12px; color: #718096;">
          Commons Hub Brussels<br>
          Rue de la Madeleine 51, 1000 Brussels<br>
          <a href="mailto:hello@commonshub.brussels">hello@commonshub.brussels</a>
        </p>
      `,
    })

    const discordContent = `📬 **New Contact Form Submission**

**Contact:** ${name} (${email})${organisation ? `\n**Organisation/Community:** ${organisation}` : ""}
**Reason:** ${reasonLabel}

**Message:**
${message}`

    await createDiscordThread(settings.discord.channels.requests, `📬 Contact: ${reasonLabel} - ${name}`, discordContent)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing contact form:", error)
    return NextResponse.json({ error: "Failed to process contact form" }, { status: 500 })
  }
}
