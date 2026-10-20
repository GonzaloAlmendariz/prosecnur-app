// Texto del diálogo que confirma rehacer el plan (H26).
//
// Puro: recibe la previsualización del backend (`POST /api/recopiladores/reseed`
// con `dry_run: true`) y devuelve lo que se pinta. El diálogo no decide qué
// decir; sólo lo dibuja. Así el copy se prueba sin montar React ni router.

import type {
  CollectionReseedDescartado,
  CollectionReseedPropuesto,
  CollectionStatePayload,
} from "../../api/recopiladores";
import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { fechaDeCorrida } from "./fechaDeCorrida";
import { lineaDelConteo } from "./origen";

/**
 * `?seccion=unidades&pestana=origen&panel=rehacer-plan`: el diálogo que confirma
 * el reseed. Vive en Origen (E1e); un enlace guardado sin pestaña aterriza ahí.
 */
export const PANEL_REHACER_PLAN: PanelDeclarado = {
  id: "rehacer-plan",
  label: "Rehacer el plan",
  clase: "dialogo",
};

/**
 * `rehacer`: el diálogo histórico, sin huella de la fuente. `actualizar`: el de
 * Unidades › Origen, que además dice cuántas unidades entran, salen y cambian.
 */
export type VarianteDelResembrado = "rehacer" | "actualizar";

export type TextoDelResembrado = {
  titulo: string;
  /** «Entran 2, salen 0, cambian 1.»; vacío si el backend no lo emitió. */
  diferencias: string;
  /** Qué plan entra, con su cifra. */
  entra: string;
  /** Qué plan sale, con su cifra; vacío si no hay plan que reemplazar. */
  sale: string;
  /** Lo que se pierde, una línea por cosa. Vacío = nada que descartar. */
  descarta: string[];
  /** Lo que sobrevive, en rótulos humanos. */
  conserva: string[];
  confirmar: string;
};

const ROTULO_CONSERVADO: Readonly<Record<string, string>> = {
  material_template: "Plantilla de la ficha",
  mail_template: "Plantilla del correo",
  mail_campaigns: "Campañas de correo",
  pruebas: "Fichas de prueba",
  drive_fichas: "Carpeta de Drive",
};

function n(valor: number): string {
  return valor.toLocaleString("es-PE");
}

function plural(valor: number, uno: string, varios: string): string {
  return `${n(valor)} ${valor === 1 ? uno : varios}`;
}

function delSorteo(runId: string): string {
  const fecha = fechaDeCorrida(runId);
  return fecha ? ` del sorteo del ${fecha}` : "";
}

/**
 * Rótulos de lo que se conserva. Una clave que este front no conoce no se
 * enseña cruda: se dice «Otra configuración», una sola vez.
 */
export function rotulosConservados(claves: readonly string[]): string[] {
  const rotulos = claves.map((clave) => ROTULO_CONSERVADO[clave] ?? "Otra configuración");
  return [...new Set(rotulos)];
}

export function textoDelResembrado(
  descartado: CollectionReseedDescartado | null,
  propuesto: CollectionReseedPropuesto | null,
  variante: VarianteDelResembrado = "rehacer",
): TextoDelResembrado {
  const entra = propuesto
    ? `Entra el plan${delSorteo(propuesto.plan_run_id)}: ${plural(propuesto.unidades, "unidad", "unidades")}.`
    : "Entra el plan del sorteo vigente.";
  const sale = descartado && descartado.unidades > 0
    ? `Sale el plan actual${delSorteo(descartado.plan_run_id)}: ${plural(descartado.unidades, "unidad", "unidades")}.`
    : "";

  const descarta: string[] = [];
  if (descartado) {
    const { fichas } = descartado;
    if (fichas.instancias > 0) {
      descarta.push(
        `${plural(fichas.instancias, "juego de fichas generado", "juegos de fichas generados")}`
        + (fichas.unidades_cubiertas > 0 ? ` (${plural(fichas.unidades_cubiertas, "unidad", "unidades")})` : ""),
      );
    }
    if (descartado.recibos > 0) {
      descarta.push(plural(descartado.recibos, "archivo registrado", "archivos registrados"));
    }
    if (descartado.publicaciones_drive > 0) {
      descarta.push(
        `${plural(descartado.publicaciones_drive, "publicación en Drive", "publicaciones en Drive")}`
        + " (los archivos se quedan en Drive)",
      );
    }
    if (descartado.entregado) descarta.push("El despliegue y su entrega a campo");
    else if (descartado.tenia_despliegue) descarta.push("El despliegue preparado");
    if (descartado.otros_campos.length > 0) {
      descarta.push(plural(descartado.otros_campos.length, "dato más del módulo", "datos más del módulo"));
    }
  }

  const actualizar = variante === "actualizar";
  return {
    titulo: actualizar ? "¿Actualizar desde la fuente?" : "¿Rehacer el plan con el sorteo vigente?",
    diferencias: propuesto?.diferencias ? `${lineaDelConteo(propuesto.diferencias)}.` : "",
    entra,
    sale,
    descarta,
    conserva: rotulosConservados(descartado?.conservado ?? []),
    confirmar: actualizar ? "Actualizar desde la fuente" : "Rehacer el plan",
  };
}

const STALE = "E_COLLECTION_STATE_STALE";
/** La fuente cambió entre revisar las diferencias y confirmar (E1e). */
const ORIGEN_CAMBIO = "E_COLLECTION_ORIGEN_CAMBIO";

