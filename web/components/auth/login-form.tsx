"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRoleHomeRoute } from "@/lib/auth-routes";
import { type LoginCredentials, loginSchema } from "@/lib/validation/auth";

export function LoginForm() {
  const router = useRouter();
  const [authenticationError, setAuthenticationError] = useState<string | null>(
    null,
  );
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginCredentials>({
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(credentials: LoginCredentials) {
    setAuthenticationError(null);

    try {
      const result = await signIn("credentials", {
        ...credentials,
        redirect: false,
      });

      if (!result || result.error) {
        setAuthenticationError("Invalid email or password.");
        return;
      }

      const session = await getSession();
      const destination = getRoleHomeRoute(session?.user.role);

      if (!destination) {
        setAuthenticationError(
          "Unable to start your session. Please sign in again.",
        );
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setAuthenticationError("Unable to sign in right now. Please try again.");
    }
  }

  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          disabled={isSubmitting}
          id="email"
          placeholder="you@company.com"
          type="email"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-sm text-destructive" id="email-error">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          aria-describedby={errors.password ? "password-error" : undefined}
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          disabled={isSubmitting}
          id="password"
          type="password"
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-sm text-destructive" id="password-error">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      {authenticationError ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {authenticationError}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={isSubmitting}
        size="lg"
        type="submit"
      >
        {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        {isSubmitting ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
