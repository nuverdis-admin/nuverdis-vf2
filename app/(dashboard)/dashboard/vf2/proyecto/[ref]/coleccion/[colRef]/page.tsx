// Redirect permanente a la ruta canónica de la colección
import { redirect } from 'next/navigation'

export default function Vf2ColeccionRedirect({ params }: { params: { ref: string; colRef: string } }) {
  redirect(`/dashboard/proyecto/${params.ref}/coleccion/${params.colRef}`)
}
