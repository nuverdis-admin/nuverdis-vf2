// Redirect permanente a la ruta canónica de la tarea
import { redirect } from 'next/navigation'

export default function Vf2TareaRedirect({ params }: { params: { ref: string; colRef: string; tareaRef: string } }) {
  redirect(`/dashboard/proyecto/${params.ref}/coleccion/${params.colRef}/tarea/${params.tareaRef}`)
}
