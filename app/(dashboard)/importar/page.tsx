import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { ImportarClient } from "@/components/importar/importar-client";

export default async function ImportarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "SERIES.CREAR")) redirect("/");

  return <ImportarClient />;
}
