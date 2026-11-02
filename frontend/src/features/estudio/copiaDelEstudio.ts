// Vocabulario visible del estudio: un solo lugar para los nombres del tipo y
// para el modo que ese tipo fija en los demás módulos (ADR 0124).

import type { PlannerOrigen, PlannerPerfil, PlannerTipoPerfil } from "../../api/planner";

export const ETIQUETA_PERFIL: Record<PlannerTipoPerfil, string> = {
  territorial: "Territorial presencial",
  aulas: "Aulas universitarias",
  telefonico: "Telefónico",
  acreditacion: "Acreditación",
};

/**
 * Las opciones del tipo, con la variante territorial ya resuelta: un estudio
 * territorial es aleatorio (Hojas de ruta) o por cuotas, y son estudios
 * distintos. Aulas no tiene variantes: el marco de alumnos es un atributo
 * (`MARCO_DE_ALUMNOS`, ADR 0125 §3).
 */
export type OpcionTipo = "territorial:ump_aleatoria" | "territorial:conveniencia" | "aulas" | "telefonico" | "acreditacion";

export const OPCIONES_TIPO: readonly { valor: OpcionTipo; rotulo: string; diseno: string }[] = [
  { valor: "territorial:ump_aleatoria", rotulo: "Territorial aleatorio", diseno: "La muestra se sortea en Hojas de ruta, por manzanas." },
  { valor: "territorial:conveniencia", rotulo: "Territorial por cuotas", diseno: "Sin sorteo: las cuotas se fijan antes del campo." },
  { valor: "aulas", rotulo: "Aulas universitarias", diseno: "La muestra se diseña en Cálculo de muestra." },
  { valor: "telefonico", rotulo: "Telefónico", diseno: "La lista de contactos la entrega el cliente." },
  { valor: "acreditacion", rotulo: "Acreditación", diseno: "Los públicos y sus porcentajes se fijan en Monitoreo." },
];

/**
 * ADR 0125 §3: siempre cursos-horario con fichas QR. El marco sólo dice quién
 * es cada alumno, y de ahí salen sus variables y metas.
 */
export const MARCO_DE_ALUMNOS = {
  rotulo: "Con marco de alumnos",
  con: "Se sabe quién es cada alumno: sus variables y metas salen del marco. Las fichas QR van igual a los cursos-horario sorteados.",
  sin: "Anónimo. Las fichas QR van a los cursos-horario sorteados.",
} as const;

export function opcionDelPerfil(perfil: PlannerPerfil | undefined): OpcionTipo | "" {
  if (!perfil) return "";
  if (perfil.tipo === "territorial") return perfil.seleccion === "conveniencia" ? "territorial:conveniencia" : "territorial:ump_aleatoria";
  return perfil.tipo;
}

/**
 * El perfil que se declara para una opción. Si el tipo no cambia se parte del
 * que ya estaba, para no perder lo que el backend conserva (quién diseña la
 * muestra, las bases de cada población).
 */
export function perfilDeOpcion(opcion: OpcionTipo, conMarco: boolean, previo: PlannerPerfil | undefined): PlannerPerfil {
  const [tipo, variante] = opcion.split(":") as [PlannerTipoPerfil, string | undefined];
  const base: PlannerPerfil = previo && previo.tipo === tipo
    ? previo
    : { tipo, seleccion: null, diseno: tipo === "territorial" ? "hojas-ruta" : tipo === "aulas" ? "calc-muestra" : "cliente", canales: [], poblaciones: [] };
  const seleccion = tipo === "territorial" ? (variante as PlannerPerfil["seleccion"]) : tipo === "aulas" ? (conMarco ? "marco" : "conglomerados") : null;
  return {
    ...base,
    seleccion,
    diseno: tipo === "territorial" ? (variante === "conveniencia" ? "cuotas" : "hojas-ruta") : base.diseno,
  };
}

export function textoOrigen(origen: PlannerOrigen, declaradoEn?: string) {
  if (origen === "vacio") return "Sin declarar todavía";
  const fecha = declaradoEn ? new Date(declaradoEn) : null;
  return fecha && !Number.isNaN(fecha.getTime())
    ? `Declarado el ${fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
    : "Declarado";
}
