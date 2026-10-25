import type {
  MonitoreoFieldOccurrenceConfig,
  MonitoreoSource,
  MonitoreoTerritorialPhase,
  MonitoreoTerritorialPhaseSource,
} from "../../../../../api/monitoreo";
import type { EntradaDeActualizar, PlanDeActualizar } from "../../../sync/menuDeActualizar";

/**
 * El control único «Actualizar ▾» de Territorial (L38, fase 2 de M1).
 *
 * Absorbe los botones heredados «Sincronizar respuestas» y «Actualizar
 * <fase>» de la consola de fuentes y «Sincronizar piloto/campo» de Modelo, más
 * el cuerpo que ya tenía la barra. Las fuentes de Territorial no caben en
 * `planDeActualizar`: el cuerpo lee sólo el Kobo de la fase activa (no las dos
 * fases) y suma las ocurrencias de campo, que el backend lee por su propio
 * endpoint. Lo que se lee en Kobo y Sheets no cambia; sólo dónde se lanza.
 */

export type FaseTerritorial = MonitoreoTerritorialPhase;

type ConfigTerritorial = {
  phase_sources?: Partial<Record<FaseTerritorial, MonitoreoTerritorialPhaseSource>>;
  field_occurrences?: Partial<MonitoreoFieldOccurrenceConfig>;
};

/** Las ocurrencias de campo tal como las pide `/territorial/occurrences/sync`. */
export type OcurrenciasDelPlan = {
  /** Clave de la entrada en las peticiones del plan. */
  id: string;
  source_id?: string;
  asset_uid?: string;
  etiqueta: string;
};

const NOMBRE_DE_FASE: Record<FaseTerritorial, string> = { field: "campo", pilot: "piloto" };

function faseDeFuente(source: MonitoreoSource | null | undefined): FaseTerritorial | "" {
  const fase = source?.dimensions?.territorial_phase;
  return fase === "pilot" || fase === "field" ? fase : "";
}

function fuentesDeRespuesta(sources: readonly MonitoreoSource[]) {
  return sources.filter((source) => source.kind === "kobo" && source.role !== "ocurrencias_campo");
}

/** El Kobo declarado para esa fase, sin recurrir a otra fuente si no lo hay. */
function koboDeclaradoDeFase(sources: readonly MonitoreoSource[], config: ConfigTerritorial | null | undefined, fase: FaseTerritorial) {
  const declarada = config?.phase_sources?.[fase];
  const kobo = fuentesDeRespuesta(sources);
  return kobo.find((source) => source.id && source.id === declarada?.source_id)
    ?? kobo.find((source) => source.asset_uid && source.asset_uid === declarada?.asset_uid)
    ?? kobo.find((source) => faseDeFuente(source) === fase)
    ?? null;
}

/**
 * El Kobo de la fase activa: el mismo orden de búsqueda que usaba
 * `syncActiveTerritorialSource` de la página, con sus recursos a la primera
 * fuente activa y a la primera a secas.
 */
export function koboDeLaFase(sources: readonly MonitoreoSource[], config: ConfigTerritorial | null | undefined, fase: FaseTerritorial) {
  const kobo = fuentesDeRespuesta(sources);
  return koboDeclaradoDeFase(sources, config, fase)
    ?? kobo.find((source) => source.enabled)
    ?? kobo[0]
    ?? null;
}

/** Las ocurrencias de campo, si el estudio las declara (antes: `syncAdvance`). */
export function ocurrenciasDeCampo(sources: readonly MonitoreoSource[], config: ConfigTerritorial | null | undefined): OcurrenciasDelPlan | null {
  const fo = config?.field_occurrences;
  const sourceId = String(fo?.source_id ?? "").trim();
  const assetUid = String(fo?.asset_uid ?? "").trim();
  if (!sourceId && !assetUid) return null;
  const fuente = sources.find((source) => source.id === sourceId)
    ?? sources.find((source) => source.role === "ocurrencias_campo" && source.asset_uid === assetUid)
    ?? null;
  const etiqueta = fuente?.label?.trim() || String(fo?.asset_name ?? "").trim() || "Ocurrencias de campo";
  return {
    id: fuente?.id || sourceId || `ocurrencias:${assetUid}`,
    ...(sourceId ? { source_id: sourceId } : {}),
    ...(assetUid ? { asset_uid: assetUid } : {}),
    etiqueta,
  };
}

/** La hoja de ruta de Google Sheets de esa fase (o la única que haya). */
export function hojaDeRuta(sources: readonly MonitoreoSource[], fase: FaseTerritorial) {
  const hojas = sources.filter((source) => source.kind === "google_sheets" && source.role === "hoja_ruta");
  return hojas.find((source) => faseDeFuente(source) === fase) ?? hojas[0] ?? null;
}

