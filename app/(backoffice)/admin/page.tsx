import { redirect } from "next/navigation";

// /admin → redirige al módulo principal del God Mode.
export default function AdminIndexPage() {
  redirect("/admin/overview");
}