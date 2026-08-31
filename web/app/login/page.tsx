import { BriefcaseBusiness } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth";
import { getRoleHomeRoute } from "@/lib/auth-routes";

export default async function LoginPage() {
  const session = await getAuthSession();
  const destination = getRoleHomeRoute(session?.user.role);
  if (destination) redirect(destination);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md shadow-lg shadow-black/5">
        <CardHeader className="gap-3 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <CardTitle className="text-2xl">Welcome to WorkLens</CardTitle>
          <CardDescription>Sign in to access your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
