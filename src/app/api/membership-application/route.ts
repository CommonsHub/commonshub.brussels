import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createDiscordThread } from "@/lib/discord"
import settings from "@/settings/settings.json"
import { formatAddress, fromSite, fromSubmitter } from "@/lib/email-address"

export async function POST(request: Request) {
  try {
    // Initialize Resend client at runtime, not at build time
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { name, organisation, email, plan, motivation } = await request.json()

    if (!name || !email || !plan || !motivation) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Send notification email to Commons Hub
    await resend.emails.send({
      from: fromSubmitter(name),
      to: "hello@commonshub.brussels",
      replyTo: formatAddress(name, email),
      subject: `New Membership Application: ${name}`,
      html: `
        <h2>New Membership Application</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Organisation/Community:</strong> ${organisation || "N/A"}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Membership Plan:</strong> ${plan}</p>
        <h3>Motivation:</h3>
        <p>${motivation.replace(/\n/g, "<br>")}</p>
      `,
    })

    // Send confirmation email to applicant
    await resend.emails.send({
      from: fromSite(),
      to: formatAddress(name, email),
      subject: "We received your membership application!",
      html: `
        <h2>Thank you for your application, ${name}!</h2>
        <p>We have received your application to join Commons Hub Brussels.</p>
        <p><strong>Selected Plan:</strong> ${plan}</p>
        <p>Our team will review your application and get back to you shortly.</p>
        <p>In the meantime, feel free to join our Discord community and attend our open events!</p>
        <br>
        <p>Warm regards,<br>The Commons Hub Brussels Team</p>
      `,
    })

    const discordContent = `👋 **New Membership Application**

**Name:** ${name}
**Email:** ${email}
${organisation ? `**Organisation:** ${organisation}` : ""}
**Plan:** ${plan}

**Motivation:**
${motivation}`

    await createDiscordThread(settings.discord.channels.requests, `👤 Membership: ${name} - ${plan}`, discordContent)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json({ error: "Failed to send application. Please try again." }, { status: 500 })
  }
}
