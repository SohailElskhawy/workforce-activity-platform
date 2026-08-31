import { ShieldCheck } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardPlaceholderProps = {
  email: string | null | undefined;
  role: string;
  title: string;
};

export function DashboardPlaceholder({ email, role, title }: DashboardPlaceholderProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-xl shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>
            Your role and tenant are verified on the server before this page is rendered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">Signed in as</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">Role</span>
            <Badge>{role}</Badge>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <LogoutButton />
        </CardFooter>
      </Card>
    </main>
  );
}
