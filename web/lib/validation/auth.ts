import { z } from "zod";

/**
 * Shared at both form and authorization boundaries. Passwords are deliberately
 * not trimmed or normalized because every character is part of the credential.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password must be 128 characters or fewer."),
});

export type LoginCredentials = z.infer<typeof loginSchema>;
