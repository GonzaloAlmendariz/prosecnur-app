// Listas de opciones ENTRE formularios del proyecto (checklist importación SM
// 2026-10-14, H7 ampliado: «que las listas entre formularios sean las mismas o
// por lo menos lo sugiera»).
//
// Un proyecto multiactor (Estudiantes, Docentes, Administrativos) repite las
// mismas preguntas de caracterización, pero la importación de SurveyMonkey
// nombra cada lista por posición (`lst_p3`). Este módulo puro compara las
// listas del formulario ACTIVO con las de los demás:
//
// - Idéntica: mismos códigos y etiquetas (normalizadas), en el mismo orden.
//   Se propone un nombre común y se puede renombrar en el formulario activo.
// - Misma escala con códigos distintos: mismas etiquetas, algún código cambia.
//   Sólo se ADVIERTE: cambiar códigos altera los datos ya recogidos.
//
// El nombre común es determinista —no depende de qué formulario esté abierto—
// para que, abriendo uno tras otro, todos converjan al mismo nombre:
// 1. el nombre legible (no posicional) más frecuente entre las copias, con
//    desempate alfabético;
// 2. si ninguna copia lo tiene, el nombre por contenido (`acuerdo`, `genero`…).

import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import {
  analizarListas,
  listasDelFormulario,
  nombreBaseDesdeEtiquetas,
  nombreLibre,
  nombresDeListas,
  normalizarEtiqueta,
  renombrarLista,
  validarNombreLista,
  type ListaOpciones,
  type ResultadoTransformacion,
} from "./listasModel";

export type FormularioHermano = {
  id: string;
  nombre: string;
  workbook: XlsformEditorWorkbook;
};

export type CopiaEnOtroFormulario = {
  formularioId: string;
  formulario: string;
  /** Nombre de la lista en ese formulario. */
  lista: string;
};

/**
 * - `coincide`: el nombre ya es el mismo en todas las copias.
 * - `renombrar`: el formulario activo puede tomar el nombre común.
 * - `referencia`: el activo ya tiene el nombre común; faltan los otros.
 * - `unificar-primero`: la lista tiene gemela en este formulario (Escalas repetidas).
 * - `bloqueado`: el nombre común no se puede usar aquí (motivo).
 */
export type EstadoCoincidencia = "coincide" | "renombrar" | "referencia" | "unificar-primero" | "bloqueado";

export type CoincidenciaEntreFormularios = {
  lista: string;
  opciones: ListaOpciones["opciones"];
  preguntas: number;
  copias: CopiaEnOtroFormulario[];
  nombreComun: string;
  estado: EstadoCoincidencia;
  motivo: string | null;
};

export type DiferenciaCodigo = { etiqueta: string; codigoAqui: string; codigoAlla: string };

export type AdvertenciaCodigos = {
  lista: string;
  formularioId: string;
  formulario: string;
  listaOtro: string;
  diferencias: DiferenciaCodigo[];
};

export type ComparacionEntreFormularios = {
  coincidencias: CoincidenciaEntreFormularios[];
  advertencias: AdvertenciaCodigos[];
};

export type RenombreSugerido = { lista: string; nombre: string };

/** `lst_p3`, `lst_q0001`, `lst_p3_ln`, `list_12`: nombres por posición, no por contenido. */
const NOMBRE_POSICIONAL = /^(lst|list|lista)_?[pq]?\d+(_[a-z0-9]+)?$/i;

export function esNombrePosicional(nombre: string): boolean {
  return NOMBRE_POSICIONAL.test(nombre.trim());
}

function firmaIdentica(lista: ListaOpciones): string {
  return lista.opciones.map((o) => `${o.codigo.trim()}\u0001${normalizarEtiqueta(o.etiqueta)}`).join("\u0002");
}

/** Etiquetas como conjunto ordenado; sólo si no hay etiquetas repetidas ni vacías. */
function firmaEtiquetas(lista: ListaOpciones): string | null {
  const etiquetas = lista.opciones.map((o) => normalizarEtiqueta(o.etiqueta));
  if (etiquetas.some((e) => !e) || new Set(etiquetas).size !== etiquetas.length) return null;
  return [...etiquetas].sort().join("\u0002");
}

