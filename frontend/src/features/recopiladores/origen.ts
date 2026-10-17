// Unidades › Origen (E1e): de dónde sale la lista y qué cambió en la fuente.
//
// Puro: recibe la respuesta de `GET /api/recopiladores/origen` y devuelve lo que
// se pinta. La pestaña no decide qué decir; sólo lo dibuja. Así cada frase se
// prueba sin montar React.
//
// Material de campo no decide las unidades: las recibe de otro módulo y las
// cita. Esta pestaña es donde se ve si lo citado sigue siendo cierto.

import type {
  CollectionOrigen,
  CollectionOrigenCambio,
  CollectionOrigenConteo,
  CollectionOrigenUnidad,
} from "../../api/recopiladores";
import { fechaDeCorrida } from "./fechaDeCorrida";

export const DIRECCION_ORIGEN = "/material-campo?seccion=unidades&pestana=origen";
export const DIRECCION_LISTA = "/material-campo?seccion=unidades&pestana=lista";
/** La selección de cursos-horario, donde se decide qué entra a campo. */
export const DIRECCION_SELECCION_CALC = "/calc-muestra?modo=opinion-universitaria&seccion=aulas";
/** Entrega › Pase a Monitoreo: el lado de Cálculo que lee este módulo. */
export const DIRECCION_ENTREGA_CALC =
  "/calc-muestra?modo=opinion-universitaria&seccion=salidas&pestana=salidas-monitoreo";
/** La agenda de cursos-horario de Monitoreo, cuando es la fuente que manda. */
export const DIRECCION_AGENDA_MONITOREO = "/monitoreo?seccion=modelo";

function n(valor: number): string {
  return valor.toLocaleString("es-PE");
}

function plural(valor: number, uno: string, varios: string): string {
  return `${n(valor)} ${valor === 1 ? uno : varios}`;
}

/**
 * La fecha del sorteo, corta: `sel_aulas_20260815…` → «15/8/2026». Sin año
 * cuando la frase ya lo tiene claro («del 1/8»). Un id sin fecha no inventa una.
 */
export function fechaDelSorteo(runId: string | null | undefined, conAnio = true): string {
  // Acepta el sello del run (`…20260815093000…`), la `fecha` del backend
  // («2026-08-15») o un instante ISO («2026-08-15T09:30:00Z», `generado_at`).
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(String(runId ?? "").trim())
    ?? /(\d{4})(\d{2})(\d{2})\d{4}/.exec(String(runId ?? ""));
  if (!m) return "";
  const [, anio, mes, dia] = m;
  const mi = Number(mes);
  const di = Number(dia);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return "";
  return conAnio ? `${di}/${mi}/${anio}` : `${di}/${mi}`;
}

/** `sha256:a3f2…19ce` → «a3f2…ce». Lo justo para comparar dos a ojo. */
export function huellaCorta(huella: string | null | undefined): string {
  const hex = String(huella ?? "").replace(/^[a-z0-9]+:/i, "").trim();
  if (hex.length <= 8) return hex;
  return `${hex.slice(0, 4)}…${hex.slice(-2)}`;
}

const MODULO: Readonly<Record<string, string>> = {
  "calc-muestra": "Cálculo de muestra",
  monitoreo: "Monitoreo",
  "hojas-ruta": "Hojas de ruta",
};

const ORIGEN: Readonly<Record<string, string>> = {
  calc_muestra_aulas_selection: "Selección de cursos-horario",
  monitoreo_aulas_plan: "Agenda de cursos-horario",
};

export function nombreDelModulo(slug: string): string {
  return MODULO[slug] ?? slug;
}

/** «Selección de cursos-horario · Cálculo de muestra». */
export function tituloDeLaFuente(origen: CollectionOrigen): string {
  const que = ORIGEN[origen.fuente.origen] ?? "";
  const modulo = origen.fuente.modulo ? nombreDelModulo(origen.fuente.modulo) : "";
  if (que && modulo) return `${que} · ${modulo}`;
  return que || modulo || "Sin fuente";
}

