// Vocabulario visible del Planner: un solo lugar para los nombres de perfil y
// para el modo que cada perfil fija en los demás módulos (ADR 0122 §4).

import type { PlannerDiseno, PlannerOrigen, PlannerPerfil, PlannerTipoPerfil } from "../../../api/planner";

export const ETIQUETA_PERFIL: Record<PlannerTipoPerfil, string> = {
  territorial: "Territorial presencial",
  aulas: "Aulas universitarias",
  telefonico: "Telefónico",
  acreditacion: "Acreditación",
};

export const DETALLE_PERFIL: Record<PlannerTipoPerfil, string> = {
  territorial: "Encuestas en el territorio: por manzanas sorteadas o por cuotas.",
  aulas: "Cursos-horario o personas de una universidad, encuestadas en aula.",
  telefonico: "Una lista de personas que se llaman por teléfono.",
  acreditacion: "Públicos de una carrera o institución, invitados por correo.",
};

export const ETIQUETA_DISENO: Record<PlannerDiseno, string> = {
  "calc-muestra": "Cálculo de muestra",
  "hojas-ruta": "Hojas de ruta",
  cliente: "La entrega el cliente",
  cuotas: "Cuotas del Planner, sin sorteo",
};

export type ModoPorModulo = { calc: string; hojas: string; material: string; monitoreo: string };

export function modosDelPerfil(perfil: PlannerPerfil): ModoPorModulo {
  const conveniencia = perfil.tipo === "territorial" && perfil.seleccion === "conveniencia";
  const calc = perfil.diseno === "cliente"
    ? "No aplica: la muestra la entrega el cliente"
    : conveniencia ? "No aplica: cuotas sin sorteo"
    : {
        territorial: "Lo diseña Hojas de ruta",
        aulas: perfil.seleccion === "marco" ? "Marco disponible" : "Opinión universitaria",
        telefonico: "Marco disponible",
        acreditacion: "Acreditación",
      }[perfil.tipo];
  return {
    calc,
    hojas: perfil.tipo === "territorial" && !conveniencia ? "Mapa, marco y sorteo de manzanas" : "No aplica",
    material: { territorial: "Campaña territorial", aulas: "Campaña de aulas", telefonico: "Campaña telefónica", acreditacion: "Campaña de correo" }[perfil.tipo],
    monitoreo: { territorial: "Territorial", aulas: "Cursos-horario", telefonico: "Telefónico", acreditacion: "Acreditación" }[perfil.tipo],
  };
}

export function textoOrigen(origen: PlannerOrigen, declaradoEn?: string) {
  if (origen === "proyectado") return "Leído de lo que ya tiene el proyecto";
  const fecha = declaradoEn ? new Date(declaradoEn) : null;
  return fecha && !Number.isNaN(fecha.getTime())
    ? `Declarado el ${fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
    : "Declarado";
}
