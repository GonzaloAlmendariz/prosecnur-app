import { useMemo } from "react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";
import { nombreDelSegmento } from "../segmentoDeCuotas";
import { Barrido } from "./Barrido";
import { construirBarrido, type CuotaDeBarrido } from "./barridoModel";
import { criteriosDesdeFiltro } from "../../../filtroEfectiva/criterios";
import { Respuestas, type PasoDeLaCadena, type ReglaQueCuenta } from "./Respuestas";
import { construirRespuestas, mermaDeRepetidos } from "./respuestasModel";

/** Segmento de cuota del corte (Sede, Actor…), como en Avance › Cuotas. */
export function segmentoDelCorte(reports: MonitoreoAcreditacionReports | null | undefined) {
  return nombreDelSegmento(filasDeBloque(reports, ["cuotas_variable", "cuotas_telefonicas", "cuotas_por_variable"])
    .map((fila) => String(fila.Variable ?? "")));
}

/** Control › Barrido montado sobre el corte y el vocabulario del proyecto. */
export function BarridoDeLaHoja({
  reports,
  state,
  cuotas,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  cuotas: readonly CuotaDeBarrido[];
}) {
  const reglas = state?.config?.operational_model?.state_rules;
  const modelo = useMemo(
    () => construirBarrido({ reports, reglas: reglas ?? [], cuotas }),
    [reports, reglas, cuotas],
  );
  return <Barrido modelo={modelo} segmento={segmentoDelCorte(reports)} />;
}

function plural(cantidad: number, uno: string, varios: string) {
  return `${cantidad.toLocaleString("es-PE")} ${cantidad === 1 ? uno : varios}`;
}

/** Control › Respuestas sobre el corte y el filtro de efectiva del proyecto. */
export function RespuestasDelCorte({
  reports,
  state,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
}) {
  const segmento = segmentoDelCorte(reports);
  const modelo = useMemo(() => construirRespuestas({ reports, segmento }), [reports, segmento]);
  const filtro = state?.config?.monitoreo_profile?.platform_effective_filter;
  const criterios = useMemo(() => criteriosDesdeFiltro(filtro), [filtro]);
  const fuentesKobo = new Set((state?.sources ?? []).filter((fuente) => fuente.enabled && fuente.kind === "kobo").map((fuente) => fuente.id));
  const encuestas = Object.values(state?.source_metadata?.surveys ?? {}).filter((encuesta) => fuentesKobo.has(encuesta.source_id));
  const recibidas = encuestas.reduce((suma, encuesta) => suma + (Number(encuesta.response_count) || 0), 0);
  const textoDeCriterios = criterios.map((criterio) => `${criterio.label || criterio.variable}: ${criterio.value_label || criterio.values.join(" o ")}`);

  const cadena: PasoDeLaCadena[] = [
    ...(recibidas ? [{ nombre: "Recibidas en Kobo", valor: recibidas, detalle: encuestas.map((e) => e.title || e.label || "").filter(Boolean).join(" y ") }] : []),
    {
      nombre: "Pasan el filtro de efectiva",
      valor: modelo.envios.length,
      detalle: textoDeCriterios.join(" y ") || "Filtro de efectiva sin declarar",
      merma: recibidas > modelo.envios.length ? `${plural(recibidas - modelo.envios.length, "queda fuera", "quedan fuera")} del filtro o son de prueba` : undefined,
    },
    {
      nombre: "Efectivas",
      valor: modelo.unicas,
      detalle: "Un envío por CodPulso",
      merma: mermaDeRepetidos(modelo),
    },
  ];
  const reglas: ReglaQueCuenta[] = [
    ...textoDeCriterios.map((texto) => ({ texto, tipo: "filtro" as const })),
    { texto: "Un envío por CodPulso", tipo: "regla" },
    { texto: "Más de 2 h o menos de 5 min", tipo: "aviso" },
  ];
  return <Respuestas modelo={modelo} cadena={cadena} reglas={reglas} segmento={segmento} />;
}
