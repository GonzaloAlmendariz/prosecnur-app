/**
 * Control › Supervisión (T9): la muestra de efectivas que se vuelve a llamar.
 *
 * Fuente: bloques `supervision_resumen`, `supervision_reparto` y
 * `supervision_casos` (`api/R/monitoreo_supervision_estratificada.R`). P5:
 * proporcional a las efectivas de cada enumerador, con al menos un caso por
 * enumerador; P6: el proyecto declara una cantidad (`supervision_n`) y aquí se
 * muestra el porcentaje equivalente; P7: el resultado de cada rellamada sale
 * de la hoja de supervisión, si está conectada.
 */
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { pctConEspacio } from "../../../core/formatoComun";
import { filasDeBloque } from "../navegacion/bloques";

export type RepartoDeEnumerador = { enumerador: string; efectivas: number; casos: number; minimo: boolean };

export type CasoSorteado = {
  n: number;
  codigo: string;
  progres: string;
  enumerador: string;
  categoria: string;
  fechaKobo: string;
  resultado: string;
  statusFinal: string;
  coincide: "Sí" | "No" | "";
  observacion: string;
  supervisor: string;
  /** Lectura del motor de las preguntas de control frente a Kobo («3 de 4»), o vacío. */
  controles: string;
  /** Las preguntas de control que no coinciden con Kobo. */
  controlesQueNoCoinciden: string[];
};

export type Supervision = {
  base: number;
  declarados: number;
  casos: number;
  semilla: string;
  hojaConectada: boolean;
  /** Casos sorteados que ya aparecen en la hoja de supervisión. */
  enHoja: number | null;
  /** Casos sobre la base, en %; null sin base. */
  porcentaje: number | null;
  /** Cuántos casos agrega el mínimo de uno por enumerador. */
  porElMinimo: number;
  reparto: RepartoDeEnumerador[];
  sorteados: CasoSorteado[];
  resultados: { coinciden: number; noCoinciden: number; sinResultado: number };
};

function texto(valor: unknown) {
  return valor == null ? "" : String(valor).trim();
}

function entero(valor: unknown) {
  const n = Number(texto(valor));
  return Number.isFinite(n) ? n : 0;
}

function verdadero(valor: unknown) {
  return valor === true || /^(true|1|si|sí|yes)$/i.test(texto(valor));
}

export function construirSupervision(reports: MonitoreoAcreditacionReports | null | undefined): Supervision | null {
  const resumen = filasDeBloque(reports, ["supervision_resumen"]);
  if (!resumen.length) return null;
  const valor = (indicador: string) => texto(resumen.find((fila) => texto(fila.Indicador) === indicador)?.Valor);
  const reparto = filasDeBloque(reports, ["supervision_reparto"]).map((fila) => ({
    enumerador: texto(fila.Enumerador),
    efectivas: entero(fila.Efectivas),
    casos: entero(fila.Casos),
    minimo: verdadero(fila["Mínimo"]),
  }));
  const noCoinciden = new Map<string, string[]>();
  filasDeBloque(reports, ["supervision_controles"]).forEach((fila) => {
    if (/^no$/i.test(texto(fila.Coincide))) {
      const codigo = texto(fila.CodPulso);
      noCoinciden.set(codigo, [...(noCoinciden.get(codigo) ?? []), texto(fila.Pregunta)]);
    }
  });
  const sorteados = filasDeBloque(reports, ["supervision_casos"]).map((fila) => {
    const coincide = texto(fila.Coincide);
    return {
      n: entero(fila.N),
      codigo: texto(fila.CodPulso),
      progres: texto(fila.proGres),
      enumerador: texto(fila.Enumerador),
      categoria: texto(fila["Categoría"]),
      fechaKobo: texto(fila["Fecha Kobo"]),
      resultado: texto(fila.Resultado) || texto(fila["Status supervisión"]),
      statusFinal: texto(fila["Status final"]),
      coincide: coincide === "Sí" || coincide === "No" ? coincide : "",
      observacion: texto(fila["Observación"]) || texto(fila.Observaciones),
      supervisor: texto(fila.Supervisor),
      controles: texto(fila["Controles coinciden"]),
      controlesQueNoCoinciden: noCoinciden.get(texto(fila.CodPulso)) ?? [],
    } satisfies CasoSorteado;
  });
  const base = entero(valor("Base"));
  const casos = entero(valor("Casos")) || sorteados.length;
  const declarados = entero(valor("Declarados"));
  return {
    base,
    declarados,
    casos,
    semilla: valor("Semilla"),
    hojaConectada: valor("Hoja") === "conectada",
    enHoja: valor("En hoja") ? entero(valor("En hoja")) : null,
    porcentaje: base > 0 ? (casos / base) * 100 : null,
    porElMinimo: Math.max(0, casos - Math.min(declarados, base)),
    reparto,
    sorteados,
    resultados: {
      coinciden: sorteados.filter((caso) => caso.coincide === "Sí").length,
      noCoinciden: sorteados.filter((caso) => caso.coincide === "No").length,
      sinResultado: sorteados.filter((caso) => !caso.resultado && !caso.statusFinal).length,
    },
  };
}

/** El porcentaje del lenguaje común del revamp («6.1 %»). */
export function porcentajeLegible(valor: number | null) {
  return pctConEspacio(valor);
}
