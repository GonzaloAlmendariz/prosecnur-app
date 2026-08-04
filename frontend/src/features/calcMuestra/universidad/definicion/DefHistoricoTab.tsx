/**
 * Pestaña «Histórico» (sección Datos): la base de un estudio ya aplicado que se
 * usa como referencia de asistencia.
 *
 * G42 · Gonzalo: «falta la pestaña para agregar la base de monitoreo del año
 * pasado para tenerlo como histórico».
 *
 * El motor ya sabía leerla —calcula tasas por celda, sus intervalos y las anclas
 * que el mínimo de elegibles usa— pero la carga vivía como una tarjeta más al
 * final de Fuentes, entre las bases que SÍ construyen el marco. Ahí no se
 * encuentra y, peor, se lee como si fuera otra fuente del marco: no lo es. No
 * entra al marco vigente ni cambia el número de cursos-horario a seleccionar;
 * sólo transfiere tasas agregadas de un estudio anterior.
 *
 * Por eso tiene pestaña propia y no una sección dentro de Fuentes: es una
 * decisión distinta, opcional, y con su propia lectura (cobertura, tramos y
 * celdas que publican global por k insuficiente).
 */
import type {
  CalcMuestraAulasState,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../api/client";
import {
  ensureUniversitySourceBindings,
  sourceBindingPatchForSheet,
} from "../shared/categorias";
import { AvisoModulo } from "../shared/AvisoModulo";
import { BaseUploadCard } from "./DefBasesTab";
import { ReferenciaAsistenciaCard } from "./ReferenciaAsistenciaCard";

export function DefHistoricoTab({
  workspace,
  aulasState,
  referencia,
  onWorkspace,
  onSourceUpload,
  onReferenceSheetChange,
  uploadingSourceId,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  referencia: CalcMuestraReferenciaAsistencia | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onSourceUpload: (
    binding: CalcMuestraWorkspaceSourceBinding,
    file: File,
  ) => void | Promise<void>;
  onReferenceSheetChange: (
    binding: CalcMuestraWorkspaceSourceBinding,
    workspace: CalcMuestraWorkspace,
  ) => void | Promise<void>;
  uploadingSourceId: string | null;
}) {
  const sourceMode = workspace.source_mode ?? "base_madre";
  const allBindings = ensureUniversitySourceBindings(sourceMode, workspace.source_bindings);
  const binding = allBindings.find(
    (item: CalcMuestraWorkspaceSourceBinding) => item.role === "referencia_asistencia",
  ) ?? null;
  const marcoConstruido = Boolean(aulasState?.frame);

  function updateSheet(id: string, sheetName: string) {
    const target = allBindings.find((item: CalcMuestraWorkspaceSourceBinding) => item.id === id);
    if (!target) return;
    const patch = (target.available_sheets ?? []).length > 0
      ? sourceBindingPatchForSheet(target, sheetName)
      : { sheet_name: sheetName };
    const nextBinding = { ...target, ...patch };
    const nextWorkspace: CalcMuestraWorkspace = {
      ...workspace,
      source_bindings: allBindings.map((item: CalcMuestraWorkspaceSourceBinding) =>
        (item.id === id ? nextBinding : item)),
    };
    // Cambiar la hoja de esta base cambia lo que se leyó: el motor la recalcula
    // en cuanto hay archivo. Sin eso la tarjeta enseñaría tasas de la hoja vieja.
    if (nextBinding.file_id) {
      void onReferenceSheetChange(nextBinding, nextWorkspace);
      return;
    }
    onWorkspace(nextWorkspace);
  }

  return (
    <section
      className="cmv2-definition-stack"
      data-audit-ready={referencia ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/definicion-historico"
      data-qa-geometry-contract="intrinsic"
      aria-label="Base histórica de referencia"
    >
      {binding ? (
        <BaseUploadCard
          binding={binding}
          index={0}
          isUploading={uploadingSourceId === binding.id}
          gated={false}
          filasMotor={0}
          onUpload={(next: CalcMuestraWorkspaceSourceBinding, file: File) =>
            void onSourceUpload(next, file)}
          onSheet={updateSheet}
        />
      ) : null}
      <ReferenciaAsistenciaCard referencia={referencia} />
      {!referencia && !marcoConstruido ? (
        <AvisoModulo tone="info" role="status" compact>
          Puedes declararla ahora o más tarde: el marco se construye sin ella, y al cargarla
          se calibra sobre el marco vigente.
        </AvisoModulo>
      ) : null}
    </section>
  );
}
