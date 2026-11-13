import { BarChart3, Database, FileSpreadsheet, Grid3X3, Target, Users } from "lucide-react";

/**
 * Secciones de Acreditación en el orden del trabajo: se nombran los públicos, se carga el marco de cada uno (base y
 * reglas), se fija la meta con su margen, y recién después vienen el listado de envío y los entregables. Decisión de
 * Gonzalo (2026-11-12): "el marco se supone que es subiendo la base y definiendo alguna regla de filtro, y luego
 * debería haber un establecedor de meta sabiendo el margen de error".
 */
export const SECCIONES_ACREDITACION = ["actores", "marco", "meta", "contexto", "seleccion", "resultados"] as const;
export type SeccionAcreditacion = (typeof SECCIONES_ACREDITACION)[number];

export function railAcreditacion() {
  return [
    { id: "actores", label: "Actores", detail: "nombre y canal", icon: Users, targetId: "cmv2-section-acreditacion-actores" },
    { id: "marco", label: "Marco", detail: "base y quién se invita", icon: FileSpreadsheet, targetId: "cmv2-section-acreditacion-marco" },
    { id: "meta", label: "Meta", detail: "encuestas y margen", icon: Target, targetId: "cmv2-section-acreditacion-meta" },
    { id: "contexto", label: "Contexto", detail: "programa y fuente", icon: Database, targetId: "cmv2-section-acreditacion-contexto" },
    { id: "seleccion", label: "Selección", detail: "listado por actor", icon: Grid3X3, targetId: "cmv2-section-acreditacion-seleccion" },
    { id: "resultados", label: "Resultados", detail: "propuesta y archivos", icon: BarChart3, targetId: "cmv2-section-acreditacion-resultados" },
  ];
}
