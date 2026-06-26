// Redirect permanente a la ruta canónica del proyecto
import { redirect } from 'next/navigation'

export default function Vf2ProyectoRedirect({ params }: { params: { ref: string } }) {
  redirect(`/dashboard/proyecto/${params.ref}`)
}
