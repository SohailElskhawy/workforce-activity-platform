import { BriefcaseBusiness } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth";
import { getRoleHomeRoute } from "@/lib/auth-routes";
import { getServerDictionary } from "@/lib/i18n/server";

export default async function LoginPage() {
  const session = await getAuthSession();
  const destination = getRoleHomeRoute(session?.user.role);
  if (destination) redirect(destination);

  const t = await getServerDictionary();

  return (
    <main className="relative flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-lg shadow-black/5">
        <CardHeader className="gap-3 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <CardTitle className="text-2xl">{t.auth.title}</CardTitle>
          <CardDescription>{t.auth.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}