/** «2.616 unidades · sorteo del 21/8/2026 · la lista no se edita aquí». */
export function detalleDeLaFuente(origen: CollectionOrigen): string {
  const partes: string[] = [];
  if (origen.fuente.unidades !== null) partes.push(plural(origen.fuente.unidades, "unidad", "unidades"));
  const fecha = fechaDelSorteo(origen.fuente.fecha || origen.fuente.run_id);
  if (fecha) partes.push(`sorteo del ${fecha}`);
  partes.push("la lista no se edita aquí");
  return partes.join(" · ");
}

/** Adónde lleva «Abrir en …» y «Abrir la selección», según quién manda. */
export function enlacesDeLaFuente(origen: CollectionOrigen): {
  modulo: { label: string; to: string } | null;
  seleccion: { label: string; to: string } | null;
} {
  if (origen.fuente.modulo === "monitoreo") {
    return {
      modulo: { label: "Abrir en Monitoreo", to: DIRECCION_AGENDA_MONITOREO },
      seleccion: { label: "Abrir la selección", to: DIRECCION_SELECCION_CALC },
    };
  }
  if (origen.fuente.modulo === "calc-muestra") {
    return {
      modulo: { label: "Abrir en Cálculo de muestra", to: DIRECCION_ENTREGA_CALC },
      seleccion: { label: "Abrir la selección", to: DIRECCION_SELECCION_CALC },
    };
  }
  return { modulo: null, seleccion: null };
}

// ---------------------------------------------------------------------------
// Vigencia
// ---------------------------------------------------------------------------

export type TonoDelOrigen = "al-dia" | "cambio" | "vacio";

export type VigenciaDelOrigen = {
  tono: TonoDelOrigen;
  /** La palabra de la tarjeta: «Vigente», «La fuente cambió». */
  etiqueta: string;
  /** El título del recuadro del panel. */
  titulo: string;
  /** Una frase por hecho; ninguna explica lo que la pantalla ya muestra. */
  frases: string[];
};

/** «Entran 2, salen 0, cambian 1»: el conteo en una línea. */
export function lineaDelConteo(conteo: CollectionOrigenConteo): string {
  const partes = [
    `entran ${n(conteo.altas)}`,
    `salen ${n(conteo.bajas)}`,
    // «Cambian» son los datos (filas de Cambios); el rol va aparte. Las
    // `unidades_con_cambios` del backend incluyen las de rol y lo contarían dos veces.
    `cambian ${n(conteo.campos)}`,
  ];
  if (conteo.roles > 0) partes.push(`${n(conteo.roles)} de rol`);
  const linea = partes.join(", ");
  return linea.charAt(0).toUpperCase() + linea.slice(1);
}

