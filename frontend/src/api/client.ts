// client.ts — barrel de compatibilidad del cliente API tipado.
// El contrato con el backend R vive en los módulos por dominio de esta
// carpeta (split 2026-07); este archivo re-exporta todo para que los
// consumidores existentes (`import { apiX } from "../api/client"`) no
// cambien. Código nuevo: agregar la función en el módulo de su dominio.

export * from "./core";
export * from "./estudio";
export * from "./surveymonkey";
export * from "./multiIntegrado";
export * from "./xlsformEditor";
export * from "./jobs";
export * from "./monitoreo";
export * from "./hojasRuta";
export * from "./codificacion";
export * from "./analitica";
export * from "./graficos";
export * from "./dashboard";
export * from "./validacion";
export * from "./workspace";
export * from "./calcMuestra";
export * from "./planTrabajo";
export * from "./disenoEstudio";
export * from "./overview";
export * from "./enciclopedia";