function etiquetaDe(source: MonitoreoSource) {
  return source.label?.trim() || source.survey_title?.trim() || source.id;
}

export function planTerritorialDeActualizar({
  sources,
  config,
  fase,
  deshabilitado = false,
  pendienteDeRecalcular = false,
}: {
  sources: readonly MonitoreoSource[];
  config: ConfigTerritorial | null | undefined;
  fase: FaseTerritorial;
  deshabilitado?: boolean;
  pendienteDeRecalcular?: boolean;
}): PlanDeActualizar {
  const activa = koboDeLaFase(sources, config, fase);
  const ocurrencias = ocurrenciasDeCampo(sources, config);
  const hoja = hojaDeRuta(sources, fase);
  const sinKobo = `Define primero una fuente Kobo para ${fase === "field" ? "Campo" : "Piloto"}.`;
  const conjunto = activa ? [activa.id, ...(ocurrencias ? [ocurrencias.id] : [])] : [];

  const principal: EntradaDeActualizar = {
    clave: "principal",
    etiqueta: "Actualizar",
    titulo: activa
      ? ocurrencias
        ? "Traer las respuestas nuevas de Kobo y las ocurrencias, y recalcular"
        : "Traer las respuestas nuevas de Kobo y recalcular"
      : sinKobo,
    disabled: deshabilitado || !activa,
    peticion: { tipo: "sync", modo: "advance", fuentes: conjunto },
  };

  const menu: EntradaDeActualizar[] = [];
  menu.push({
    clave: "todo",
    etiqueta: "Traer todo de nuevo",
    detalle: ocurrencias ? `Kobo de ${NOMBRE_DE_FASE[fase]} y ocurrencias` : `Kobo de ${NOMBRE_DE_FASE[fase]}`,
    titulo: activa ? `Volver a leer desde cero las respuestas Kobo de ${NOMBRE_DE_FASE[fase]}${ocurrencias ? " y las ocurrencias" : ""}, y recalcular` : sinKobo,
    disabled: deshabilitado || !activa,
    peticion: { tipo: "sync", modo: "full", fuentes: conjunto },
  }, {
    clave: "recalcular",
    etiqueta: "Recalcular",
    detalle: pendienteDeRecalcular ? "Hay cambios sin recalcular" : "Sin traer nada",
    titulo: "Recalcular el tablero con lo que ya está en el proyecto",
    disabled: deshabilitado,
    peticion: { tipo: "recalcular" },
  });

  // Por fuente: el Kobo de cada fase si son distintos, las ocurrencias y la
  // hoja de ruta. Cada una se lee entera, como sus botones heredados.
  const porFase = (["field", "pilot"] as const).flatMap((cada) => {
    const fuente = cada === fase ? activa : koboDeclaradoDeFase(sources, config, cada);
    return fuente ? [{ fase: cada, fuente }] : [];
  });
  const vistas = new Set<string>();
  for (const { fase: cada, fuente } of porFase) {
    if (vistas.has(fuente.id)) continue;
    vistas.add(fuente.id);
    const deDosFases = porFase.filter((item) => item.fuente.id === fuente.id).length > 1;
    menu.push({
      clave: `fuente:${fuente.id}`,
      etiqueta: etiquetaDe(fuente),
      detalle: deDosFases ? "Kobo · piloto y campo" : `Kobo · ${NOMBRE_DE_FASE[cada]}${cada === fase ? ", fase activa" : ""}`,
      titulo: `Traer todo de nuevo de ${etiquetaDe(fuente)} y recalcular`,
      grupo: "fuentes",
      disabled: deshabilitado,
      peticion: { tipo: "sync", modo: "full", fuentes: [fuente.id] },
    });
  }
  if (ocurrencias) {
    menu.push({
      clave: `fuente:${ocurrencias.id}`,
      etiqueta: ocurrencias.etiqueta,
      detalle: "Kobo · ocurrencias de campo",
      titulo: `Traer de nuevo ${ocurrencias.etiqueta} y recalcular`,
      grupo: "fuentes",
      disabled: deshabilitado,
      peticion: { tipo: "sync", modo: "full", fuentes: [ocurrencias.id] },
    });
  }
  if (hoja) {
    menu.push({
      clave: `fuente:${hoja.id}`,
      etiqueta: etiquetaDe(hoja),
      detalle: "Google Sheets · hoja de ruta",
      titulo: `Traer de nuevo ${etiquetaDe(hoja)} y recalcular`,
      grupo: "fuentes",
      disabled: deshabilitado,
      peticion: { tipo: "hojas", fuentes: [hoja.id] },
    });
  }

  return { principal, menu };
}
