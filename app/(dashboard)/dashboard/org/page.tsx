import { redirect } from "next/navigation";
import { getCurrentEmpresa } from "@/lib/proyecto/data";

export default async function OrgIndexPage() {
  const empresa = await getCurrentEmpresa();
  if (empresa?.ref) {
    redirect(`/dashboard/org/${empresa.ref}`);
  }
  redirect("/login");
}
