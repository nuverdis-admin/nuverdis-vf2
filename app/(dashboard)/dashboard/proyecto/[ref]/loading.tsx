// Skeleton de carga para el overview del proyecto
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-64 bg-gray-2 rounded" />
      <div className="h-5 w-48 bg-gray-2 rounded" />
      <div className="h-24 w-full bg-gray-2 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-2 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
