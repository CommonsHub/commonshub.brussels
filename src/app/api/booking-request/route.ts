import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createDiscordThread } from "@/lib/discord";
import settings from "@/settings/settings.json";
import { formatAddress, fromSite, fromSubmitter } from "@/lib/email-address";

const roomNames: Record<string, string> = {
  mush: "Mush Room",
  angel: "Angel Room",
  satoshi: "Satoshi Room",
  ostrom: "Ostrom Room",
  playroom: "Playroom",
};

export async function POST(request: Request) {
  try {
    // Initialize Resend client at runtime, not at build time
    const resend = new Resend(process.env.RESEND_API_KEY);

    const data = await request.json();

    const {
      name,
      email,
      organisation,
      numberOfPeople,
      dateTime,
      duration,
      room,
      projector,
      whiteboard,
      facilitationKit,
      coffeeTea,
      snacks,
      isPrivate,
      additionalNotes,
    } = data;

    const roomName = roomNames[room] || room;
    const formattedDate = new Date(dateTime).toLocaleString("en-BE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const options = [
      projector && "Projector",
      whiteboard && "Whiteboard",
      facilitationKit && "Facilitation kit (post-its, pens, flipchart)",
      coffeeTea && "Coffee/Tea",
      snacks && "Snacks",
    ].filter(Boolean);

    // Email to Commons Hub
    await resend.emails.send({
      from: fromSubmitter(name),
      to: ["hello@commonshub.brussels"],
      replyTo: formatAddress(name, email),
      subject: `${isPrivate ? "[PRIVATE] " : ""}New Booking Request: ${roomName} - ${name}`,
      html: `
        <h2>New Booking Request</h2>
        ${isPrivate ? '<p style="color: #c53030; font-weight: bold;">⚠️ This is a PRIVATE request - to be handled by paid staff</p>' : '<p style="color: #2f855a;">This is a public request - can be picked up by community members</p>'}
        
        <h3>Contact Details</h3>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          ${organisation ? `<li><strong>Organisation:</strong> ${organisation}</li>` : ""}
        </ul>
        
        <h3>Booking Details</h3>
        <ul>
          <li><strong>Room:</strong> ${roomName}</li>
          <li><strong>Number of People:</strong> ${numberOfPeople}</li>
          <li><strong>Date & Time:</strong> ${formattedDate}</li>
          <li><strong>Duration:</strong> ${duration} hour(s)</li>
        </ul>
        
        ${
          options.length > 0
            ? `
        <h3>Options Requested</h3>
        <ul>
          ${options.map((opt) => `<li>${opt}</li>`).join("")}
        </ul>
        `
            : ""
        }
        
        ${
          additionalNotes
            ? `
        <h3>Additional Notes</h3>
        <p>${additionalNotes}</p>
        `
            : ""
        }
      `,
    });

    // Confirmation email to the requester
    await resend.emails.send({
      from: fromSite(),
      to: [formatAddress(name, email)],
      subject: `Booking Request Received - ${roomName}`,
      html: `
        <h2>Thank you for your booking request!</h2>
        <p>Hi ${name},</p>
        <p>We have received your booking request for the <strong>${roomName}</strong> at Commons Hub Brussels.</p>
        
        <h3>Your Booking Details</h3>
        <ul>
          <li><strong>Room:</strong> ${roomName}</li>
          <li><strong>Number of People:</strong> ${numberOfPeople}</li>
          <li><strong>Date & Time:</strong> ${formattedDate}</li>
          <li><strong>Duration:</strong> ${duration} hour(s)</li>
        </ul>
        
        ${
          options.length > 0
            ? `
        <h3>Options Requested</h3>
        <ul>
          ${options.map((opt) => `<li>${opt}</li>`).join("")}
        </ul>
        `
            : ""
        }
        
        <p>We will review your request and get back to you shortly to confirm your booking.</p>
        
        <p>Best regards,<br>The Commons Hub Brussels Team</p>
      `,
    });

    // Format date concisely for thread title (e.g., "Feb 15")
    const shortDate = new Date(dateTime).toLocaleDateString("en-BE", {
      month: "short",
      day: "numeric",
    });

    // Concise thread title - just room, date, and name
    const threadTitle = `${roomName} · ${shortDate} · ${name}`;

    // Detailed first message with all booking info
    const discordContent = `📅 **New Booking Request**
${isPrivate ? "🔒 **PRIVATE** - to be handled by paid staff" : "🌐 Public request - can be picked up by community members"}

**Contact:** ${name} (${email})${organisation ? `\n**Organisation:** ${organisation}` : ""}
**Room:** ${roomName}
**People:** ${numberOfPeople}
**Date:** ${formattedDate}
**Duration:** ${duration} hour(s)
${options.length > 0 ? `**Options:** ${options.join(", ")}` : ""}
${additionalNotes ? `**Notes:** ${additionalNotes}` : ""}`;

    await createDiscordThread(
      settings.discord.channels.requests,
      threadTitle,
      discordContent,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending booking request:", error);
    return NextResponse.json(
      { error: "Failed to send booking request" },
      { status: 500 },
    );
  }
}
