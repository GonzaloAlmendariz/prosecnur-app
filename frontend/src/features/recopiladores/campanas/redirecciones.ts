// redirecciones.ts — qué vista abre una dirección de Material de campo (ADR 0111,
// «Redirecciones»).
//
// La campaña es un parámetro de ALCANCE (`campana`), como `pulso`: no es una
// sexta dimensión. El modo es el tipo de la campaña abierta y, si la dirección
// los trae en desacuerdo, manda la campaña. Las direcciones de antes del
// registro —`?seccion=unidades`, `?seccion=catalogo&pestana=correos&foco=<cid>`—
// se LEEN y se reescriben a la forma canónica; nunca se escriben.
//
// Es una función pura: recibe lo que dice la URL y el registro, y devuelve la
// vista y, si hace falta, la dirección canónica que la reemplaza (`replace`).

import type { CampanaMaterial, RegistroDeCampanas, TipoDeCampana } from "../../../api/materialCampanas";
import { SEPARADOR_FOCO } from "../editor/modeloEditor";
import { PESTANAS_DEL_CORREO_LEGADAS } from "../navegacion";
import { PANEL_NUEVA_CAMPANA_ID, PANEL_RENOMBRAR_CAMPANA } from "./panelesCampanas";
import {
  ID_CAMPANA_AULAS,
  campanaAulasNaciente,
  campanaPorId,
  campanasVisibles,
  disponibilidadDe,
  idDeCorreo,
} from "./modeloRegistro";

/** Lo que la URL dice de Material de campo, ya parseado por `useDireccion`. */
export type EntradaDeCampanas = {
  modo?: string;
  campana?: string;
  seccion?: string;
  pestana?: string;
  panel?: string;
  foco?: string;
};

/** Los seis params que esta resolución gobierna; lo que no nombra se quita. */
export type DireccionDeCampanas = {
  modo?: string;
  campana?: string;
  seccion?: string;
  pestana?: string;
  panel?: string;
  foco?: string;
};

export type VistaDeCampanas =
  | { vista: "lista" }
  | { vista: "campana"; campana: CampanaMaterial; modo: TipoDeCampana };

export type ResolucionDeCampanas = {
  vista: VistaDeCampanas;
  /** Dirección canónica a escribir con `replace`; `null` si la URL ya lo es. */
  reescribir: DireccionDeCampanas | null;
};

export { PANEL_NUEVA_CAMPANA_ID };
/** El panel viejo de «Gestionar campañas» del correo: hoy es la lista. */
export const PANEL_CAMPANAS_LEGADO = "correo-campanas";

/** Los paneles que se abren sobre la lista; cualquier otro se quita. */
export const PANELES_DE_LA_LISTA: readonly string[] = [
  PANEL_NUEVA_CAMPANA_ID,
  PANEL_RENOMBRAR_CAMPANA.id,
  "correo-campana-borrar",
  "correo-importar",
];

const SECCION_DEL_CORREO = "correo";
const PESTANA_DEL_CORREO = "editor";

function limpio(valor: string | undefined): string {
  return (valor ?? "").trim();
}

function igual(a: DireccionDeCampanas, b: DireccionDeCampanas): boolean {
  const claves: (keyof DireccionDeCampanas)[] = ["modo", "campana", "seccion", "pestana", "panel", "foco"];
  return claves.every((k) => (a[k] ?? "") === (b[k] ?? ""));
}

function resolucion(vista: VistaDeCampanas, deseada: DireccionDeCampanas, entrada: EntradaDeCampanas): ResolucionDeCampanas {
  return { vista, reescribir: igual(deseada, entrada) ? null : deseada };
}

function aLaLista(entrada: EntradaDeCampanas, panel?: string): ResolucionDeCampanas {
  const p = panel ?? limpio(entrada.panel);
  const conPanel = PANELES_DE_LA_LISTA.includes(p);
  const deseada: DireccionDeCampanas = conPanel
    ? { panel: p, ...(entrada.foco && p !== PANEL_NUEVA_CAMPANA_ID ? { foco: entrada.foco } : {}) }
    : {};
  return resolucion({ vista: "lista" }, deseada, entrada);
}

/** La campaña de aulas abierta, con la sección y la pestaña que traía la URL. */
function aAulas(campana: CampanaMaterial, entrada: EntradaDeCampanas): ResolucionDeCampanas {
  const deseada: DireccionDeCampanas = {
    modo: "aulas",
    campana: campana.id,
    ...(entrada.seccion ? { seccion: entrada.seccion } : {}),
    ...(entrada.pestana ? { pestana: entrada.pestana } : {}),
    ...(entrada.panel ? { panel: entrada.panel } : {}),
    ...(entrada.foco ? { foco: entrada.foco } : {}),
  };
  return resolucion({ vista: "campana", campana, modo: "aulas" }, deseada, entrada);
}

