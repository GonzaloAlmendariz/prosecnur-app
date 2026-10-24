/**
 * Avance › Salidas (ficha A5): qué se entrega y si está al día. Las
 * publicaciones frente al corte y el estado del cierre del campo, con la misma
 * regla del motor para cerrar (`monitoreo_acreditacion_cerrar`): con brechas
 * bloqueantes hace falta plan de refuerzo o aprobación metodológica.
 * Puro y con test.
 */

import type { MonitoreoAcreditacion, MonitoreoLastSheetsPublication } from "../../../../../api/client";
import type { AcreditacionAdvanceCard } from "./tarjetasDeAvance";
import { tieneMeta } from "./avanceModelo";

export type PublicacionFrenteAlCorte = {
  salida: string;
  fecha: string | null;
  /** `null` si no hay publicación o no hay corte con qué compararla. */
  alDia: boolean | null;
  enlace: string | null;
};

function instante(valor: string | null | undefined) {
  const ms = valor ? Date.parse(valor) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

export function publicacionesFrenteAlCorte(
  corte: string | null | undefined,
  cliente: MonitoreoLastSheetsPublication | null | undefined,
  interno: MonitoreoLastSheetsPublication | null | undefined,
): PublicacionFrenteAlCorte[] {
  const momentoDelCorte = instante(corte);
  const una = (salida: string, publicacion: MonitoreoLastSheetsPublication | null | undefined): PublicacionFrenteAlCorte => {
    const fecha = publicacion?.updated_at || null;
    const momento = instante(fecha);
    return {
      salida,
      fecha,
      alDia: momento == null || momentoDelCorte == null ? null : momento >= momentoDelCorte,
      enlace: publicacion?.spreadsheet_url || null,
    };
  };
  return [una("Sheets del cliente", cliente), una("Sheets interno", interno)];
}

export type PuntoDelCierre = { rotulo: string; valor: string; estado: "ok" | "pendiente" };

export type EstadoDelCierre = {
  cerrado: boolean;
  cierreAt: string | null;
  bloqueado: boolean;
  metasCumplidas: number;
  metasDeclaradas: number;
  puntos: PuntoDelCierre[];
};

const n = (valor: number) => valor.toLocaleString("es-PE");

export function estadoDelCierre({
  tarjetas,
  esperan,
  publicaciones,
  acreditacion,
}: {
  tarjetas: readonly AcreditacionAdvanceCard[];
  esperan: number | null;
  publicaciones: readonly PublicacionFrenteAlCorte[];
  acreditacion: MonitoreoAcreditacion | null | undefined;
}): EstadoDelCierre {
  const conMeta = tarjetas.filter(tieneMeta);
  const cumplidas = conMeta.filter((tarjeta) => tarjeta.effective >= (tarjeta.meta as number)).length;
  const cliente = publicaciones.find((item) => item.salida === "Sheets del cliente");
  const aprobada = Boolean(acreditacion?.aprobacion_metodologica);
  return {
    cerrado: acreditacion?.modo_trabajo === "cierre_campo",
    cierreAt: acreditacion?.cierre_at || null,
    bloqueado: !acreditacion?.dashboard?.cierre_habilitado,
    metasCumplidas: cumplidas,
    metasDeclaradas: conMeta.length,
    puntos: [
      { rotulo: "Metas cumplidas", valor: conMeta.length ? `${n(cumplidas)} de ${n(conMeta.length)}` : "Sin metas declaradas", estado: conMeta.length && cumplidas === conMeta.length ? "ok" : "pendiente" },
      { rotulo: "Casos por resolver", valor: esperan == null ? "Llegan con Control" : n(esperan), estado: esperan === 0 ? "ok" : "pendiente" },
      { rotulo: "Sheets del cliente", valor: cliente?.alDia ? "Al día con el corte" : cliente?.fecha ? "Anterior al corte" : "Sin publicar", estado: cliente?.alDia ? "ok" : "pendiente" },
      { rotulo: "Aprobación metodológica", valor: aprobada ? "Aprobada" : "Sin aprobar", estado: aprobada ? "ok" : "pendiente" },
    ],
  };
}

/** La regla del motor: con brechas bloqueantes, plan de refuerzo o aprobación. */
export function puedeCerrar(bloqueado: boolean, planDeRefuerzo: string, aprobacion: boolean) {
  return !bloqueado || aprobacion || planDeRefuerzo.trim().length > 0;
}