export function vigenciaDelOrigen(origen: CollectionOrigen): VigenciaDelOrigen {
  if (origen.estado === "sin_plan") {
    return { tono: "vacio", etiqueta: "Sin plan", titulo: "Todavía no hay plan", frases: [] };
  }
  if (origen.estado === "sin_fuente") {
    return {
      tono: "vacio",
      etiqueta: "Sin fuente",
      titulo: "No hay fuente con qué comparar",
      frases: ["El plan se conserva tal como se armó."],
    };
  }

  const { resumen } = origen;
  if (!origen.stale && origen.estado === "al_dia") {
    return {
      tono: "al-dia",
      etiqueta: "Vigente",
      titulo: "Al día con la fuente",
      frases: origen.solo_corrida
        ? ["La lista coincide con la huella de la fuente.", "Hay un sorteo más reciente con las mismas unidades."]
        : ["La lista coincide con la huella de la fuente."],
    };
  }

  const frases: string[] = [];
  if (origen.solo_corrida) {
    frases.push("Hay un sorteo más reciente con las mismas unidades.");
  } else {
    if (resumen.altas) frases.push(`${plural(resumen.altas, "unidad entra", "unidades entran")} a la lista.`);
    if (resumen.bajas) frases.push(`${plural(resumen.bajas, "unidad sale", "unidades salen")} de la lista.`);
    if (resumen.campos) {
      frases.push(resumen.campos === 1 ? "1 dato cambió en la fuente." : `${n(resumen.campos)} datos cambiaron en la fuente.`);
    }
    if (resumen.roles) frases.push(`${plural(resumen.roles, "unidad cambia", "unidades cambian")} de rol.`);
  }
  // Una ficha por unidad: lo que se desactualiza son las unidades AFECTADAS
  // con ficha, no los juegos generados (`afectadas.fichas` cuenta juegos) ni
  // todas las fichas del plan (`fichas_cobertura`).
  const conFicha = resumen.afectadas?.unidades_con_ficha ?? 0;
  if (conFicha > 0) {
    frases.push(conFicha === 1
      ? "1 ficha generada queda desactualizada."
      : `${n(conFicha)} fichas generadas quedan desactualizadas.`);
  }
  if (resumen.entregado) frases.push("El plan ya se entregó a Monitoreo.");
  return { tono: "cambio", etiqueta: "La fuente cambió", titulo: "La fuente cambió", frases };
}

// ---------------------------------------------------------------------------
// La acción
// ---------------------------------------------------------------------------

export type AccionActualizar = {
  /** Primario sólo si hay algo que actualizar. */
  primaria: boolean;
  deshabilitada: boolean;
  /** Por qué no se puede, cuando no se puede. */
  motivo: string;
  /** Dónde se resuelve lo que la bloquea. */
  resolver: { label: string; to: string } | null;
};

export function accionActualizar(origen: CollectionOrigen): AccionActualizar | null {
  if (origen.estado === "sin_plan") return null;
  if (origen.fuente_intermedia_desfasada) {
    return {
      primaria: false,
      deshabilitada: true,
      motivo: "La agenda de Monitoreo es anterior a la selección vigente. Actualízala allí primero.",
      resolver: { label: "Abrir Monitoreo", to: DIRECCION_AGENDA_MONITOREO },
    };
  }
  if (origen.estado === "sin_fuente" || !origen.fuente.disponible) {
    return {
      primaria: false,
      deshabilitada: true,
      motivo: "No hay una selección vigente de la que actualizar.",
      resolver: null,
    };
  }
  return { primaria: origen.stale, deshabilitada: false, motivo: "", resolver: null };
}

// ---------------------------------------------------------------------------
// Qué entrega, qué pasa si cambia y qué se ve del otro lado
// ---------------------------------------------------------------------------

export function queEntrega(origen: CollectionOrigen): string[] {
  if (origen.adapter && origen.adapter !== "aulas_v1") {
    return ["Las unidades del plan, con su código y su rol"];
  }
  return [
    "Cursos-horario titulares, con sus reservas y el banco",
    "Docente, aula, horario, facultad y matriculados",
    "El código operativo de cada aula",
  ];
}

export const SI_LA_FUENTE_CAMBIA =
  "Nada se regenera solo. Actualizar rehace la lista entera y descarta las fichas y archivos generados.";

export function delOtroLado(origen: CollectionOrigen): string {
  if (origen.fuente.modulo === "monitoreo") {
    return "Monitoreo sigue con su agenda; esta lista la toma de ahí.";
  }
  return "En Cálculo de muestra › Entrega se ve si Material de campo está al día con la selección.";
}

/**
 * «a3f2…19 · sorteo del 15/8/2026». La fecha es la del sorteo del plan; si su
 * corrida no la lleva en el id, la de generación de la selección vigente
 * cuando el plan es de ese mismo sorteo.
 */