/** Código del error de API, si lo trae (`ApiError.code`). */
export function codigoDe(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

/**
 * Un 409 dice qué hacer, no el código. Los demás errores pasan con su mensaje.
 */
export function mensajeDeErrorDelResembrado(error: unknown, accion: "leer" | "rehacer"): string {
  const codigo = codigoDe(error);
  if (codigo === STALE) {
    return "El plan cambió mientras lo revisabas. Actualiza Material de campo y vuelve a intentarlo.";
  }
  if (codigo === ORIGEN_CAMBIO) {
    return "La fuente cambió mientras revisabas las diferencias. Vuelve a revisarlas antes de confirmar.";
  }
  if (codigo === "E_COLLECTION_SIN_ORIGEN") {
    return "No hay una selección de aulas vigente de la que rehacer el plan.";
  }
  if (error instanceof Error && error.message) return error.message;
  return accion === "leer"
    ? "No se pudo calcular qué cambia al rehacer el plan."
    : "No se pudo rehacer el plan.";
}

/** Tras reponerse de un 409: lo que se ve ya es el estado vigente. */
export const AVISO_PLAN_ACTUALIZADO =
  "El plan cambió mientras lo revisabas. Ya se muestra lo vigente: revísalo antes de confirmar.";

/** Tras reponerse de un 409 de la fuente: las diferencias se releyeron. */
export const AVISO_FUENTE_ACTUALIZADA =
  "La fuente cambió mientras revisabas las diferencias. Ya se muestran las vigentes: revísalas antes de confirmar.";

// ---------------------------------------------------------------------------
// Flujo: previsualizar primero, escribir sólo al confirmar
// ---------------------------------------------------------------------------
//
// El diálogo no llama a la API directamente: recibe un puerto. Así se prueba
// sin DOM que abrirlo sólo previsualiza y que la escritura usa la MISMA
// revisión que se mostró.

export type PreviaDelResembrado = {
  revision: number;
  /** Huella de la fuente que se revisó; ausente en el diálogo sin huella. */
  huella?: string;
  descartado: CollectionReseedDescartado | null;
  propuesto: CollectionReseedPropuesto | null;
};

export type PuertoDelResembrado = {
  /** `POST /reseed` con `dry_run: true`: no muta. */
  previsualizar: (revision: number, huella?: string | null) => Promise<CollectionStatePayload>;
  /** `POST /reseed` con `dry_run: false`: reemplaza el plan. */
  rehacer: (revision: number, huella?: string | null) => Promise<CollectionStatePayload>;
  /** `GET /state`, para reponerse de un 409 por revisión vieja. */
  leerVigente: () => Promise<CollectionStatePayload>;
};

export type ResultadoDeLaPrevia =
  | { tipo: "listo"; previa: PreviaDelResembrado }
  /** El estado cambió: se repinta con `payload` y se vuelve a previsualizar. */
  | { tipo: "refrescado"; payload: CollectionStatePayload }
  /** La fuente cambió (409 de origen): hay que releer las diferencias. */
  | { tipo: "fuente-cambio" }
  | { tipo: "error"; mensaje: string };

export type ResultadoDeConfirmar =
  | { tipo: "hecho"; payload: CollectionStatePayload }
  | { tipo: "refrescado"; payload: CollectionStatePayload }
  | { tipo: "fuente-cambio" }
  | { tipo: "error"; aviso: string };

/** Tras un 409, el estado vigente si su revisión es otra; si no, nada. */
async function vigenteDistinto(
  puerto: PuertoDelResembrado,
  revision: number,
): Promise<CollectionStatePayload | null> {
  try {
    const fresco = await puerto.leerVigente();
    return fresco.state_revision === revision ? null : fresco;
  } catch {
    // Sin estado fresco no hay de qué reponerse: el llamador enseña el 409.
    return null;
  }
}

export async function leerPreviaDelResembrado(
  puerto: PuertoDelResembrado,
  revision: number,
  huella: string | null = null,
): Promise<ResultadoDeLaPrevia> {
  try {
    // Sin huella, la llamada es la de siempre: el backend no compara la fuente.
    const respuesta = huella
      ? await puerto.previsualizar(revision, huella)
      : await puerto.previsualizar(revision);
    return {
      tipo: "listo",
      previa: {
        revision,
        ...(huella ? { huella } : {}),
        descartado: respuesta.descartado ?? null,
        propuesto: respuesta.propuesto ?? null,
      },
    };
  } catch (error) {
    if (codigoDe(error) === ORIGEN_CAMBIO) return { tipo: "fuente-cambio" };
    if (codigoDe(error) === STALE) {
      const fresco = await vigenteDistinto(puerto, revision);
      if (fresco) return { tipo: "refrescado", payload: fresco };
    }
    return { tipo: "error", mensaje: mensajeDeErrorDelResembrado(error, "leer") };
  }
}

/** Escribe con la revisión y la huella que se previsualizaron, nunca con otras. */
export async function confirmarResembrado(
  puerto: PuertoDelResembrado,
  previa: PreviaDelResembrado,
): Promise<ResultadoDeConfirmar> {
  try {
    const payload = previa.huella
      ? await puerto.rehacer(previa.revision, previa.huella)
      : await puerto.rehacer(previa.revision);
    return { tipo: "hecho", payload };
  } catch (error) {
    if (codigoDe(error) === ORIGEN_CAMBIO) return { tipo: "fuente-cambio" };
    if (codigoDe(error) === STALE) {
      const fresco = await vigenteDistinto(puerto, previa.revision);
      if (fresco) return { tipo: "refrescado", payload: fresco };
    }
    return { tipo: "error", aviso: mensajeDeErrorDelResembrado(error, "rehacer") };
  }
}
