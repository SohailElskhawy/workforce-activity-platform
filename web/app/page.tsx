import { redirect } from "next/navigation";

import { LOGIN_ROUTE } from "@/lib/auth-routes";
import { getAuthSession, getActiveLoginDestination } from "@/lib/auth";

export default async function Home() {
  const session = await getAuthSession();

  redirect((await getActiveLoginDestination(session)) ?? LOGIN_ROUTE);
}