function diferenciasDeCodigo(aqui: ListaOpciones, alla: ListaOpciones): DiferenciaCodigo[] {
  const codigoAlla = new Map(alla.opciones.map((o) => [normalizarEtiqueta(o.etiqueta), o.codigo.trim()]));
  return aqui.opciones.flatMap((o) => {
    const otro = codigoAlla.get(normalizarEtiqueta(o.etiqueta));
    return otro != null && otro !== o.codigo.trim()
      ? [{ etiqueta: o.etiqueta, codigoAqui: o.codigo.trim(), codigoAlla: otro }]
      : [];
  });
}

/** Nombre legible más frecuente (desempate alfabético) o `null`. */
function nombreLegibleComun(nombres: readonly string[]): string | null {
  const conteo = new Map<string, number>();
  for (const n of nombres) {
    if (esNombrePosicional(n)) continue;
    conteo.set(n, (conteo.get(n) ?? 0) + 1);
  }
  const ordenados = [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ordenados[0]?.[0] ?? null;
}

export function compararListasEntreFormularios(
  activo: XlsformEditorWorkbook,
  otros: readonly FormularioHermano[],
): ComparacionEntreFormularios {
  const propias = listasDelFormulario(activo);
  const conGemela = new Set(analizarListas(activo).grupos.flatMap((g) => g.listas));
  const ocupadosActivo = new Set(nombresDeListas(activo));
  // Nombres cortos: los formularios de un estudio comparten prefijo
  // («Acreditación Arte y Diseño PUCP - Docentes»); repetirlo entero en cada
  // fila tapaba lo que distingue a cada uno.
  const cortos = nombresCortos(otros.map((f) => f.nombre));
  const ajenas = otros.map((f, i) => ({ formulario: { ...f, nombre: cortos[i] }, listas: listasDelFormulario(f.workbook) }));

  const coincidencias: CoincidenciaEntreFormularios[] = [];
  const advertencias: AdvertenciaCodigos[] = [];
  const reservados: string[] = [];

  for (const lista of propias) {
    const firma = firmaIdentica(lista);
    const etiquetas = firmaEtiquetas(lista);
    const copias: CopiaEnOtroFormulario[] = [];
    for (const { formulario, listas } of ajenas) {
      let advertida = false;
      for (const otra of listas) {
        if (firmaIdentica(otra) === firma) {
          copias.push({ formularioId: formulario.id, formulario: formulario.nombre, lista: otra.nombre });
          continue;
        }
        if (advertida || etiquetas == null || firmaEtiquetas(otra) !== etiquetas) continue;
        const diferencias = diferenciasDeCodigo(lista, otra);
        if (!diferencias.length) continue;
        advertida = true;
        advertencias.push({
          lista: lista.nombre,
          formularioId: formulario.id,
          formulario: formulario.nombre,
          listaOtro: otra.nombre,
          diferencias,
        });
      }
    }
    if (!copias.length) continue;

    const legible = nombreLegibleComun([lista.nombre, ...copias.map((c) => c.lista)]);
    const ocupados = new Set([...ocupadosActivo, ...reservados].filter((n) => n !== lista.nombre));
    const nombreComun = legible ?? nombreLibre(nombreBaseDesdeEtiquetas(lista.opciones), ocupados);

    let estado: EstadoCoincidencia;
    let motivo: string | null = null;
    if (nombreComun === lista.nombre) {
      estado = copias.every((c) => c.lista === lista.nombre) ? "coincide" : "referencia";
    } else if (conGemela.has(lista.nombre)) {
      estado = "unificar-primero";
      motivo = "Primero unifica sus copias en «Escalas repetidas».";
    } else {
      motivo = validarNombreLista(activo, nombreComun, [lista.nombre], reservados);
      estado = motivo ? "bloqueado" : "renombrar";
    }
    if (estado === "renombrar") reservados.push(nombreComun);
    coincidencias.push({
      lista: lista.nombre,
      opciones: lista.opciones,
      preguntas: lista.preguntas.length,
      copias,
      nombreComun,
      estado,
      motivo,
    });
  }
  return { coincidencias, advertencias };
}

/** Renombres aplicables de una comparación (para «Aplicar los nombres comunes»). */
export function renombresSugeridos(comparacion: ComparacionEntreFormularios): RenombreSugerido[] {
  return comparacion.coincidencias
    .filter((c) => c.estado === "renombrar")
    .map((c) => ({ lista: c.lista, nombre: c.nombreComun }));
}

/** Aplica varios renombres en UNA edición; si uno falla, no cambia nada. */
export function aplicarNombresComunes(
  workbook: XlsformEditorWorkbook,
  renombres: readonly RenombreSugerido[],
): ResultadoTransformacion {
  if (!renombres.length) return { ok: false, motivo: "No hay nombres comunes que aplicar." };
  let actual = workbook;
  for (const { lista, nombre } of renombres) {
    const res = renombrarLista(actual, lista, nombre);
    if (!res.ok) return res;
    actual = res.workbook;
  }
  return { ok: true, workbook: actual };
}

function enumerar(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Quita el prefijo común (hasta un separador) a una lista de nombres de
 *  formulario: «Acreditación Arte y Diseño PUCP - Docentes» → «Docentes». Con un
 *  solo nombre, se queda con lo que va tras el último « - » si existe. */
export function nombresCortos(nombres: readonly string[]): string[] {
  if (!nombres.length) return [];
  if (nombres.length === 1) {
    const n = nombres[0];
    const i = n.lastIndexOf(" - ");
    return [i > 0 && i < n.length - 3 ? n.slice(i + 3).trim() : n];
  }
  let prefijo = nombres[0];
  for (const n of nombres.slice(1)) {
    let k = 0;
    while (k < prefijo.length && k < n.length && prefijo[k] === n[k]) k += 1;
    prefijo = prefijo.slice(0, k);
  }
  const corte = Math.max(prefijo.lastIndexOf(" - "), prefijo.lastIndexOf(": "));
  const largo = corte >= 0 ? corte + (prefijo[corte] === ":" ? 2 : 3) : 0;
  return nombres.map((n) => {
    const corto = n.slice(largo).trim();
    return corto || n;
  });
}

/** «Igual en Docentes y Administrativos». */
export function describirDondeSeRepite(copias: readonly CopiaEnOtroFormulario[]): string {
  const formularios = [...new Set(copias.map((c) => c.formulario))];
  return `Igual en ${enumerar(formularios)}`;
}

/** «se llama «acuerdo» allí» o «se llama «acuerdo» en Docentes y «lst_p3» en Administrativos». */
export function describirNombresAlla(copias: readonly CopiaEnOtroFormulario[]): string {
  const nombres = [...new Set(copias.map((c) => c.lista))];
  if (nombres.length === 1) return `se llama «${nombres[0]}» allí`;
  const porNombre = nombres.map((n) => {
    const forms = [...new Set(copias.filter((c) => c.lista === n).map((c) => c.formulario))];
    return `«${n}» en ${enumerar(forms)}`;
  });
  return `se llama ${enumerar(porNombre)}`;
}

/** «Misma escala con códigos distintos en Docentes (SIN INF: 5 aquí, 99 allá)». */
export function describirAdvertencia(advertencia: AdvertenciaCodigos, max = 3): string {
  const visibles = advertencia.diferencias.slice(0, max)
    .map((d) => `${d.etiqueta}: ${d.codigoAqui} aquí, ${d.codigoAlla} allá`);
  const resto = advertencia.diferencias.length - visibles.length;
  const detalle = resto > 0 ? `${visibles.join("; ")}; +${resto} más` : visibles.join("; ");
  return `Misma escala con códigos distintos en ${advertencia.formulario} (${detalle})`;
}
