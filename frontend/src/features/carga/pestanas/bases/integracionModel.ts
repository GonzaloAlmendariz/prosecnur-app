// Cómo se integró una base (Carga › Bases, R2): lo que mostraba
// `IntegratedHistoryPanel` de `BasesPanel`, leído con los mismos helpers de
// `surveymonkey/smBasesModel`. El inspector muestra el resumen a la vista; la
// bitácora completa va en su panel (`panel=bitacora-integracion&foco=<base>`).

import type { EstudioBase, EstudioMultiIntegratedOrigin } from "../../../../api/estudio";
import {
  fileLabel,
  importedAtLabel,
  integratedHistoryArray,
  integratedLabelOverrideGroups,
  integratedStandardLabelEntries,
  integratedVariantGroups,
  type LabelOverrideEntry,
  type LabelOverrideGroup,
  type VariantGroup,
} from "../../surveymonkey/smBasesModel";

export type ArchivoCanonico = { rotulo: string; archivo: string };

export type OrigenIntegrado = {
  clave: string;
  /** Valor de la columna que distingue el origen. */
  llave: string;
  etiqueta: string;
  /** De dónde vino: "SurveyMonkey 501" o "formulario.xlsx + respuestas.xlsx". */
  fuente: string;
};

export type ResumenDeIntegracion = {
  llave: string;
  /** Fecha de la integración; `null` si el motor no la registró. */
  fecha: string | null;
  archivos: ArchivoCanonico[];
  origenes: OrigenIntegrado[];
  /** Fraseos que quedaron como texto final común. */
  fraseoComun: LabelOverrideEntry[];
  /** Fraseos que se conservan propios de cada origen. */
  fraseosPorOrigen: LabelOverrideGroup[];
  /** Variables que cambiaban por origen y se preservaron como variantes. */
  variantes: VariantGroup[];
  nVariantes: number;
};

/** `null` si la base no viene de una integración. */
export function resumenDeIntegracion(base: EstudioBase): ResumenDeIntegracion | null {
  const meta = base.multi_integrated;
  if (!meta) return null;
  const origenes = integratedHistoryArray<EstudioMultiIntegratedOrigin>(meta.origins).map((o, i) => ({
    clave: `${o.key_value ?? i}-${o.survey_id ?? i}`,
    llave: o.key_value || `origen_${i + 1}`,
    etiqueta: o.label || o.survey_id || "Sin etiqueta",
    fuente: o.source_kind === "surveymonkey"
      ? `SurveyMonkey ${o.survey_id || ""}`.trim()
      : `${fileLabel(o.xlsform_file_id, o.xlsform_file_name)} + ${fileLabel(o.data_file_id, o.data_file_name)}`,
  }));
  const variantes = integratedVariantGroups(meta);
  return {
    llave: meta.origin_key_name || "origen",
    fecha: String(meta.imported_at ?? "").trim() && meta.imported_at !== "NA" ? importedAtLabel(meta.imported_at) : null,
    archivos: [
      { rotulo: "Formulario guía", archivo: fileLabel(meta.guide_xlsform_file_id, meta.guide?.filename) },
      { rotulo: "Formulario integrado", archivo: fileLabel(base.xlsform_file_id, base.xlsform_file_name) },
      { rotulo: "Respuestas integradas", archivo: fileLabel(base.data_file_id, base.data_file_name) },
    ],
    origenes,
    fraseoComun: integratedStandardLabelEntries(meta),
    fraseosPorOrigen: integratedLabelOverrideGroups(meta),
    variantes,
    nVariantes: variantes.reduce((suma, g) => suma + g.rows.length, 0),
  };
}
