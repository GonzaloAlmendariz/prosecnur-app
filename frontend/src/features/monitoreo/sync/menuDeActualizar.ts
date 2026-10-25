import type { MonitoreoSource, MonitoreoSourceKind } from "../../../api/monitoreo";
import { fuentesSincronizables, motivoSinFuentes } from "../core/fuentesSincronizables";

/**
 * Qué ofrece el control único «Actualizar ▾» de la barra del modo (L38).
 *
 * El cuerpo trae lo nuevo de las fuentes de respuesta y recalcula. El menú
 * ofrece una entrada por fuente, «Traer todo de nuevo» y «Recalcular». Absorbe
 * la franja «Sheets · Kobo/encuestas · Todo» que vivía en Insumos › Fuentes:
 * cada fuente se trae por el mismo camino que usaba su botón de la franja
 * (las hojas por `/api/monitoreo/sheets/sync`, lo demás por
 * `/api/monitoreo/sync` en modo completo) y, si hay dos o más del mismo tipo,
 * una entrada las trae juntas, como hacía la franja. Lo que se lee y se escribe
 * en las plataformas no cambia: sólo dónde se lanza y cómo se informa.
 */

export type PeticionDeActualizar =
  | { tipo: "sync"; modo: "full" | "advance"; fuentes: string[] }
  | { tipo: "hojas"; fuentes: string[] }
  | { tipo: "recalcular" };

export type EntradaDeActualizar = {
  clave: string;
  etiqueta: string;
  /** Segunda línea en el menú: el tipo de fuente o lo que hace la entrada. */
  detalle?: string;
  titulo: string;
  grupo?: "fuentes";
  disabled: boolean;
  peticion: PeticionDeActualizar;
};

const NOMBRE_DE_PLATAFORMA: Record<MonitoreoSourceKind, string> = {
  google_sheets: "Google Sheets",
  kobo: "Kobo",
  surveymonkey: "SurveyMonkey",
};

const NOMBRE_DE_PAPEL: Partial<Record<string, string>> = {
  universo: "universo",
  barrido: "barrido",
  respuestas: "respuestas",
  supervision: "supervisión",
};

function detalleDeFuente(fuente: MonitoreoSource) {
  const plataforma = NOMBRE_DE_PLATAFORMA[fuente.kind] ?? fuente.kind;
  const papel = fuente.role ? NOMBRE_DE_PAPEL[fuente.role] : undefined;
  return papel ? `${plataforma} · ${papel}` : plataforma;
}

function etiquetaDeFuente(fuente: MonitoreoSource) {
  return fuente.label?.trim() || fuente.survey_title?.trim() || NOMBRE_DE_PLATAFORMA[fuente.kind] || fuente.id;
}

function peticionDeFuentes(fuentes: MonitoreoSource[]): PeticionDeActualizar {
  const ids = fuentes.map((fuente) => fuente.id);
  return fuentes.every((fuente) => fuente.kind === "google_sheets")
    ? { tipo: "hojas", fuentes: ids }
    : { tipo: "sync", modo: "full", fuentes: ids };
}

export function planDeActualizar({
  fuentes,
  familia,
  deshabilitado = false,
  pendienteDeRecalcular = false,
}: {
  fuentes: MonitoreoSource[];
  familia: string;
  deshabilitado?: boolean;
  pendienteDeRecalcular?: boolean;
}): { principal: EntradaDeActualizar; menu: EntradaDeActualizar[] } {
  const completas = fuentesSincronizables(fuentes, "full", familia);
  const avance = fuentesSincronizables(fuentes, "advance", familia);
  // El backend no lee las ocurrencias de campo por este camino: ofrecerlas
  // daría una entrada que siempre responde «no hay fuentes».
  const porFuente = completas.filter((fuente) => fuente.role !== "ocurrencias_campo");

  const principal: EntradaDeActualizar = avance.length
    ? {
      clave: "principal",
      etiqueta: "Actualizar",
      titulo: "Traer lo nuevo de las fuentes de respuesta y recalcular",
      disabled: deshabilitado,
      peticion: { tipo: "sync", modo: "advance", fuentes: avance.map((fuente) => fuente.id) },
    }
    : {
      clave: "principal",
      etiqueta: "Actualizar",
      titulo: completas.length ? "Leer las fuentes activas y recalcular" : motivoSinFuentes("full"),
      disabled: deshabilitado || !completas.length,
      peticion: { tipo: "sync", modo: "full", fuentes: completas.map((fuente) => fuente.id) },
    };

  const menu: EntradaDeActualizar[] = porFuente.map((fuente) => ({
    clave: `fuente:${fuente.id}`,
    etiqueta: etiquetaDeFuente(fuente),
    detalle: detalleDeFuente(fuente),
    titulo: `Traer todo de nuevo de ${etiquetaDeFuente(fuente)} y recalcular`,
    grupo: "fuentes",
    disabled: deshabilitado,
    peticion: peticionDeFuentes([fuente]),
  }));

  const hojas = porFuente.filter((fuente) => fuente.kind === "google_sheets");
  const plataforma = porFuente.filter((fuente) => fuente.kind !== "google_sheets");
  if (hojas.length >= 2) {
    menu.push({
      clave: "grupo:hojas",
      etiqueta: `Las ${hojas.length} hojas de Sheets`,
      titulo: "Traer de nuevo todas las hojas de Google Sheets y recalcular",
      grupo: "fuentes",
      disabled: deshabilitado,
      peticion: peticionDeFuentes(hojas),
    });
  }
  if (plataforma.length >= 2) {
    const nombre = familia === "telefonico" ? "encuestas de Kobo" : "encuestas";
    menu.push({
      clave: "grupo:plataforma",
      etiqueta: `Las ${plataforma.length} ${nombre}`,
      titulo: `Traer de nuevo todas las ${nombre} y recalcular`,
      grupo: "fuentes",
      disabled: deshabilitado,
      peticion: peticionDeFuentes(plataforma),
    });
  }

  menu.push({
    clave: "todo",
    etiqueta: "Traer todo de nuevo",
    detalle: completas.length === 1 ? "1 fuente activa" : `${completas.length} fuentes activas`,
    titulo: completas.length ? "Volver a leer todas las fuentes activas desde cero y recalcular" : motivoSinFuentes("full"),
    disabled: deshabilitado || !completas.length,
    peticion: { tipo: "sync", modo: "full", fuentes: completas.map((fuente) => fuente.id) },
  }, {
    clave: "recalcular",
    etiqueta: "Recalcular",
    detalle: pendienteDeRecalcular ? "Hay cambios sin recalcular" : "Sin traer nada",
    titulo: "Recalcular el tablero con lo que ya está en el proyecto",
    disabled: deshabilitado,
    peticion: { tipo: "recalcular" },
  });

  return { principal, menu };
}
