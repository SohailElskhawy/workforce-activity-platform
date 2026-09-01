"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function ActivityPoller() { const router = useRouter(); useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5_000); return () => window.clearInterval(id); }, [router]); return null; }
