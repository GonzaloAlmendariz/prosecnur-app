// GENERADO desde api/inst/estandar/estandar_pulso.json (`cuestionario`): la tipografía y los colores con que el
// motor imprime el cuestionario (L36 · DOC.1). No editar a mano: estandarCuestionario.contract.test.ts falla si se
// desvía del JSON y muestra el valor esperado.

export type EstandarCuestionario = {
  tipografia: { unidad: string; fuente: string; cuerpo: number; minimo: number; titulo: number };
  colores: { tinta: string; rejilla: string; banda: string; banda_sub: string; cebra: string };
};

export const ESTANDAR_CUESTIONARIO: EstandarCuestionario = {
  tipografia: { unidad: "pt", fuente: "Arial Narrow", cuerpo: 10, minimo: 8, titulo: 20 },
  colores: { tinta: "#000000", rejilla: "#000000", banda: "#D9D9D9", banda_sub: "#E8E8E8", cebra: "#F2F2F2" },
};
