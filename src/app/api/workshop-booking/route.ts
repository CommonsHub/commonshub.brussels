import { Resend } from "resend"
import { NextResponse } from "next/server"
import { createDiscordThread } from "@/lib/discord"
import settings from "@/settings/settings.json"

export async function POST(request: Request) {
  try {
    // Initialize Resend client at runtime, not at build time
    const resend = new Resend(process.env.RESEND_API_KEY)

    const body = await request.json()
    const { name, organisation, numberOfPeople, date, time, place, comment, workshop, email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Send notification to Commons Hub
    await resend.emails.send({
      from: "Commons Hub Brussels <hello@commonshub.brussels>",
      to: ["hello@commonshub.brussels"],
      replyTo: email,
      subject: `Workshop Booking Request: ${workshop}`,
      html: `
        <h2>New Workshop Booking Request</h2>
        <p><strong>Workshop:</strong> ${workshop}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Organisation:</strong> ${organisation || "Not specified"}</p>
        <p><strong>Number of People:</strong> ${numberOfPeople}</p>
        <p><strong>Preferred Date:</strong> ${date}</p>
        <p><strong>Preferred Time:</strong> ${time}</p>
        <p><strong>Location:</strong> ${place}</p>
        ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ""}
      `,
    })

    await resend.emails.send({
      from: "Commons Hub Brussels <hello@commonshub.brussels>",
      to: [email],
      cc: ["hello@commonshub.brussels"],
      subject: `Workshop Booking Request Received - ${workshop}`,
      html: `
        <h2>Thank you for your workshop booking request!</h2>
        <p>Hi ${name},</p>
        <p>We have received your request to book the <strong>${workshop}</strong> workshop at Commons Hub Brussels.</p>
        
        <h3>Your Booking Details</h3>
        <ul>
          <li><strong>Workshop:</strong> ${workshop}</li>
          <li><strong>Name:</strong> ${name}</li>
          ${organisation ? `<li><strong>Organisation:</strong> ${organisation}</li>` : ""}
          <li><strong>Number of People:</strong> ${numberOfPeople}</li>
          <li><strong>Preferred Date:</strong> ${date}</li>
          <li><strong>Preferred Time:</strong> ${time}</li>
          <li><strong>Location:</strong> ${place}</li>
        </ul>
        
        ${comment ? `<h3>Your Comments</h3><p>${comment}</p>` : ""}
        
        <p>We will review your request and get back to you shortly to confirm your booking and discuss pricing.</p>
        
        <p>Best regards,<br>The Commons Hub Brussels Team</p>
      `,
    })

    const discordContent = `🎓 **New Workshop Booking Request**

**Workshop:** ${workshop}
**Name:** ${name}
**Email:** ${email}
${organisation ? `**Organisation:** ${organisation}` : ""}
**People:** ${numberOfPeople}
**Date:** ${date}
**Time:** ${time}
**Location:** ${place}
${comment ? `**Comment:** ${comment}` : ""}`

    await createDiscordThread(settings.discord.channels.requests, `🎓 Workshop: ${workshop} - ${name}`, discordContent)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending workshop booking email:", error)
    return NextResponse.json({ error: "Failed to send booking request" }, { status: 500 })
  }
}