/** El correo abierto: una sección, su editor; `foco` es el bloque. */
function aCorreo(campana: CampanaMaterial, entrada: EntradaDeCampanas, bloque: string | null): ResolucionDeCampanas {
  const panel = limpio(entrada.panel);
  const deseada: DireccionDeCampanas = {
    modo: "correo",
    campana: campana.id,
    seccion: SECCION_DEL_CORREO,
    pestana: PESTANA_DEL_CORREO,
    ...(panel && panel !== PANEL_CAMPANAS_LEGADO ? { panel } : {}),
    ...(bloque ? { foco: bloque } : {}),
  };
  return resolucion({ vista: "campana", campana, modo: "correo" }, deseada, entrada);
}

function laUnicaDe(registro: RegistroDeCampanas, tipo: TipoDeCampana): CampanaMaterial | null {
  const deEseTipo = campanasVisibles(registro).filter((c) => c.tipo === tipo);
  return deEseTipo.length === 1 ? deEseTipo[0] : null;
}

/** ¿La URL es un enlace viejo a Catálogo › Correos (o un alias escrito a mano)? */
function esEnlaceViejoAlCorreo(entrada: EntradaDeCampanas): boolean {
  const pestana = limpio(entrada.pestana).toLowerCase();
  const seccion = limpio(entrada.seccion).toLowerCase();
  if (!PESTANAS_DEL_CORREO_LEGADAS.includes(pestana)) return false;
  return !seccion || seccion === "catalogo" || seccion === "materiales" || seccion === "fichas";
}

/** `<cid>` o `<cid>~<bloque>`: el foco de Catálogo › Correos antes del registro. */
function partirFocoViejo(foco: string): { cid: string; bloque: string | null } {
  const corte = foco.indexOf(SEPARADOR_FOCO);
  if (corte < 0) return { cid: foco, bloque: null };
  const bloque = foco.slice(corte + SEPARADOR_FOCO.length);
  return { cid: foco.slice(0, corte), bloque: bloque || null };
}

/** ¿La URL nombra algo del juego de aulas (sección, pestaña o panel)? */
function nombraAlgoDeAulas(entrada: EntradaDeCampanas): boolean {
  const seccion = limpio(entrada.seccion).toLowerCase();
  if (seccion && seccion !== "campanas" && seccion !== SECCION_DEL_CORREO) return true;
  if (!seccion && limpio(entrada.pestana)) return true;
  return limpio(entrada.panel) === "rehacer-plan";
}

export function resolverVistaDeCampanas(entrada: EntradaDeCampanas, registro: RegistroDeCampanas): ResolucionDeCampanas {
  const panel = limpio(entrada.panel);
  const campanaPedida = limpio(entrada.campana);

  // «Gestionar campañas» del correo: hoy es la lista con «Nueva campaña».
  if (panel === PANEL_CAMPANAS_LEGADO) return aLaLista(entrada, PANEL_NUEVA_CAMPANA_ID);

  if (campanaPedida) {
    const campana = campanaPorId(registro, campanaPedida);
    if (campana && !campana.archived) {
      if (campana.tipo === "aulas") return aAulas(campana, entrada);
      if (campana.tipo === "correo") return aCorreo(campana, entrada, limpio(entrada.foco) || null);
      return aLaLista(entrada, "");
    }
    // La de aulas que todavía no existe pero se puede crear: nace al abrirla.
    const sinAulas = !registro.campaigns.some((c) => c.tipo === "aulas");
    if (!campana && campanaPedida === ID_CAMPANA_AULAS && sinAulas && disponibilidadDe(registro, "aulas").disponible) {
      return aAulas(campanaAulasNaciente(), entrada);
    }
    // Inexistente, archivada o de un tipo sin vista: la lista, sin rastro.
    return aLaLista(entrada, "");
  }

  if (esEnlaceViejoAlCorreo(entrada) || limpio(entrada.modo) === "correo") {
    const foco = limpio(entrada.foco);
    if (foco && esEnlaceViejoAlCorreo(entrada)) {
      const { cid, bloque } = partirFocoViejo(foco);
      const campana = campanaPorId(registro, idDeCorreo(cid));
      return campana && !campana.archived ? aCorreo(campana, entrada, bloque) : aLaLista(entrada, "");
    }
    const unica = laUnicaDe(registro, "correo");
    return unica ? aCorreo(unica, entrada, esEnlaceViejoAlCorreo(entrada) ? null : foco || null) : aLaLista(entrada, "");
  }

  if (limpio(entrada.modo) === "aulas" || nombraAlgoDeAulas(entrada)) {
    const aulas = laUnicaDe(registro, "aulas");
    return aulas ? aAulas(aulas, entrada) : aLaLista(entrada, "");
  }

  return aLaLista(entrada);
}
