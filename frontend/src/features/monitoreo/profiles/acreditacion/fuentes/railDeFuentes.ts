// Las tres pestañas de Fuentes, con su estado y lo que falta para cerrarlas.
//
// Vive fuera de `AcreditacionMonitoreoPage.tsx` porque ese archivo está
// congelado a crecimiento (`agentic/manifest.json`) y porque el texto del rail
// es justamente donde se aplica R4 del plan: el `detail` **nombra la acción
// pendiente**, no describe el estado.
//
//   ANTES: «conecta encuestas» / «Bases · 6 activa» / «Estado · 13/13 fuentes»
//   AHORA: «conecta las encuestas por las que responde cada actor»
//
// Contrato: docs/plan-fuentes-legibles-2026-07.md §4.1 y R4.

import type { MonitoreoWorkbenchRailTab } from "../../../components";
import { PESTANAS_DE_FUENTES } from "./pestanas";

type Estado = NonNullable<MonitoreoWorkbenchRailTab["estado"]>;

/** Lo que el rail necesita saber del inventario de fuentes. */
export type ConteosDeFuentes = {
  total: number;
  enabled: number;
  sheets: number;
  sheetsEnabled: number;
  platform: number;
  platformEnabled: number;
  collectors: number;
};

/** Lo que el rail necesita saber del contrato telefónico de tres fuentes. */
export type ConteosTelefonicos = {
  fuentesListas: number;
  hojasListas: number;
  encuestasKobo: number;
  plataformaLista: boolean;
  filtroDefinido: boolean;
};

function estado(listo: boolean): Estado {
  return listo ? "listo" : "parcial";
}

function cuenta(total: number, singular: string, plural: string) {
  return `${total.toLocaleString("es-PE")} ${total === 1 ? singular : plural}`;
}

export function railDeFuentesAcreditacion(conteos: ConteosDeFuentes): MonitoreoWorkbenchRailTab[] {
  const [resumen, universo, encuestas] = PESTANAS_DE_FUENTES;
  return [
    {
      ...resumen,
      detail: conteos.total
        ? `${cuenta(conteos.enabled, "fuente activa", "fuentes activas")} de ${conteos.total}`
        : "sin fuentes conectadas",
      badge: conteos.total ? `${conteos.enabled}/${conteos.total}` : undefined,
      estado: estado(conteos.total > 0 && conteos.enabled === conteos.total),
    },
    {
      ...universo,
      detail: conteos.sheets
        ? cuenta(conteos.sheetsEnabled, "base activa", "bases activas")
        : "falta la base de cada actor",
      badge: conteos.sheets ? String(conteos.sheets) : undefined,
      estado: estado(conteos.sheetsEnabled > 0),
    },
    {
      ...encuestas,
      detail: conteos.platform
        ? `${cuenta(conteos.platformEnabled, "encuesta activa", "encuestas activas")} · ${cuenta(conteos.collectors, "recopilador", "recopiladores")}`
        : "faltan las encuestas de cada actor",
      badge: conteos.platform ? String(conteos.platform) : undefined,
      estado: estado(conteos.platformEnabled > 0),
    },
  ];
}

export function railDeFuentesTelefonico(conteos: ConteosTelefonicos): MonitoreoWorkbenchRailTab[] {
  const [resumen, universo, encuestas] = PESTANAS_DE_FUENTES;
  const faltan = 3 - conteos.fuentesListas;
  return [
    {
      ...resumen,
      detail: faltan <= 0
        ? "las 3 fuentes del modelo están listas"
        : `${faltan === 1 ? "falta 1 fuente" : `faltan ${faltan} fuentes`} de las 3 del modelo`,
      badge: `${conteos.fuentesListas}/3`,
      estado: estado(conteos.fuentesListas === 3),
    },
    {
      ...universo,
      label: "Universo y barrido",
      detail: conteos.hojasListas === 2
        ? "base y barrido conectados"
        : "faltan la base de universo o la hoja de barrido",
      badge: `${conteos.hojasListas}/2`,
      estado: estado(conteos.hojasListas === 2),
    },
    {
      ...encuestas,
      label: "Encuestas",
      detail: conteos.plataformaLista
        ? `${cuenta(conteos.encuestasKobo, "encuesta", "encuestas")} · ${conteos.filtroDefinido ? "filtro de efectiva definido" : "define el filtro de efectiva"}`
        : "falta la encuesta y el filtro de efectiva",
      badge: conteos.encuestasKobo ? String(conteos.encuestasKobo) : undefined,
      estado: estado(conteos.plataformaLista && conteos.filtroDefinido),
    },
  ];
}
