/**
 * Workspace vacío canónico del módulo (mesa sin definir). Única fuente:
 * lo consumen CalcMuestraPage (arranque/reset de mesas) y el store del
 * feature (patches sobre estudios que aún no tienen workspace).
 * No confundir con `universityDefaultWorkspace()` (study.ts), que es el
 * arranque específico de la mesa universitaria.
 */
import type { CalcMuestraWorkspace } from "../../api/client";
import { DEFAULT_UNIVERSITY_PUBLICATION_CONFIG } from "./universidad/shared/constants";

export const EMPTY_WORKSPACE: CalcMuestraWorkspace = {
  version: 2,
  frame_mode: "sin_definir",
  marco_disponible: "",
  fuente_marco: "",
  unidad_observacion: "",
  unidad_muestreo: "",
  variables_control: [],
  escenarios: [],
  notas_diseno: "",
  source_mode: "base_madre",
  source_bindings: [],
  variable_mappings: [],
  category_mappings: [],
  publication_config: DEFAULT_UNIVERSITY_PUBLICATION_CONFIG,
};
