// Layout dedicado al detalle de tarea. No agrega chrome adicional; existe para
// permitir futuros server components (presencia, prefetch de mensajes, etc.).
export default function TareaDetalleLayout({ children }: { children: React.ReactNode }) {
  return <div className="-mt-4">{children}</div>;
}
