// Con una base, "Archivos" de "Agregar base" son las dos tarjetas de subida de
// la carga simple, tal como estaban en Fuentes: el formulario primero y después
// las respuestas, con su resumen, el mapeo de códigos y la exportación.

import type { ChoiceCodeMapReview, NormalizedExportFormat } from "../../../../api/client";
import type { CambiosDeRespuestas } from "../../../../api/estudio";
import { apiCargaExportNormalized } from "../../../../api/xlsformEditor";
import { Database, FileSpreadsheet } from "../../../../vendor/lucide-react";
import { RespuestasResumen, type DataPreview } from "../../RespuestasResumen";
import { choiceMappingReviewFromPreview, type InstrumentoResumen } from "../cargaPaginaModelo";
import { ResumenStat } from "../ResumenStat";
import { UploadCard } from "../TarjetaSubida";
import { FormularioDelEditor } from "./FormularioDelEditor";
import type { FormularioDelEditor as FormularioEditable } from "./formularioDelEditorModelo";
import { useFormulariosDelEditor } from "./useFormulariosDelEditor";

export type SubidaDeUnaBaseProps = {
  ocupado: boolean;
  tieneFormulario: boolean;
  tieneRespuestas: boolean;
  mapeoPendiente: boolean;
  formulario: InstrumentoResumen | null;
  vistaPrevia: DataPreview | null;
  cambios: CambiosDeRespuestas | null;
  detallesNormalizacion: string[];
  onCerrarCambios: () => void;
  onRevisarMapeo: (mapeo: ChoiceCodeMapReview | null) => void;
  onSubir: (tipo: "xlsform" | "data", archivo?: File) => void | Promise<void>;
  onQuitar: (tipo: "xlsform" | "data") => void | Promise<void>;
  /** Usa el formulario hecho en el editor del proyecto; sin él, la opción no aparece. */
  onUsarDelEditor?: (formulario: FormularioEditable) => void | Promise<void>;
};

export function SubidaDeUnaBase({
  ocupado,
  tieneFormulario,
  tieneRespuestas,
  mapeoPendiente,
  formulario,
  vistaPrevia,
  cambios,
  detallesNormalizacion,
  onCerrarCambios,
  onRevisarMapeo,
  onSubir,
  onQuitar,
  onUsarDelEditor,
}: SubidaDeUnaBaseProps) {
  const delEditor = useFormulariosDelEditor();
  return (
    <div className="pulso-upload-grid">
      <UploadCard
        kind="xlsform"
        icon={FileSpreadsheet}
        title="1. Formulario del estudio"
        hint="El archivo que define preguntas, opciones, secciones y reglas del estudio."
        whatIs={
          <>
            Es un archivo <strong>Excel (.xlsx)</strong> de formulario:
            una hoja <code>survey</code> con las preguntas y una <code>choices</code>{" "}
            con las opciones. Sin este archivo, la app no sabe qué variables significan qué.
          </>
        }
        accept=".xlsx,.xls"
        acceptLabel="Solo Excel (.xlsx)"
        done={tieneFormulario}
        busy={ocupado}
        disabled={ocupado}
        resumen={formulario && (
          <>
            <ResumenStat label="Preguntas" value={formulario.n_preguntas} />
            {(formulario.n_calculos ?? 0) > 0 && (
              <ResumenStat label="Cálculos" value={formulario.n_calculos ?? 0} />
            )}
            <ResumenStat label="Secciones" value={formulario.n_secciones} />
            <ResumenStat label="Listas de opciones" value={formulario.n_listas_opciones} />
          </>
        )}
        alternativa={onUsarDelEditor ? (
          <FormularioDelEditor formularios={delEditor} ocupado={ocupado} onUsar={(f) => void onUsarDelEditor(f)} />
        ) : null}
        onPick={(file) => onSubir("xlsform", file)}
        onRemove={() => onQuitar("xlsform")}
      />

      <UploadCard
        kind="data"
        icon={Database}
        title="2. Respuestas"
        hint={tieneFormulario
          ? "El archivo con las respuestas. Se revisará contra el formulario ya cargado."
          : "Primero carga el formulario para activar las respuestas y evitar una preparación incompleta."}
        whatIs={
          <>
            Es el resultado de tu trabajo de campo. Acepta <strong>Excel (.xlsx)</strong>,{" "}
            <strong>CSV</strong>, <strong>SPSS (.sav)</strong> o un <strong>ZIP</strong> con
            un único <code>.sav</code>. Las columnas deben corresponder a las variables del formulario.
          </>
        }
        accept=".xlsx,.xls,.csv,.sav,.zip,application/x-spss-sav,application/octet-stream,application/zip,application/x-zip-compressed"
        acceptLabel=".xlsx, .csv, .sav o .zip"
        done={tieneRespuestas}
        busy={ocupado}
        disabled={ocupado || !tieneFormulario}
        disabledHint="Disponible después de cargar el formulario"
        resumen={vistaPrevia && (
          <RespuestasResumen
            preview={vistaPrevia}
            cambios={cambios}
            onCerrarCambios={onCerrarCambios}
            mapeo={choiceMappingReviewFromPreview(vistaPrevia)
              ? {
                  pendiente: !!vistaPrevia.normalizacion?.choice_code_maps?.requires_confirmation,
                  onRevisar: () => onRevisarMapeo(choiceMappingReviewFromPreview(vistaPrevia)),
                }
              : null}
            detallesNormalizacion={detallesNormalizacion}
            exportar={vistaPrevia.normalizacion?.applied && !mapeoPendiente
              ? { disabled: ocupado, generar: (format: NormalizedExportFormat) => apiCargaExportNormalized(format) }
              : null}
          />
        )}
        onPick={(file) => onSubir("data", file)}
        onRemove={() => onQuitar("data")}
      />
    </div>
  );
}
