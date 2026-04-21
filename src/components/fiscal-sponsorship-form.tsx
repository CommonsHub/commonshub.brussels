"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface FormState {
  name: string;
  email: string;
  collective: string;
  website: string;
  project: string;
  finance: string;
}

const INITIAL: FormState = {
  name: "",
  email: "",
  collective: "",
  website: "",
  project: "",
  finance: "",
};

function buildMessage(data: FormState): string {
  return [
    `Collective: ${data.collective}`,
    `Website: ${data.website || "—"}`,
    "",
    "About the project:",
    data.project,
    "",
    "About the finances:",
    data.finance,
  ].join("\n");
}

export function FiscalSponsorshipForm() {
  const [formData, setFormData] = useState<FormState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (submitStatus !== "idle") {
      setSubmitStatus("idle");
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage(null);

    const message = buildMessage(formData);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          organisation: formData.collective,
          reason: "fiscal-sponsorship",
          message,
        }),
      });

      if (response.ok) {
        setSubmitStatus("success");
        setFormData(INITIAL);
      } else {
        const data = await response.json().catch(() => ({}));
        setSubmitStatus("error");
        setErrorMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-background p-6 md:p-8 rounded-lg border border-border"
    >
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">
            Your name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            required
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="your@email.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="collective">
          Name of your collective <span className="text-destructive">*</span>
        </Label>
        <Input
          id="collective"
          required
          value={formData.collective}
          onChange={(e) => updateField("collective", e.target.value)}
          placeholder="e.g. Genesis, OpenLetter"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website of your collective or project</Label>
        <Input
          id="website"
          type="url"
          value={formData.website}
          onChange={(e) => updateField("website", e.target.value)}
          placeholder="https://"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project">
          Tell us more about your project <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="project"
          required
          value={formData.project}
          onChange={(e) => updateField("project", e.target.value)}
          placeholder="Purpose, link with the commons or open source, what you're building, who's involved…"
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="finance">
          Tell us more about the finances of your project <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="finance"
          required
          value={formData.finance}
          onChange={(e) => updateField("finance", e.target.value)}
          placeholder="Sources of income, expected income, main costs…"
          rows={5}
        />
      </div>

      {submitStatus === "success" && (
        <div
          className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm"
          role="status"
          aria-live="polite"
        >
          Application received. We&apos;ll review it and get back to you soon.
        </div>
      )}

      {submitStatus === "error" && (
        <div
          className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage ||
            "Something went wrong. Please try again or email us directly at hello@commonshub.brussels"}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full cursor-pointer disabled:cursor-not-allowed"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          "Submitting…"
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit application
          </>
        )}
      </Button>
    </form>
  );
}
