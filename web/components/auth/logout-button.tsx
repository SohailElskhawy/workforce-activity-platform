"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      className={className}
      onClick={() => signOut({ callbackUrl: "/login" })}
      variant="outline"
    >
      <LogOut />
      Logout
    </Button>
  );
}
