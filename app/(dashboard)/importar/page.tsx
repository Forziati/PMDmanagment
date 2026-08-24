import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ImportarClient } from "@/components/importar/importar-client";

export default async function ImportarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, "SERIES.CREAR")) redirect("/");
  if (!user.clientId) redirect("/");

  const airports = await prisma.airport.findMany({
    where: { clientId: user.clientId },
    orderBy: { iataCode: "asc" },
  });

  return (
    <ImportarClient
      airports={airports.map((a) => ({ id: a.id, iataCode: a.iataCode, name: a.name }))}
    />
  );
}
