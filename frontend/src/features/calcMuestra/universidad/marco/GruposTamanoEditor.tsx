/**
 * Editor de los grupos de tamaño del curso-horario (rangos por nº de elegibles).
 * Persiste sobre el campo canónico `aulas_config.grupos_tamano` — el mismo que
 * lee el histograma de tamaños y consume el motor R — por lo que el gráfico de
 * bandas se reconstruye sobre la definición del usuario. Componente presentacional
 * puro: la lógica de rangos vive en cursosHorarioModel.ts.
 */
import { Plus, X } from "lucide-react";
import type { CalcMuestraWorkspaceAulasSizeGroup } from "../../../../api/client";
import {
  appendSizeGroup,
  removeSizeGroup,
  sizeGroupMaxValue,
  updateSizeGroup,
} from "./cursosHorarioModel";

const MAX_GROUPS = 6;

export function GruposTamanoEditor({
  groups,
  enabled,
  onGroupsChange,
  onEnabledChange,
}: {
  groups: CalcMuestraWorkspaceAulasSizeGroup[];
  enabled: boolean;
  onGroupsChange: (groups: CalcMuestraWorkspaceAulasSizeGroup[]) => void;
  onEnabledChange: (value: boolean) => void;
}) {
  return (
    <div className="cmv2-ch-grupos">
      <label className="cmv2-ch-grupos-toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.currentTarget.checked)} />
        <span>
          <strong>Definir grupos de tamaño</strong>
          <em>Rangos por nº de elegibles del curso-horario; el histograma de bandas se dibuja sobre esta definición.</em>
        </span>
      </label>
      {enabled && (
        <>
          <div className="cmv2-ch-grupos-list" role="group" aria-label="Grupos de tamaño de curso-horario">
            {groups.map((group) => {
              const openTop = sizeGroupMaxValue(group.max) === Number.POSITIVE_INFINITY;
              return (
                <div key={group.id} className="cmv2-ch-grupos-row" data-grupo={group.id}>
                  <span className="cmv2-ch-grupos-tag" aria-hidden="true">
                    <i data-grupo={group.id} />
                    {group.label}
                  </span>
                  <label className="cmv2-ch-grupos-field">
                    <span>Desde</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={group.min}
                      onChange={(e) => onGroupsChange(updateSizeGroup(groups, group.id, { min: Number(e.currentTarget.value) }))}
                      aria-label={`Mínimo de elegibles del grupo ${group.label}`}
                    />
                  </label>
                  <label className="cmv2-ch-grupos-field">
                    <span>Hasta</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={openTop ? "" : group.max ?? ""}
                      placeholder="sin tope"
                      onChange={(e) => {
                        const raw = e.currentTarget.value.trim();
                        onGroupsChange(updateSizeGroup(groups, group.id, { max: raw === "" ? null : Number(raw) }));
                      }}
                      aria-label={`Máximo de elegibles del grupo ${group.label}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="cmv2-ch-grupos-remove"
                    onClick={() => onGroupsChange(removeSizeGroup(groups, group.id))}
                    disabled={groups.length <= 1}
                    aria-label={`Quitar grupo ${group.label}`}
                    title={groups.length <= 1 ? "Debe quedar al menos un grupo" : `Quitar ${group.label}`}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          {groups.length < MAX_GROUPS && (
            <button type="button" className="cmv2-ch-grupos-add" onClick={() => onGroupsChange(appendSizeGroup(groups))}>
              <Plus size={13} aria-hidden="true" />
              Agregar grupo
            </button>
          )}
        </>
      )}
    </div>
  );
}
