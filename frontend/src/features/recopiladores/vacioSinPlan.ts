/**
 * Qué dice cada sección de Material de campo cuando el proyecto no tiene plan.
 *
 * Antes cada sección pintaba su caja punteada con una frase («Crea o adapta un
 * plan antes de configurar accesos.») y ninguna llevaba a ningún lado. El vacío
 * de la casa dice qué falta, por qué, y ofrece UNA acción que lleva a la
 * dirección que lo resuelve:
 *
 * - Unidades: el plan llega de la selección de otro módulo, así que la acción
 *   lleva a ese origen (Cálculo de muestra si el estudio es de aulas, Hojas de
 *   ruta si el proyecto trabaja con ellas).
 * - Accesos, Paquetes y Entrega dependen de las unidades: llevan a Unidades.
 *
 * Es un modelo puro para poder probar los textos y los destinos sin montar
 * React.
 */

import type { RecopiladoresSeccion } from "./navegacion";

export type DestinoDelVacio = { label: string; to: string };

export type VacioSinPlan = {
  titulo: string;
  descripcion: string;
  accion: DestinoDelVacio;
};

export type OrigenDelPlanEntrada = {
  /** `facts.calc.mode` del overview del proyecto: "aulas" | "territorial" | "general". */
  modoDelCalculo?: string | null;
  /** Módulos agregados al proyecto. */
  modulos?: readonly string[];
};

const A_UNIDADES: DestinoDelVacio = {
  label: "Ir a Unidades",
  to: "/material-campo?modo=aulas&seccion=unidades",
};

/** El módulo de donde sale la lista de unidades del plan. */
export function origenDelPlan({ modoDelCalculo, modulos = [] }: OrigenDelPlanEntrada): DestinoDelVacio {
  if (modoDelCalculo === "aulas") {
    return {
      label: "Ir a Cálculo de muestra",
      to: "/calc-muestra?modo=opinion-universitaria&seccion=salidas",
    };
  }
  if (modulos.includes("hojas-ruta") && !modulos.includes("calc-muestra")) {
    return { label: "Ir a Hojas de ruta", to: "/hojas-ruta?seccion=seleccion" };
  }
  return { label: "Ir a Cálculo de muestra", to: "/calc-muestra" };
}

export type SeccionConVacio = Exclude<RecopiladoresSeccion, "catalogo">;

export function vacioSinPlan(
  seccion: SeccionConVacio,
  origen: DestinoDelVacio = origenDelPlan({}),
): VacioSinPlan {
  switch (seccion) {
    case "unidades":
      return {
        titulo: "Sin unidades en el plan",
        descripcion: "Llegan de la selección de la muestra.",
        accion: origen,
      };
    case "accesos":
      return {
        titulo: "Sin unidades para dar acceso",
        descripcion: "Cada unidad del plan recibe su enlace.",
        accion: A_UNIDADES,
      };
    case "paquetes":
      return {
        titulo: "Sin unidades para empaquetar",
        descripcion: "Un paquete reúne las fichas del plan.",
        accion: A_UNIDADES,
      };
    case "entrega":
      return {
        titulo: "Nada que entregar todavía",
        descripcion: "Cierra un plan con sus accesos listos.",
        accion: A_UNIDADES,
      };
  }
}
