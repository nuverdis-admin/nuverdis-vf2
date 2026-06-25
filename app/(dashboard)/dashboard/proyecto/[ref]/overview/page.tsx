import { redirect } from "next/navigation";

interface Props {
  params: { ref: string };
}

export default function OverviewLegacyPage({ params }: Props) {
  redirect(`/dashboard/proyecto/${params.ref}`);
}
