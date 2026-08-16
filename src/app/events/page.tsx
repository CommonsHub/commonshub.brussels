import { redirect } from "next/navigation";

/** /events is where people guess the proposals live. Send them there. */
export default function EventsIndexPage() {
  redirect("/events/proposals");
}
