import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { diaYMes, fmt, nombreDeDistrito, numeroDeUmp, rotuloDeAplicador } from "../rotulos";

/**
 * Control › Anulaciones (territorial.md §3.12): qué quedó fuera del conteo por
 * anulación, por distrito y por UMP, y una tarjeta por anulación activa con
 * «Revertir».
 *
 * `production_annulments$affected_blocks` está tipado en el cliente con la
 * forma de `impact.blocks`, pero el motor lo publica con otros nombres
 * (`block_id`, `responses_annulled`, `valid_annulled`): se lee con los dos.
 */

export type TarjetaDeAnulacion = {
  id: string;
  titulo: string;
  alcance: "produccion" | "caso";
  casos: number | null;
  validos: number | null;
  umps: number | null;
  motivo: string;
  cuando: string;
};

export type UmpAnulada = {
  clave: string;
  ump: string;
  manzana: string;
  distrito: string;
  anuladas: number;
  validasAnuladas: number;
  estadoActual: string;
};

export type ModeloAnulaciones = {
  casosFuera: number;
  umpsAfectadas: number;
  porDistrito: Array<{ distrito: string; casos: number }>;
  activas: TarjetaDeAnulacion[];
  revertidas: number;
  umps: UmpAnulada[];
};

function n(valor: unknown): number | null {
  const numero = Number(valor);
  return valor != null && valor !== "" && Number.isFinite(numero) ? numero : null;
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function cuando(fecha: unknown): string {
  const valor = texto(fecha);
  const hora = valor.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
  return valor ? `${diaYMes(valor)}${hora ? ` ${hora}` : ""}` : "Sin fecha";
}

const ESTADO_DE_UMP: Record<string, string> = {
  complete: "Completa",
  exceeded: "Completa",
  subsanada: "Completa con subsanación",
  pending: "Con celda pendiente",
  partial: "Con celda pendiente",
  in_field: "En campo",
  missing: "Sin casos",
};

export function construirAnulaciones(reports: MonitoreoTerritorialDashboard | null | undefined): ModeloAnulaciones {
  const anulaciones = reports?.production_annulments;
  const filas = anulaciones?.rows ?? [];
  const porDistrito = new Map<string, number>();
  for (const fila of filas) {
    const distrito = texto(fila.district) ? nombreDeDistrito(fila.district) : "Sin distrito";
    porDistrito.set(distrito, (porDistrito.get(distrito) ?? 0) + 1);
  }

  const entradas = anulaciones?.entries ?? [];
  const activas: TarjetaDeAnulacion[] = entradas
    .filter((entrada) => entrada.status === "active")
    .map((entrada) => {
      const caso = entrada.scope === "response";
      return {
        id: entrada.id,
        titulo: caso
          ? `Caso ${texto(entrada.response_label || entrada.response_id).slice(0, 12)}`
          : `${rotuloDeAplicador(entrada.responsible_label || entrada.responsible_key)}, producción completa`,
        alcance: caso ? "caso" : "produccion",
        casos: n(entrada.impact?.responses_excluded),
        validos: n(entrada.impact?.valid_responses_excluded),
        umps: n(entrada.impact?.umps_affected),
        motivo: texto(entrada.reason),
        cuando: cuando(entrada.created_at),
      };
    });

  const estadoPorUmp = new Map(
    (reports?.route_quota_progress?.ump_groups ?? []).map((grupo) => [numeroDeUmp(grupo.ump), String(grupo.status ?? "")]),
  );
  const conRuta = estadoPorUmp.size > 0;
  const crudos = (anulaciones?.affected_blocks ?? []) as unknown as Array<Record<string, unknown>>;
  const umps: UmpAnulada[] = crudos.map((bloque, indice) => {
    const ump = numeroDeUmp(bloque.ump);
    const estado = estadoPorUmp.get(ump);
    return {
      clave: texto(bloque.block_id ?? bloque.id_manzana) || `bloque-${indice}`,
      ump,
      manzana: texto(bloque.manzana),
      distrito: texto(bloque.district ?? bloque.distrito) ? nombreDeDistrito(bloque.district ?? bloque.distrito) : "Sin distrito",
      anuladas: n(bloque.responses_annulled ?? bloque.respuestas_anuladas) ?? 0,
      validasAnuladas: n(bloque.valid_annulled ?? bloque.validas_anuladas) ?? 0,
      estadoActual: !conRuta ? "—" : estado == null ? "No está en la ruta" : ESTADO_DE_UMP[estado.toLowerCase()] ?? "En campo",
    };
  });

  return {
    casosFuera: Math.round(n(anulaciones?.summary?.annulled_responses) ?? filas.length),
    umpsAfectadas: Math.round(n(anulaciones?.summary?.affected_umps) ?? umps.length),
    porDistrito: [...porDistrito.entries()].map(([distrito, casos]) => ({ distrito, casos }))
      .sort((a, b) => Number(a.distrito === "Sin distrito") - Number(b.distrito === "Sin distrito") || b.casos - a.casos),
    activas,
    revertidas: entradas.filter((entrada) => entrada.status === "reverted").length,
    umps,
  };
}

export function resumenDeTarjeta(tarjeta: TarjetaDeAnulacion): string {
  const partes = [
    tarjeta.casos != null ? `${fmt(tarjeta.casos)} casos` : "",
    tarjeta.validos != null ? `${fmt(tarjeta.validos)} con consentimiento` : "",
    tarjeta.umps != null ? `${fmt(tarjeta.umps)} UMP` : "",
  ].filter(Boolean);
  return partes.join(" · ") || "Sin el detalle del impacto";
}
