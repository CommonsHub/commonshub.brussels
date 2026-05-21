/**
 * @jest-environment jsdom
 */

import React from "react";
import "@testing-library/jest-dom/jest-globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, jest, beforeEach, test } from "@jest/globals";
import { ContactForm } from "@/components/contact-form";

describe("ContactForm", () => {
  beforeEach(() => {
    global.fetch = jest.fn<typeof fetch>();
    Element.prototype.scrollIntoView = jest.fn<any>();
  });

  async function fillRequiredFields(message: string) {
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByLabelText(/reason for contact/i));
    fireEvent.click(await screen.findByRole("option", { name: "Visit" }));
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: message },
    });
  }

  test("keeps message counters hidden until validation fails", async () => {
    render(<ContactForm />);

    expect(screen.queryByText(/\/ 100 characters/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 20 words/i)).not.toBeInTheDocument();

    await fillRequiredFields("Too short to pass.");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /please provide more details in your message/i
    );
    expect(screen.getByText(/\/ 100 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 20 words/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("shows a success message after sending", async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<ContactForm />);

    await fillRequiredFields(
      "Hello team, I would love to visit the space next week and learn more about the community, membership options, room availability, and the best time to drop by for a first conversation."
    );

    const submitButton = screen.getByRole("button", { name: /send message/i });
    expect(submitButton.className).toContain("cursor-pointer");

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /message sent successfully/i
      );
    });
  });

  test("shows an error message when the request fails", async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unable to send right now." }),
    } as Response);

    render(<ContactForm />);

    await fillRequiredFields(
      "Hello team, I would like to discuss using the space for an event, understand availability, clarify pricing, and make sure the format I have in mind would fit well with the hub and its schedule."
    );

    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /unable to send right now/i
      );
    });
  });
});