export function huellaYVigencia(origen: CollectionOrigen): { huella: string; cuando: string } {
  const fecha = fechaDelSorteo(origen.plan.fecha || origen.plan.run_id)
    // Sólo si el plan ES de ese sorteo: la fecha de otra corrida no es la suya.
    || (origen.sorteo_vigente && !origen.sorteo_vigente.desfasado
      ? fechaDelSorteo(origen.sorteo_vigente.generado_at) : "");
  return {
    huella: huellaCorta(origen.fingerprint_plan ?? origen.plan.huella_registrada),
    cuando: fecha ? `sorteo del ${fecha}` : "",
  };
}

// ---------------------------------------------------------------------------
// La lista de diferencias
// ---------------------------------------------------------------------------

export type FiltroDeDiferencias = "todas" | "altas" | "bajas" | "cambios" | "roles";

export type TipoDeDiferencia = "alta" | "baja" | "cambio" | "rol";

export type FilaDeDiferencia = {
  key: string;
  tipo: TipoDeDiferencia;
  /** «Entra», «Sale», «Cambia», «Rol». */
  rotulo: string;
  codigo: string;
  /** Qué unidad o qué dato. */
  que: string;
  /** «H-105 → H-110»; vacío si no aplica. */
  antes: string;
  despues: string;
};

const ROTULO_ROL: Readonly<Record<string, string>> = {
  titular: "Titular",
  chain_reserve: "Reserva",
  reserva: "Reserva",
  extra_reserve_pool: "Banco",
};

export function rotuloDelRol(rol: string | null | undefined): string {
  const clave = String(rol ?? "").toLowerCase().replace(/[ -]+/g, "_");
  return ROTULO_ROL[clave] ?? (rol ? String(rol) : "");
}

const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  codigo: "Código",
  label: "Nombre",
  facultad: "Facultad",
  escuela: "Escuela",
  curso: "Curso",
  horario: "Horario",
  aula: "Aula",
  docente: "Docente",
  elegibles: "Elegibles",
  matriculados: "Matriculados",
  muestra: "Muestra",
  composicion: "Composición",
  rol: "Rol",
  cadena: "Cadena",
  orden: "Orden en la cadena",
  secuencia: "Secuencia",
};

export function rotuloDelCampo(campo: string): string {
  return ROTULO_CAMPO[campo] ?? campo;
}

function valorVisible(valor: string | null, campo: string): string {
  if (valor === null) return "";
  if (valor === "") return "vacío";
  return campo === "rol" ? rotuloDelRol(valor) : valor;
}

function deUnidad(u: CollectionOrigenUnidad, tipo: "alta" | "baja"): FilaDeDiferencia {
  const rol = rotuloDelRol(u.rol);
  return {
    key: `${tipo}:${u.clave}`,
    tipo,
    rotulo: tipo === "alta" ? "Entra" : "Sale",
    codigo: u.codigo || u.clave,
    que: [rol, u.curso, u.facultad].filter(Boolean).join(" · "),
    antes: "",
    despues: "",
  };
}

function deCambio(c: CollectionOrigenCambio, tipo: "cambio" | "rol"): FilaDeDiferencia {
  const campo = rotuloDelCampo(c.campo);
  return {
    key: `${tipo}:${c.clave}:${c.campo}`,
    tipo,
    rotulo: tipo === "rol" ? "Rol" : "Cambia",
    codigo: c.codigo || c.clave,
    // Lo sensible se nombra sin valores: que cambió, no a qué.
    que: c.sensible ? `${campo} (no se muestra)` : campo,
    antes: c.sensible ? "" : valorVisible(c.antes, c.campo),
    despues: c.sensible ? "" : valorVisible(c.despues, c.campo),
  };
}

