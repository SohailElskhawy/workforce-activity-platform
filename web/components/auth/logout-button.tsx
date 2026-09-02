"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LogoutButton({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <Button
      className={className}
      onClick={() => signOut({ callbackUrl: "/login" })}
      variant="outline"
    >
      <LogOut />
      {t.common.navigation.logout}
    </Button>
  );
}

