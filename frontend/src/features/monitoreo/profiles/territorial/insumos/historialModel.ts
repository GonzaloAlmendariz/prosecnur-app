import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { fechaYHoraDeLima, fmt, rotuloDeAplicador } from "../rotulos";

/**
 * Insumos › Historial (territorial.md §3.4): cada lectura de las fuentes con
 * cuántas respuestas trajo y cuántas eran nuevas (la diferencia con la lectura
 * anterior de la misma fuente), y las otras acciones registradas
 * (subsanaciones y anulaciones). Horas en Lima.
 */

export type LecturaDelHistorial = {
  id: string;
  cuando: string;
  orden: string;
  accion: string;
  fuente: string;
  respuestas: number | null;
  nuevas: number | null;
  resultado: string;
  tono: "ok" | "aviso" | "error";
};

export type OtraAccion = { id: string; cuando: string; orden: string; texto: string };

export type ModeloHistorial = {
  lecturas: LecturaDelHistorial[];
  serie: Array<{ cuando: string; respuestas: number }>;
  otras: OtraAccion[];
};

function n(valor: unknown): number | null {
  const numero = Number(valor);
  return valor != null && valor !== "" && Number.isFinite(numero) ? numero : null;
}

const ACCION: Record<string, string> = { sync: "Traer", inspect: "Releer ficha" };

export function construirHistorial(
  state: MonitoreoState | null | undefined,
  reports: MonitoreoTerritorialDashboard | null | undefined,
  fuenteActiva = "",
): ModeloHistorial {
  const entradas = [...(state?.territorial_update_history ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const anterior = new Map<string, number>();
  const lecturas: LecturaDelHistorial[] = entradas.map((entrada) => {
    const fuente = String(entrada.source_id || entrada.asset_uid || "");
    const respuestas = n(entrada.response_count);
    let nuevas: number | null = null;
    if (entrada.type === "sync" && respuestas != null) {
      const previo = anterior.get(fuente);
      nuevas = previo == null ? null : respuestas - previo;
      anterior.set(fuente, respuestas);
    }
    const estado = String(entrada.status ?? "");
    return {
      id: String(entrada.id),
      cuando: fechaYHoraDeLima(entrada.created_at),
      orden: String(entrada.created_at ?? ""),
      accion: ACCION[String(entrada.type)] ?? "Otra lectura",
      fuente: String(entrada.asset_name || entrada.source_id || "Fuente sin nombre"),
      respuestas,
      nuevas,
      resultado: estado === "error" ? `Falló: ${entrada.message || "sin detalle"}` : estado === "warning" ? `Con aviso: ${entrada.message || "sin detalle"}` : "Correcta",
      tono: estado === "error" ? "error" : estado === "warning" ? "aviso" : "ok",
    };
  });

  const serie = entradas
    .filter((entrada) => entrada.type === "sync" && (!fuenteActiva || entrada.source_id === fuenteActiva || entrada.asset_uid === fuenteActiva))
    .map((entrada) => ({ cuando: fechaYHoraDeLima(entrada.created_at), respuestas: n(entrada.response_count) ?? 0 }));

  const otras: OtraAccion[] = [];
  const aplicadas = reports?.operational_adjustments?.applied ?? [];
  const porMomento = new Map<string, { estado: string; casos: number; orden: string }>();
  for (const ajuste of aplicadas) {
    const revertida = ajuste.status === "reverted";
    const momento = String(revertida ? ajuste.reverted_at || ajuste.created_at : ajuste.created_at).slice(0, 16);
    const clave = `${revertida ? "revertida" : "aplicada"}|${momento}`;
    const previo = porMomento.get(clave);
    porMomento.set(clave, { estado: revertida ? "revertidas" : "aplicadas", casos: (previo?.casos ?? 0) + 1, orden: momento });
  }
  for (const [clave, item] of porMomento) {
    otras.push({ id: clave, cuando: fechaYHoraDeLima(item.orden), orden: item.orden, texto: `${fmt(item.casos)} ${item.casos === 1 ? "subsanación" : "subsanaciones"} ${item.casos === 1 ? item.estado.replace(/s$/, "") : item.estado}` });
  }
  for (const entrada of reports?.production_annulments?.entries ?? []) {
    otras.push({
      id: entrada.id,
      cuando: fechaYHoraDeLima(entrada.created_at),
      orden: String(entrada.created_at ?? ""),
      texto: entrada.scope === "response"
        ? `Anulación de un caso${entrada.status === "reverted" ? " (revertida)" : ""}`
        : `Anulación de la producción de ${rotuloDeAplicador(entrada.responsible_label || entrada.responsible_key)}${entrada.status === "reverted" ? " (revertida)" : ""}`,
    });
  }
  otras.sort((a, b) => b.orden.localeCompare(a.orden));

  return { lecturas: lecturas.reverse(), serie, otras };
}
