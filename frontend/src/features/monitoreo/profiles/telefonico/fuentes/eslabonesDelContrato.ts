/**
 * Los eslabones de la cadena, armados desde el contrato de fuentes telefónicas.
 *
 * Vive fuera del page-file —congelado a crecimiento— y separado del modelo puro
 * de la cadena: lo que se prueba en `modeloDeCadena` es dónde se corta; lo que
 * se hace aquí es rellenar cada eslabón con lo que la fuente sabe de sí misma.
 */

import type { AcreditacionPhoneSourceContract, AcreditacionPhoneSourceSlot } from "../TelefonicoSourcesModel";
import { acreditacionSourceResponseCount } from "../TelefonicoSourcesModel";
import { enlaceDeFuente, nombreDeFuente } from "../../../fuentes/enlacesDeFuente";
import { fmt, formatDate } from "../formato";
import { sourceRowCount, sourceSheetField, sourceSyncLabel } from "./camposDeFuente";
import type { EslabonDeFuente } from "./modeloDeCadena";
import type { MonitoreoAcreditacionReports } from "../../../../../api/client";
import { filasDeBloque } from "../navegacion/bloques";

type Copia = { titulo: string; aporta: string; accion: string };

const COPIA: Record<AcreditacionPhoneSourceSlot["key"], Copia> = {
  universo: { titulo: "Universo", aporta: "personas por llamar", accion: "Conectar la base" },
  barrido: { titulo: "Barrido", aporta: "casos con estado de llamada", accion: "Conectar el barrido" },
  plataforma: { titulo: "Encuesta", aporta: "respuestas que cuentan como efectivas", accion: "Elegir la encuesta" },
};

function eslabonDelSlot(
  slot: AcreditacionPhoneSourceSlot,
  syncedAt?: string,
  filasDeRespaldo = 0,
): EslabonDeFuente {
  const copia = COPIA[slot.key];
  const activas = slot.sources.filter((source) => source.enabled);
  const primaria = activas[0] ?? slot.sources[0] ?? null;
  const filas = slot.sources.reduce((sum, source) => (
    sum + (slot.key === "plataforma" ? acreditacionSourceResponseCount(source) : sourceRowCount(source))
  ), 0) || filasDeRespaldo;
  const enlace = primaria ? enlaceDeFuente(primaria) : null;
  const sync = primaria ? sourceSyncLabel(primaria) : "Sin sync";
  return {
    clave: slot.key,
    titulo: copia.titulo,
    aporta: copia.aporta,
    cifra: filas ? fmt(filas) : "",
    origen: primaria
      ? {
        texto: nombreDeFuente(primaria),
        href: enlace?.estado === "enlace" ? enlace.href : undefined,
        // El rango de la hoja y el identificador viajan en el `title`: son
        // metadato, no algo que el usuario venga a leer (R1).
        titulo: [
          enlace?.estado === "enlace" ? enlace.titulo : null,
          slot.key !== "plataforma" ? sourceSheetField(primaria, "range") : null,
        ].filter(Boolean).join(" · ") || undefined,
      }
      : null,
    // «Sin sync» no se pinta: una fuente conectada que nunca se leyó lo dice su
    // estado, y un rótulo de fecha vacío en su sitio se lee como un error.
    actualizada: sync === "Sin sync"
      ? (slot.ready && syncedAt ? formatDate(syncedAt) : "")
      : sync,
    lista: slot.ready,
    accion: copia.accion,
  };
}

/**
 * Envíos de la encuesta que pasan el filtro de efectiva en el corte: las filas
 * de `control_tiempo_kobo`, la misma cifra que Control › Respuestas y que «De
 * dónde sale la cifra» en Avance › Cuotas. Es lo que el eslabón Encuesta dice
 * aportar («respuestas que cuentan como efectivas») cuando la metadata de Kobo
 * no trae el conteo de la fuente (QA final, C5: Universo y Barrido traían cifra
 * y Encuesta no).
 */
export function efectivasDeLaEncuesta(reports: MonitoreoAcreditacionReports | null | undefined): number {
  return filasDeBloque(reports, ["control_tiempo_kobo", "tiempos_kobo", "validacion_tiempos"]).length;
}

export function eslabonesDelContrato(
  contract: AcreditacionPhoneSourceContract,
  nRows: number,
  syncedAt?: string,
  /** Casos de la hoja de barrido en el corte, cuando la metadata de la fuente no trae conteo (RMS: universo y barrido son la misma hoja). */
  casosDelBarrido = 0,
  /** Envíos que pasan el filtro de efectiva (`efectivasDeLaEncuesta`), cuando la fuente no trae conteo. */
  efectivasDeEncuesta = 0,
): EslabonDeFuente[] {
  // Con universo y barrido en la misma hoja, el universo son los casos de esa
  // hoja; `n_rows` suma también las respuestas de Kobo (RMS ficticio: 1,163
  // «personas por llamar» con 800 en la hoja).
  const ids = (slot: AcreditacionPhoneSourceSlot) => slot.sources.map((source) => source.id).sort().join("|");
  const mismaHoja = casosDelBarrido > 0 && ids(contract.universe) !== "" && ids(contract.universe) === ids(contract.sweep);
  return [
    eslabonDelSlot(contract.universe, syncedAt, mismaHoja ? casosDelBarrido : nRows),
    eslabonDelSlot(contract.sweep, syncedAt, casosDelBarrido),
    eslabonDelSlot(contract.platform, syncedAt, efectivasDeEncuesta),
  ];
}
