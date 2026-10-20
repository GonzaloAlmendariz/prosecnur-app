// =============================================================================
// resumen/modeloResumen.ts — cifras de la pestaña «Resumen»
// =============================================================================
// Todo lo que la pestaña dice sale de aquí, calculado sobre la estructura del
// formulario que el editor ya tiene; nada se estima fuera de la regla de
// duración que el resumen usaba antes (20 s por pregunta, 30 s si elige entre
// más de 6 opciones, +10 s si es obligatoria).
// =============================================================================

import type { BuilderDiagnostic, BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { typeLabel } from "../parsing/parseType";
import { esPreguntaDelFormulario } from "../shell/editorMetrics";

/** Tipos que se responden eligiendo entre opciones; el resto se escribe o anota. */
const TIPOS_CERRADOS = new Set(["select_one", "select_multiple", "rank", "acknowledge"]);
const TIPOS_CON_LISTA = new Set(["select_one", "select_multiple", "rank"]);

export const CRITERIO_DURACION =
  "20 s por pregunta, 30 s si elige entre más de 6 opciones, +10 s si es obligatoria.";

/** Una sección pesa si concentra al menos esta parte de las preguntas. */
export const UMBRAL_SECCION_PESADA = 0.15;

export function segundosDePregunta(node: BuilderNode, tamanoLista: ReadonlyMap<string, number>): number {
  const base = node.typeInfo.base;
  const eligeEntreMuchas = (base === "select_one" || base === "select_multiple")
    && (tamanoLista.get(node.typeInfo.listName) ?? 0) > 6;
  return (eligeEntreMuchas ? 30 : 20) + (node.required ? 10 : 0);
}

export type FilaTipo = { base: string; rotulo: string; preguntas: number };

export type FilaSeccion = {
  id: string;
  /** `name` del begin_group: es lo que el Constructor enfoca con `foco`. */
  name: string;
  rotulo: string;
  orden: number;
  preguntas: number;
  obligatorias: number;
  conCondiciones: number;
  segundos: number;
  /** Parte de las preguntas del formulario (0–1). */
  peso: number;
  pesada: boolean;
  tipoPredominante: string | null;
};

export type ResumenFormulario = {
  preguntas: number;
  notas: number;
  secciones: number;
  obligatorias: number;
  conCondiciones: number;
  cerradas: number;
  abiertas: number;
  listas: number;
  segundos: number;
  /** El recorrido de quien sólo ve lo que aparece para todos: sin preguntas con condición propia ni heredada de su
   *  sección (S14: 301 min sumaba también lo que casi nadie ve). `segundos` es el máximo; esto, el piso. */
  segundosSinCondicion: number;
  /** Preguntas con condición propia o heredada de una sección. */
  condicionales: number;
  tipos: FilaTipo[];
  filasSecciones: FilaSeccion[];
  /** Preguntas de selección sin lista o con una lista que no existe en `choices`. */
  sinLista: { rowIndex: number; name: string }[];
};

function contarTipos(nodos: readonly BuilderNode[]): FilaTipo[] {
  const cuenta = new Map<string, number>();
  for (const n of nodos) {
    const base = n.typeInfo.base || "sin_tipo";
    cuenta.set(base, (cuenta.get(base) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([base, preguntas]) => ({ base, rotulo: typeLabel(base), preguntas }))
    .sort((a, b) => b.preguntas - a.preguntas || a.rotulo.localeCompare(b.rotulo, "es"));
}

export function resumirFormulario(
  structure: BuilderStructure | null,
  catalogos: readonly CatalogSummary[],
): ResumenFormulario {
  const outline = structure?.outline ?? [];
  // Inicio, fin, dispositivo… los registra el teléfono: no son preguntas ni suman tiempo (S14/S16).
  // Misma noción que la cabecera del editor (`editorMetrics.esPreguntaDelFormulario`).
  const preguntas = outline.filter(esPreguntaDelFormulario);
  const tamanoLista = new Map(catalogos.map((c) => [c.listName, c.items.length]));
  const listasConocidas = new Set(catalogos.map((c) => c.listName));
  const total = preguntas.length;

  const secciones = [...(structure?.sections.values() ?? [])]
    .filter((s) => s.kind !== "root")
    .sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));

  const filaDe = (id: string, name: string, rotulo: string, orden: number): FilaSeccion => {
    const propias = preguntas.filter((n) => n.sectionId === id);
    const segundos = propias.reduce((acc, n) => acc + segundosDePregunta(n, tamanoLista), 0);
    const peso = total ? propias.length / total : 0;
    return {
      id,
      name,
      rotulo,
      orden,
      preguntas: propias.length,
      obligatorias: propias.filter((n) => n.required).length,
      conCondiciones: propias.filter((n) => n.relevant.trim() !== "").length,
      segundos,
      peso,
      pesada: total > 0 && peso >= UMBRAL_SECCION_PESADA,
      tipoPredominante: contarTipos(propias)[0]?.rotulo ?? null,
    };
  };

  const filasSecciones = secciones.map((s, i) => filaDe(s.id, s.name, s.label || s.name, i + 1));
  const enRaiz = preguntas.filter((n) => n.sectionId === "root");
  if (enRaiz.length > 0) filasSecciones.unshift(filaDe("root", "", "Fuera de toda sección", 0));

  // Una pregunta es condicional si ella o alguna de sus secciones tiene `relevant`.
  const seccionCondicional = new Map<string, boolean>();
  const condicionalSeccion = (id: string | null | undefined): boolean => {
    if (!id || id === "root") return false;
    const previo = seccionCondicional.get(id);
    if (previo !== undefined) return previo;
    const meta = structure?.sections.get(id);
    const propia = meta?.rowIndex != null && (structure?.byRow.get(meta.rowIndex)?.relevant ?? "").trim() !== "";
    const r = propia || condicionalSeccion(meta?.parentId);
    seccionCondicional.set(id, r);
    return r;
  };
  const esCondicional = (n: BuilderNode) => n.relevant.trim() !== "" || condicionalSeccion(n.sectionId);
  const siempre = preguntas.filter((n) => !esCondicional(n));

  return {
    preguntas: total,
    notas: outline.filter((n) => n.kind === "note").length,
    secciones: secciones.length,
    obligatorias: preguntas.filter((n) => n.required).length,
    conCondiciones: preguntas.filter((n) => n.relevant.trim() !== "").length,
    cerradas: preguntas.filter((n) => TIPOS_CERRADOS.has(n.typeInfo.base)).length,
    abiertas: preguntas.filter((n) => !TIPOS_CERRADOS.has(n.typeInfo.base)).length,
    listas: catalogos.length,
    segundos: preguntas.reduce((acc, n) => acc + segundosDePregunta(n, tamanoLista), 0),
    segundosSinCondicion: siempre.reduce((acc, n) => acc + segundosDePregunta(n, tamanoLista), 0),
    condicionales: total - siempre.length,
    tipos: contarTipos(preguntas),
    filasSecciones,
    sinLista: preguntas
      .filter((n) => TIPOS_CON_LISTA.has(n.typeInfo.base))
      .filter((n) => !n.typeInfo.listName || !listasConocidas.has(n.typeInfo.listName))
      .map((n) => ({ rowIndex: n.rowIndex, name: n.name })),
  };
}

/** Rótulo de una marca del eje: «45 min», «1 h», «1 h 30». */
export function rotuloMinutos(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

/** Minutos para mostrar: enteros; bajo un minuto, «< 1». */
export function minutos(segundos: number): string {
  if (segundos <= 0) return "0";
  return segundos < 60 ? "< 1" : String(Math.round(segundos / 60));
}

/** Duración como rango: del piso (lo que todos ven) al máximo (si se abre cada condición). «12–18 min» o «≈ 12 min» si coinciden (S14). */
export function rangoMinutos(piso: number, maximo: number): string {
  const a = minutos(Math.min(piso, maximo));
  const b = minutos(Math.max(piso, maximo));
  return a === b ? `≈ ${b} min` : `${a}–${b} min`;
}

/** Duración legible: «< 1 min» o «~N min». */
export function duracion(segundos: number): string {
  const m = minutos(segundos);
  return m === "< 1" ? "< 1 min" : `~${m} min`;
}

/** Pasos posibles del eje, en minutos: se usa el menor que deja como mucho `MAX_MARCAS` rótulos. */
const PASOS = [5, 10, 15, 20, 30, 60, 90, 120];
const MAX_MARCAS = 6;

/** Marcas del recorrido en el tiempo: un paso redondo que no amontona rótulos (S14: 31 rótulos montados en 301 min). */
export function marcasDeMinutos(segundos: number): number[] {
  const total = segundos / 60;
  if (total <= 0) return [];
  const paso = PASOS.find((p) => total / p <= MAX_MARCAS) ?? Math.ceil(total / MAX_MARCAS / 60) * 60;
  const marcas: number[] = [];
  for (let m = 0; m <= total + 1e-9; m += paso) marcas.push(m);
  return marcas;
}

export function porcentaje(parte: number, total: number): string {
  if (!total) return "0 %";
  return `${Math.round((parte / total) * 100)} %`;
}

// ── Orden de la tabla de secciones ──────────────────────────────────────────

export type ColumnaOrden = "orden" | "preguntas" | "obligatorias" | "conCondiciones" | "segundos";
export type Orden = { columna: ColumnaOrden; descendente: boolean };

export function ordenarSecciones(filas: readonly FilaSeccion[], orden: Orden): FilaSeccion[] {
  const signo = orden.descendente ? -1 : 1;
  return [...filas].sort((a, b) => signo * (a[orden.columna] - b[orden.columna]) || a.orden - b.orden);
}

/** Primer click en una columna numérica ordena de mayor a menor; en «orden», del primero al último. */
export function siguienteOrden(actual: Orden, columna: ColumnaOrden): Orden {
  if (actual.columna !== columna) return { columna, descendente: columna !== "orden" };
  return { columna, descendente: !actual.descendente };
}

// ── Qué falta para publicar e imprimir ──────────────────────────────────────

export type EstadoPendiente = "listo" | "aviso" | "error" | "neutro";

export type AccionPendiente =
  | { tipo: "revisar-logica" }
  | { tipo: "listas" }
  | { tipo: "fila"; rowIndex: number }
  /** `rowIndex`, si se conoce, es la fila que recibe el foco del teclado al llegar al Constructor. */
  | { tipo: "pregunta"; name: string; rowIndex?: number }
  | { tipo: "impreso" };

export type Pendiente = {
  clave: "logica" | "escalas" | "avisos" | "sin-lista" | "impreso";
  estado: EstadoPendiente;
  titulo: string;
  detalle: string;
  accion?: { rotulo: string; destino: AccionPendiente };
};

export type EntradaPendientes = {
  logica: { pendiente: boolean; externa: string | null };
  escalasRepetidas: number;
  /** Los mismos números de la cabecera (`deriveEditorHeaderStatus`). `correcciones` son las que pide la publicación
   *  y la cabecera sólo las anuncia cuando no hay errores locales: el Resumen sigue esa misma regla. */
  diagnosticos: { errores: number; avisos: number; correcciones: number; primero: AccionPendiente | null };
  sinLista: ResumenFormulario["sinLista"];
  impreso: { estado: "sin-previa" | "al-dia" | "vieja"; paginas: number | null };
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function pendientesParaPublicar(e: EntradaPendientes): Pendiente[] {
  const items: Pendiente[] = [];

  items.push(
    e.logica.pendiente
      ? {
          clave: "logica",
          estado: "aviso",
          titulo: "Lógica por revisar",
          detalle: "Confirma los saltos importados antes de publicar.",
          accion: { rotulo: "Revisar la lógica", destino: { tipo: "revisar-logica" } },
        }
      : e.logica.externa
        ? { clave: "logica", estado: "neutro", titulo: "Lógica externa", detalle: e.logica.externa }
        : { clave: "logica", estado: "listo", titulo: "Lógica sin pasos pendientes", detalle: "Nada que confirmar antes de publicar." },
  );

  items.push(
    e.escalasRepetidas > 0
      ? {
          clave: "escalas",
          estado: "aviso",
          titulo: plural(e.escalasRepetidas, "escala repetida", "escalas repetidas"),
          detalle: "Unificarlas deja una sola lista por escala.",
          accion: { rotulo: "Unificar", destino: { tipo: "listas" } },
        }
      : { clave: "escalas", estado: "listo", titulo: "Sin escalas repetidas", detalle: "Cada escala vive en una sola lista." },
  );

  const { errores, avisos, correcciones, primero } = e.diagnosticos;
  const irAlPrimero = primero ? { accion: { rotulo: "Ir al primero", destino: primero } } : {};
  items.push(
    errores + avisos > 0
      ? {
          clave: "avisos",
          estado: errores > 0 ? "error" : "aviso",
          titulo: [errores ? plural(errores, "error", "errores") : "", avisos ? plural(avisos, "aviso", "avisos") : ""]
            .filter(Boolean).join(" y "),
          detalle: errores > 0 ? "Un error impide publicar la revisión." : "No impiden publicar, pero conviene mirarlos.",
          ...irAlPrimero,
        }
      : correcciones > 0
        ? {
            clave: "avisos",
            estado: "error",
            titulo: plural(correcciones, "corrección pendiente", "correcciones pendientes"),
            detalle: "Las pide la publicación de la revisión.",
          }
        : { clave: "avisos", estado: "listo", titulo: "Sin avisos del formulario", detalle: "La estructura y las referencias están en orden." },
  );

  items.push(
    e.sinLista.length > 0
      ? {
          clave: "sin-lista",
          estado: "error",
          titulo: `${plural(e.sinLista.length, "pregunta", "preguntas")} sin lista`,
          detalle: "Son de selección y no tienen opciones.",
          accion: { rotulo: "Abrir la primera", destino: { tipo: "pregunta", name: e.sinLista[0].name, rowIndex: e.sinLista[0].rowIndex } },
        }
      : { clave: "sin-lista", estado: "listo", titulo: "Ninguna pregunta sin lista", detalle: "Nada que completar en las opciones." },
  );

  const { estado, paginas } = e.impreso;
  items.push(
    estado === "al-dia"
      ? {
          clave: "impreso",
          estado: "listo",
          titulo: "El impreso tiene previa",
          detalle: `${paginas ? `${plural(paginas, "página", "páginas")} en A4. ` : ""}Al día con el formulario.`,
          accion: { rotulo: "Ver", destino: { tipo: "impreso" } },
        }
      : {
          clave: "impreso",
          estado: estado === "vieja" ? "aviso" : "neutro",
          titulo: estado === "vieja" ? "Previa del impreso vieja" : "Impreso sin previa",
          detalle: estado === "vieja"
            ? "El formulario cambió después de generarla."
            : "El número de páginas sale con el PDF.",
          accion: { rotulo: "Abrir Impreso", destino: { tipo: "impreso" } },
        },
  );

  return items;
}

/** Cuántas filas de «Qué falta» piden algo: las que no están listas y llevan adónde resolverlo. Es el número del
 *  contador, contado sobre las mismas filas que se pintan. */
export function tareasPendientes(items: readonly Pendiente[]): number {
  return items.filter((i) => i.estado !== "listo" && i.accion).length;
}

/** Adónde lleva «Ir al primero»: el primer error en el orden del formulario (o el primer aviso si no hay errores).
 *  Con nombre va a la pregunta por `foco`, que la deja elegida en el Constructor; si no, a la fila. */
export function primerDiagnostico(
  diagnosticos: readonly BuilderDiagnostic[],
  nombreDeFila: (rowIndex: number) => string | null,
): AccionPendiente | null {
  const conFila = diagnosticos.filter((d): d is BuilderDiagnostic & { rowIndex: number } => d.rowIndex != null);
  const errores = conFila.filter((d) => d.level === "error");
  const candidatos = (errores.length ? errores : conFila).slice().sort((a, b) => a.rowIndex - b.rowIndex);
  const conNombre = candidatos.find((d) => nombreDeFila(d.rowIndex));
  if (conNombre) return { tipo: "pregunta", name: nombreDeFila(conNombre.rowIndex) as string, rowIndex: conNombre.rowIndex };
  return candidatos[0] ? { tipo: "fila", rowIndex: candidatos[0].rowIndex } : null;
}
