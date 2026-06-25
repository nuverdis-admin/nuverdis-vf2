import { redirect } from "next/navigation";

export default function TipoIndexPage({
  params,
}: {
  params: { ref: string; tipo: string };
}) {
  redirect(`/dashboard/proyecto/${params.ref}/${params.tipo}/seguimiento`);
}
