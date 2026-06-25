import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/supabase/auth-guard";
import { listarTicketsAdmin } from "@/app/actions/admin-tickets";
import { TicketsPanel } from "../components/TicketsPanel";

export const metadata = {
  title: "Tickets Soporte · God Mode",
  robots: { index: false, follow: false },
};

export default async function TicketsPage() {
  try {
    await requireSuperadmin();
  } catch {
    notFound();
  }

  const res = await listarTicketsAdmin();

  return <TicketsPanel ticketsRes={res} />;
}
