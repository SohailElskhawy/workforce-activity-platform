import { redirect } from "next/navigation";

import { getRoleHomeRoute, LOGIN_ROUTE } from "@/lib/auth-routes";
import { getAuthSession } from "@/lib/auth";

export default async function Home() {
  const session = await getAuthSession();

  redirect(getRoleHomeRoute(session?.user.role) ?? LOGIN_ROUTE);
}
