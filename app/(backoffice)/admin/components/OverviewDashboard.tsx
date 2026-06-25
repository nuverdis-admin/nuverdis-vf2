"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { LoginsChart } from "./LoginsChart";
import { ResendDonut } from "./ResendDonut";
import type { DashboardStatsResult } from "@/app/actions/admin-stats";
import type { VercelResult, ResendResult } from "@/app/actions/admin-infra";

// God Mode — Dashboard (tema oscuro Vercel/Supabase).
// h-full + overflow-y-auto: scrollea internamente, nunca scroll global.

function KpiCard({
  titulo,
  valor,
  sub,
  gradient,
}: {
  titulo: string;
  valor: string;
  sub: string;
  gradient: string;
}) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {titulo}
      </p>
      <p className="mt-2 text-3xl font-bold">{valor}</p>
      <p className="mt-1 text-xs opacity-80">{sub}</p>
    </div>
  );
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OverviewDashboard({
  stats,
  vercel,
  resend,
}: {
  stats: DashboardStatsResult;
  vercel: VercelResult;
  resend: ResendResult;
}) {
  const ultimoDeploy =
    vercel.ok && vercel.deployments.length > 0 ? vercel.deployments[0] : null;
  const deployGradient =
    ultimoDeploy?.estado === "READY"
      ? "from-primary-5 to-primary-7"
      : ultimoDeploy?.estado === "ERROR"
        ? "from-critique-5 to-critique-7"
        : "from-warning-5 to-warning-7";

  const stat = resend.ok ? resend.stats : null;
  const tasaError =
    stat && stat.enviados > 0
      ? ((stat.rebotados / stat.enviados) * 100).toFixed(1)
      : "0";

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-4">
            God Mode · Dashboard
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#EDEDED]">
            Vista global de la plataforma
          </h1>
        </header>

        {/* KPIs con degradado */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            titulo="Último deploy"
            valor={ultimoDeploy?.estado ?? "—"}
            sub={vercel.ok && vercel.demo ? "Vercel · demo" : "Vercel"}
            gradient={deployGradient}
          />
          <KpiCard
            titulo="Correos enviados"
            valor={stat ? String(stat.enviados) : "—"}
            sub={resend.ok && resend.demo ? "Resend · demo" : "Resend"}
            gradient="from-info-5 to-info-7"
          />
          <KpiCard
            titulo="Tasa de rebote"
            valor={`${tasaError}%`}
            sub={stat ? `${stat.rebotados} rebotados` : "Resend"}
            gradient={
              Number(tasaError) > 5
                ? "from-critique-5 to-critique-7"
                : "from-secondary-5 to-secondary-7"
            }
          />
          <KpiCard
            titulo="Usuarios totales"
            valor={stats.ok ? String(stats.totalUsuarios) : "—"}
            sub="En toda la plataforma"
            gradient="from-primary-6 to-secondary-7"
          />
        </div>

        {!stats.ok ? (
          <Card>
            <CardContent className="p-5 text-sm text-critique-5">
              {stats.error}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Gráficos */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Inicios de sesión · últimos 7 días</CardTitle>
                </CardHeader>
                <CardContent>
                  <LoginsChart data={stats.logins7d} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Estado de correos</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  {stat ? (
                    <ResendDonut
                      entregados={stat.entregados}
                      rebotados={stat.rebotados}
                    />
                  ) : (
                    <p className="py-10 text-sm text-[#8C8C8C]">
                      Sin datos de Resend.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Actividad de RPCs + pg_cron */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Actividad de RPCs / acciones (30 días)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Acción</TableHead>
                        <TableHead className="text-right">Veces</TableHead>
                        <TableHead>Última</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.acciones.slice(0, 10).map((a) => (
                        <TableRow key={a.accion}>
                          <TableCell className="font-medium text-[#EDEDED]">
                            {a.accion}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary-4">
                            {a.total}
                          </TableCell>
                          <TableCell className="text-xs text-[#8C8C8C]">
                            {fechaCorta(a.ultima)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Jobs programados (pg_cron)</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.cron.length === 0 ? (
                    <p className="py-6 text-sm text-[#8C8C8C]">
                      No hay jobs programados.
                    </p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead>Última ejecución</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.cron.map((c) => {
                            const ok = c.lastStatus === "succeeded";
                            return (
                              <TableRow key={c.jobid}>
                                <TableCell className="font-medium text-[#EDEDED]">
                                  {c.jobname || `job ${c.jobid}`}
                                </TableCell>
                                <TableCell className="text-xs text-[#8C8C8C]">
                                  {c.schedule}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      c.lastStatus == null
                                        ? "bg-[#2A2A2A] text-[#A1A1A1]"
                                        : ok
                                          ? "bg-primary-7 text-primary-1"
                                          : "bg-critique-7 text-critique-1"
                                    }`}
                                  >
                                    {c.lastStatus ?? "sin ejecuciones"}
                                  </span>
                                  <span className="ml-2 text-xs text-[#707070]">
                                    {fechaCorta(c.lastRun)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {stats.cron.some((c) => c.lastMessage) && (
                        <div className="mt-3 space-y-1 border-t border-[#2A2A2A] pt-3">
                          {stats.cron
                            .filter((c) => c.lastMessage)
                            .map((c) => (
                              <p
                                key={c.jobid}
                                className="text-[11px] text-[#8C8C8C]"
                              >
                                <span className="font-semibold text-[#D4D4D4]">
                                  {c.jobname}:
                                </span>{" "}
                                {c.lastMessage}
                              </p>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
