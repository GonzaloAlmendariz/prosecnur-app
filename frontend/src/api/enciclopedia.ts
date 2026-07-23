// enciclopedia.ts — enciclopedia metodológica.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import type { CalcMuestraNaturaleza, CalcMuestraOrigenTamano, CalcMuestraTecnica } from "./calcMuestra";
import { apiFetch, handle, headers } from "./core";

// ============================================================================
// Enciclopedia Metodológica
// ============================================================================

export type EnciclopediaFichaFormula = {
  expresion: string;
  descripcion: string;
  notas: string[];
};

export type EnciclopediaFichaParametro = {
  nombre: string;
  rango_recomendado: string;
  justificacion: string;
};

export type EnciclopediaFichaEscenario = {
  contexto: string;
  porque_aplica: string;
};

export type EnciclopediaFichaDecision = {
  titulo: string;
  detalle: string;
};

export type EnciclopediaFichaTradeOff = {
  ventaja: string;
  limitacion: string;
};

export type EnciclopediaFicha = {
  id: CalcMuestraTecnica;
  nombre_tecnico: string;
  abreviatura?: string;
  naturaleza: CalcMuestraNaturaleza;
  permite_margen_error: boolean;
  implementada_en_calculador: boolean;
  definicion: string;
  supuestos_formales: string[];
  formulas: EnciclopediaFichaFormula[];
  parametros_tipicos: EnciclopediaFichaParametro[];
  origen_tamano_aplicable: CalcMuestraOrigenTamano[];
  escenarios_de_uso: EnciclopediaFichaEscenario[];
  cuando_no_usar: string[];
  decisiones_tecnicas: EnciclopediaFichaDecision[];
  trade_offs: EnciclopediaFichaTradeOff[];
  salida_principal: string;
  referencias_bibliograficas: string[];
  aplicaciones_internas: string[];
};

export type EnciclopediaCatalogo = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  metodologias: EnciclopediaFicha[];
};

export type EnciclopediaTermino = {
  id: string;
  termino: string;
  nombre_completo: string;
  definicion: string;
  formula: string | null;
  metodologias_relacionadas: CalcMuestraTecnica[];
  campos_calculador_relacionados: string[];
};

export type EnciclopediaGlosario = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  terminos: EnciclopediaTermino[];
};

export type EnciclopediaFamiliaEstudio =
  | "acreditacion_programa"
  | "opinion_universitaria"
  | "territorial_hogares"
  | "servicios_establecimientos"
  | "listado_telefonico_programa"
  | "institucional_no_probabilistico";

export type EnciclopediaRequiereCalculoMuestra = "si" | "no" | "parcial";

export type EnciclopediaOrigenMuestra =
  | "por_calcular"
  | "muestra_historica_replicada"
  | "mixto_por_componente"
  | "meta_contractual"
  | "marco_total_barrido"
  | "cobertura_por_actor";

export type EnciclopediaAccionEvaluadorMuestra =
  | "calcular_muestra"
  | "calcular_marco_cobertura"
  | "calcular_cuotas"
  | "fuera_calculador"
  | "evaluar_por_componente";

export type EnciclopediaNivelEvidencia = "alto" | "medio" | "limitado";

export type EnciclopediaEstudio = {
  codigo: string;
  anio: number;
  familia_estudio: EnciclopediaFamiliaEstudio;
  metodologia_principal: CalcMuestraTecnica;
  metodologias_secundarias: CalcMuestraTecnica[];
  dominio: string;
  es_recurrente: boolean;
  requiere_calculo_muestra: EnciclopediaRequiereCalculoMuestra;
  origen_muestra: EnciclopediaOrigenMuestra;
  accion_evaluador_muestra: EnciclopediaAccionEvaluadorMuestra;
  elementos_comunes: string[];
  nivel_evidencia: EnciclopediaNivelEvidencia;
};

export type EnciclopediaTablaEstudios = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  nota_confidencialidad: string;
  rutas_evaluador_muestra?: Record<EnciclopediaAccionEvaluadorMuestra, string>;
  naturalezas_dominantes: Record<CalcMuestraNaturaleza, string>;
  estudios: EnciclopediaEstudio[];
};

export type EnciclopediaCatalogItem = {
  id: string;
  nombre: string;
  descripcion: string;
};

export type EnciclopediaTipoEstudio = EnciclopediaCatalogItem & {
  criterios: string[];
  acciones_evaluador_permitidas: EnciclopediaAccionEvaluadorMuestra[];
  elementos_comunes: string[];
  ejemplos: string[];
};

export type EnciclopediaTiposEstudioCatalogo = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  criterio_general: string;
  acciones_evaluador_muestra: Array<EnciclopediaCatalogItem & { salida_principal: string }>;
  origenes_muestra: EnciclopediaCatalogItem[];
  familias_estudio: EnciclopediaTipoEstudio[];
};

export type EnciclopediaComparador = {
  version: number;
  seleccionadas: EnciclopediaFicha[];
  ejes_comparacion: string[];
};

export async function apiEnciclopediaCatalogo() {
  return handle<EnciclopediaCatalogo>(
    await apiFetch("/api/enciclopedia/catalogo", { headers: headers() }),
  );
}

export async function apiEnciclopediaGlosario() {
  return handle<EnciclopediaGlosario>(
    await apiFetch("/api/enciclopedia/glosario", { headers: headers() }),
  );
}

export async function apiEnciclopediaEstudios() {
  return handle<EnciclopediaTablaEstudios>(
    await apiFetch("/api/enciclopedia/estudios", { headers: headers() }),
  );
}

export async function apiEnciclopediaTiposEstudio() {
  return handle<EnciclopediaTiposEstudioCatalogo>(
    await apiFetch("/api/enciclopedia/tipos-estudio", { headers: headers() }),
  );
}

export async function apiEnciclopediaComparador(ids: string[]) {
  const qs = new URLSearchParams({ ids: ids.join(",") }).toString();
  return handle<EnciclopediaComparador>(
    await apiFetch(`/api/enciclopedia/comparador?${qs}`, { headers: headers() }),
  );
}
