// Las pestañas de Fuentes, con su estado y lo que falta para cerrarlas.
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
import type { PestanaDeFuentes } from "./pestanas";

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

/**
 * La definición de una pestaña por su clave.
 *
 * Se buscan por clave y no por posición. La destructuración por índice
 * —`const [resumen, universo, encuestas] = PESTANAS_DE_FUENTES`— reasignaba en
 * silencio el texto de cada pestaña a la siguiente en cuanto se insertaba una
 * nueva en medio, que es exactamente lo que pasó al añadir «Actores».
 */
function definicion(key: PestanaDeFuentes) {
  const encontrada = PESTANAS_DE_FUENTES.find((pestana) => pestana.key === key);
  if (!encontrada) throw new Error(`Pestaña de Fuentes desconocida: ${key}`);
  return encontrada;
}

/** Lo que el rail necesita saber del elenco declarado. */
export type ConteosDeActores = {
  declarados: number;
  sinPadron: number;
};

function estado(listo: boolean): Estado {
  return listo ? "listo" : "parcial";
}

function cuenta(total: number, singular: string, plural: string) {
  return `${total.toLocaleString("es-PE")} ${total === 1 ? singular : plural}`;
}

export function railDeFuentesAcreditacion(
  conteos: ConteosDeFuentes,
  actores: ConteosDeActores = { declarados: 0, sinPadron: 0 },
): MonitoreoWorkbenchRailTab[] {
  return [
    {
      ...definicion("actores"),
      detail: actores.declarados
        ? (actores.sinPadron
          ? `${cuenta(actores.declarados, "actor", "actores")} · ${actores.sinPadron} sin padrón`
          : cuenta(actores.declarados, "actor declarado", "actores declarados"))
        : "declara quiénes responden el estudio",
      badge: actores.declarados ? String(actores.declarados) : undefined,
      estado: estado(actores.declarados > 0),
    },
    {
      ...definicion("fuentes"),
      // Una sola pestaña con tres cosas dentro necesita decir cuál falta, no
      // cuántas hay en total: «13 de 13» no distingue un estudio con todos los
      // padrones y ninguna encuesta de su inverso.
      detail: !conteos.total
        ? "conecta el padrón y la encuesta de cada actor"
        : !conteos.sheetsEnabled
          ? "falta la base de cada actor"
          : !conteos.platformEnabled
            ? "faltan las encuestas de cada actor"
            : `${cuenta(conteos.sheetsEnabled, "base activa", "bases activas")} · ${cuenta(conteos.platformEnabled, "encuesta activa", "encuestas activas")}`,
      badge: conteos.total ? `${conteos.enabled}/${conteos.total}` : undefined,
      estado: estado(conteos.sheetsEnabled > 0 && conteos.platformEnabled > 0),
    },
    {
      ...definicion("recopiladores"),
      detail: conteos.collectors
        ? cuenta(conteos.collectors, "recopilador", "recopiladores")
        : "sin recopiladores en las encuestas conectadas",
      badge: conteos.collectors ? String(conteos.collectors) : undefined,
      estado: estado(conteos.collectors > 0),
    },
  ];
}

export function railDeFuentesTelefonico(conteos: ConteosTelefonicos): MonitoreoWorkbenchRailTab[] {
  // El perfil telefónico no reparte por actor: reusa las mismas tres celdas del
  // rail con su propio vocabulario, sin pestaña de elenco.
  const faltan = 3 - conteos.fuentesListas;
  return [
    {
      ...definicion("actores"),
      label: "Modelo",
      detail: faltan <= 0
        ? "las 3 fuentes del modelo están listas"
        : `${faltan === 1 ? "falta 1 fuente" : `faltan ${faltan} fuentes`} de las 3 del modelo`,
      badge: `${conteos.fuentesListas}/3`,
      estado: estado(conteos.fuentesListas === 3),
    },
    {
      ...definicion("fuentes"),
      label: "Universo y barrido",
      detail: conteos.hojasListas === 2
        ? "base y barrido conectados"
        : "faltan la base de universo o la hoja de barrido",
      badge: `${conteos.hojasListas}/2`,
      estado: estado(conteos.hojasListas === 2),
    },
    {
      ...definicion("recopiladores"),
      label: "Encuestas",
      detail: conteos.plataformaLista
        ? `${cuenta(conteos.encuestasKobo, "encuesta", "encuestas")} · ${conteos.filtroDefinido ? "filtro de efectiva definido" : "define el filtro de efectiva"}`
        : "falta la encuesta y el filtro de efectiva",
      badge: conteos.encuestasKobo ? String(conteos.encuestasKobo) : undefined,
      estado: estado(conteos.plataformaLista && conteos.filtroDefinido),
    },
  ];
}
