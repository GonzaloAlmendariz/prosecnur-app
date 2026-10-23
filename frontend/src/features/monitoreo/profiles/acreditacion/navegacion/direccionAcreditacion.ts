/**
 * Dirección pública del modo Acreditación y la vista de la página que monta
 * cada pestaña.
 *
 * El revamp (`docs/qa/revamp-monitoreo/acreditacion.md` §1) pasó el modo de
 * cinco secciones y 24 pestañas al esqueleto común de cuatro secciones y 20
 * pestañas. Mientras una pestaña no tiene contenido propio monta la vista de
 * hoy que absorbe (tabla de `plan-ui-acreditacion.md`, A1). Las direcciones
 * viejas (`fuentes`, `consultas`, `telefonico` y las pestañas históricas de
 * `modelo` y `avance`) se leen como alias y nunca se escriben.
 */

import { crearTablaDeDirecciones, entradaDeTabla as entrada } from "../../../core/tablaDeDirecciones";
import type { DireccionPublica, EntradaDeTabla, VistaInterna } from "../../../core/tablaDeDirecciones";
import { clavesAceptadasDeFuentes, resolverPestanaDeFuentes } from "../fuentes/pestanas";

export type SeccionAcreditacion = "insumos" | "modelo" | "control" | "avance";

export type SeccionInterna = "fuentes" | "modelo" | "consultas" | "telefonico" | "avance";

export type DireccionAcreditacion = DireccionPublica<SeccionAcreditacion>;

export type { VistaInterna };

const TABLA: readonly EntradaDeTabla<SeccionAcreditacion>[] = [
  entrada("insumos", "publicos", null, { seccion: "fuentes", pestana: "actores" }),
  entrada("insumos", "fuentes", null, { seccion: "fuentes", pestana: "fuentes" }, "Fuentes"),
  entrada("insumos", "fuentes", "recopiladores", { seccion: "fuentes", pestana: "recopiladores" }, "Recopiladores"),
  entrada("insumos", "reglas", null, { seccion: "telefonico", pestana: "estados" }),
  entrada("modelo", "metas", null, { seccion: "modelo", pestana: "estructura" }),
  entrada("modelo", "cuotas", null, { seccion: "modelo", pestana: "distribucion" }),
  entrada("modelo", "ventana", null, { seccion: "modelo", pestana: "estrategias" }),
  // Grupo Contacto: existe solo si el estudio declara el canal.
  entrada("control", "correo", null, { seccion: "avance", pestana: "correo" }),
  entrada("control", "barrido", null, { seccion: "telefonico", pestana: "resumen" }, "Barrido"),
  entrada("control", "barrido", "ritmo", { seccion: "telefonico", pestana: "dia" }, "Ritmo diario"),
  entrada("control", "reintentos", null, { seccion: "telefonico", pestana: "incidencia" }),
  entrada("control", "equipo", null, { seccion: "telefonico", pestana: "responsables" }),
  // Grupo Casos.
  entrada("control", "resolver", null, { seccion: "consultas", pestana: "subsanacion" }),
  entrada("control", "cruce", null, { seccion: "consultas", pestana: "cruces" }),
  entrada("control", "calidad", null, { seccion: "telefonico", pestana: "alertas" }, "Señales"),
  entrada("control", "calidad", "supervision", { seccion: "telefonico", pestana: "supervision" }, "Supervisión"),
  entrada("control", "personas", null, { seccion: "consultas", pestana: "base" }),
  entrada("control", "respuestas", null, { seccion: "consultas", pestana: "plataforma" }),
  entrada("avance", "resumen", null, { seccion: "avance", pestana: "resumen" }),
  entrada("avance", "publicos", null, { seccion: "avance", pestana: "actores" }),
  entrada("avance", "cuotas", null, { seccion: "avance", pestana: "cuotas" }, "Cuotas"),
  entrada("avance", "cuotas", "detalle", { seccion: "avance", pestana: "detalle" }, "Variables de control"),
  entrada("avance", "ritmo", null, { seccion: "avance", pestana: "encuestas" }),
  entrada("avance", "salidas", null, { seccion: "avance", pestana: "salidas" }),
];

/** Donde aterriza el modo: el faltante por público (procedimientos respondidos, D2). */
export const ATERRIZAJE_ACREDITACION: VistaInterna = { seccion: "avance", pestana: "actores" };

export const SECCIONES_ACREDITACION: readonly SeccionAcreditacion[] = ["insumos", "modelo", "control", "avance"];

/** Pestañas del grupo Contacto de Control: condicionales, separadas de Casos en el rail. */
export const PESTANAS_DE_CONTACTO: readonly string[] = ["correo", "barrido", "reintentos", "equipo"];

const tabla = crearTablaDeDirecciones<SeccionAcreditacion>({
  secciones: SECCIONES_ACREDITACION,
  seccionesInternas: ["fuentes", "modelo", "consultas", "telefonico", "avance"],
  tabla: TABLA,
  ocultas: {
    "modelo/resumen": { seccion: "modelo", pestana: "estructura" },
    // Las claves viejas de Fuentes (`survey`, `collectors`…) se leen como su pestaña de hoy.
    ...Object.fromEntries(clavesAceptadasDeFuentes().map((clave) => [
      `fuentes/${clave}`,
      { seccion: "fuentes", pestana: resolverPestanaDeFuentes(clave) },
    ])),
  },
  internaPorDefecto: {
    fuentes: { seccion: "fuentes", pestana: "actores" },
    modelo: { seccion: "modelo", pestana: "estructura" },
    consultas: { seccion: "consultas", pestana: "subsanacion" },
    telefonico: { seccion: "telefonico", pestana: "resumen" },
    avance: ATERRIZAJE_ACREDITACION,
  },
  aterrizaje: ATERRIZAJE_ACREDITACION,
  superpuestos: {
    // Inspector del público en Avance › Por público: `panel=publico&foco=<público>`.
    "avance/publicos": ["publico"],
    // Editor de una cuota (`AvanceCuotasPanel`), hasta que pase a Modelo › Cuotas (M2).
    "avance/cuotas": ["cuota"],
  },
});

export const {
  direccionDeVista,
  pestanasDeSeccion,
  vistaPrincipal,
  vistaDeSeccion,
  subvistasDePestana,
  vistaPedida,
  vistaInicial,
  pideOtraVista,
  vistaDeSeccionPedida,
  panelesSuperpuestos,
  esSeccion: esSeccionAcreditacion,
} = tabla;

/** Todo `panel` que el perfil escribe: sub-vistas y superpuestos. */
export const PANELES_DEL_PERFIL = tabla.panelesDelPerfil;
