"use server";

import { z } from "zod";
import { randomUUID } from "@/lib/uuid";
import { appendContactMessage } from "@/lib/services/cms";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export interface ContactFormState {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    message: formData.get("message") as string,
  };

  const result = contactSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      message: "Please fix the errors below",
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await appendContactMessage({
      id: randomUUID(),
      name: result.data.name,
      email: result.data.email,
      subject: result.data.phone
        ? `Contact from ${result.data.name} (${result.data.phone})`
        : `Contact from ${result.data.name}`,
      message: result.data.message,
      status: "inbox",
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Thank you for reaching out. We'll be in touch soon.",
    };
  } catch {
    return {
      success: false,
      message: "Something went wrong. Please try again.",
    };
  }
}
