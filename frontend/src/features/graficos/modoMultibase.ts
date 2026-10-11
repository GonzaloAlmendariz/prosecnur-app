// Qué significa tener varias bases en el plan de gráficos.
//
// El dominio ya distingue dos formas de trabajar un estudio de varias bases
// (docs/arquitectura-multi-base.md §processing_mode):
//
//   · `multibase`             → un solo plan para todo el estudio; cada gráfico
//                               declara su base con `base$variable`.
//   · `independent_siblings`  → cada base con su propio plan y sus propios
//                               entregables; se trabaja sobre la base activa.
//
// La elección es determinante y se hace en Carga, pero Gráficos no la decía en
// ninguna parte: el chrome mostraba «BASE estudiantes · 4», que se lee como
// «estás trabajando sobre estudiantes» incluso cuando el plan es uno solo para
// las cuatro. De ahí la pregunta que abrió este frente —«no está claro si debo
// hacer reportes independientes o un reporte conjunto»—: la respuesta existía,
// pero no en la superficie donde importa.

//
// Con hermanas independientes hay además un tercer alcance: el informe compartido (ADR 0040 §6.1), un borrador global
// propio que no depende de la base activa. En él el chip no puede decir «base activa»: lo que se edita no pertenece a
// ninguna base (contrato A7-1, H2). Lo pide el 4.º argumento; sin él, el chip es el de siempre.

import type { GraficosReportScope } from "./reportScope";

export type ModoMultibase = {
  visible: boolean;
  clave: "conjunto" | "por-base" | "compartido";
  etiqueta: string;
  explicacion: string;
};

export function modoMultibaseDelPlan(
  processingMode: string | null | undefined,
  nBases: number | null | undefined,
  baseActiva?: string | null,
  scope?: GraficosReportScope,
): ModoMultibase {
  const bases = Math.max(0, Number.isFinite(nBases) ? Number(nBases) : 0);
  if (bases < 2) {
    return { visible: false, clave: "conjunto", etiqueta: "", explicacion: "" };
  }
  if (processingMode === "independent_siblings" && scope === "consolidated") {
    return {
      visible: true,
      clave: "compartido",
      etiqueta: `Informe compartido · ${bases} bases`,
      explicacion:
        `Este informe reúne las ${bases} bases en un solo PPTX con su propio plan. ` +
        "Lo que edites aquí no cambia el informe de ninguna base.",
    };
  }
  if (processingMode === "independent_siblings") {
    const activa = (baseActiva ?? "").trim();
    return {
      visible: true,
      clave: "por-base",
      etiqueta: activa ? `Un informe por base · ${activa}` : "Un informe por base",
      explicacion:
        `Cada una de las ${bases} bases tiene su propio plan y su propio informe. ` +
        "Lo que edites aquí pertenece a la base activa; el resto no cambia.",
    };
  }
  return {
    visible: true,
    clave: "conjunto",
    etiqueta: `Un informe conjunto · ${bases} bases`,
    explicacion:
      `Este plan es uno solo para las ${bases} bases: cada gráfico declara de cuál ` +
      "sale su variable, así que puedes mezclarlas en el mismo informe.",
  };
}