export function filasDeDiferencias(
  origen: CollectionOrigen,
  filtro: FiltroDeDiferencias,
): FilaDeDiferencia[] {
  const cambios = origen.cambios;
  if (!cambios) return [];
  const filas: FilaDeDiferencia[] = [];
  if (filtro === "todas" || filtro === "altas") filas.push(...cambios.altas.map((u) => deUnidad(u, "alta")));
  if (filtro === "todas" || filtro === "bajas") filas.push(...cambios.bajas.map((u) => deUnidad(u, "baja")));
  if (filtro === "todas" || filtro === "cambios") filas.push(...cambios.campos.map((c) => deCambio(c, "cambio")));
  if (filtro === "todas" || filtro === "roles") filas.push(...cambios.roles.map((c) => deCambio(c, "rol")));
  return filas;
}

export type OpcionDeFiltro = { value: FiltroDeDiferencias; label: string; count: number };

export function opcionesDeFiltro(origen: CollectionOrigen): OpcionDeFiltro[] {
  const r = origen.resumen;
  return [
    { value: "todas", label: "Todas", count: r.altas + r.bajas + r.campos + r.roles },
    { value: "altas", label: "Altas", count: r.altas },
    { value: "bajas", label: "Bajas", count: r.bajas },
    { value: "cambios", label: "Cambios", count: r.campos },
    { value: "roles", label: "Roles", count: r.roles },
  ];
}

/** Las listas que el backend cortó en `limite`, dichas en una línea. */
export function avisoDeTruncado(origen: CollectionOrigen, filtro: FiltroDeDiferencias): string {
  const t = origen.truncado;
  const cortadas = (
    [
      ["altas", t.altas],
      ["bajas", t.bajas],
      ["cambios", t.campos],
      ["roles", t.roles],
    ] as const
  ).filter(([clave, cortada]) => cortada && (filtro === "todas" || filtro === clave));
  if (!cortadas.length) return "";
  return `Se muestran las primeras ${n(origen.limite)} de cada lista; el conteo de arriba es el total.`;
}

const VACIO_DEL_FILTRO: Readonly<Record<FiltroDeDiferencias, string>> = {
  todas: "La lista coincide con la fuente.",
  altas: "No entra ninguna unidad.",
  bajas: "No sale ninguna unidad.",
  cambios: "Ninguna unidad cambió sus datos.",
  roles: "Ninguna unidad cambió de rol.",
};

/** El vacío de la lista: dice por qué está vacía, no sólo que lo está. */
export function vacioDeLaLista(origen: CollectionOrigen, filtro: FiltroDeDiferencias): string {
  if (filtro === "todas" && origen.solo_corrida) return "Las unidades son las mismas; sólo cambió la corrida.";
  return VACIO_DEL_FILTRO[filtro];
}

// ---------------------------------------------------------------------------
// El aviso de Unidades › Lista
// ---------------------------------------------------------------------------

/**
 * Una línea en el resumen del plan que manda a Origen. Dos lecturas, una
 * decisión: `source_vigente` (del `/state`) dice si el plan es de OTRO sorteo;
 * el origen (por huella) dice si la fuente cambió aunque el sorteo sea el
 * mismo. Antes sólo leía lo primero y un aula cambiada en la misma corrida no
 * avisaba aquí mientras Origen decía «La fuente cambió».
 *
 * `null` = nada que avisar. Sin origen leído todavía, sólo cuenta el sorteo.
 */
export function avisoDeLaLista(
  sourceVigente: { selection_run_id: string; desfasado: boolean } | null | undefined,
  origen: CollectionOrigen | null,
): { texto: string; enlace: { label: string; to: string } } | null {
  const enlace = { label: "Ver qué cambió", to: DIRECCION_ORIGEN };
  if (sourceVigente?.desfasado) {
    // Mismo formato que el «Origen · sorteo del …» de esa tarjeta, con hora.
    const fecha = fechaDeCorrida(sourceVigente.selection_run_id);
    return {
      texto: fecha ? `La selección vigente es de otro sorteo (del ${fecha}).` : "La selección vigente es de otro sorteo.",
      enlace,
    };
  }
  if (origen && origen.plan.existe && origen.stale) {
    return { texto: "La fuente cambió desde que se armó esta lista.", enlace };
  }
  return null;
}
