/**
 * Editor de los grupos de tamaño del curso-horario (rangos por nº de elegibles).
 * Persiste sobre el campo canónico `aulas_config.grupos_tamano` — el mismo que
 * lee el histograma de tamaños y consume el motor R — por lo que el gráfico de
 * bandas se reconstruye sobre la definición del usuario. Componente presentacional
 * puro: la lógica de rangos vive en cursosHorarioModel.ts.
 *
 * Controles del kit (L27): el booleano `enabled` es un PulsoSwitch (K1), los
 * rangos son PulsoInput numéricos dentro de PulsoField en línea y la «×» de
 * quitar es un botón de ícono con `intent="remove"` (K2).
 */
import { Plus, X } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoField, PulsoFieldRow } from "../../../../components/PulsoField";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
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
      <PulsoSwitch
        checked={enabled}
        onCheckedChange={onEnabledChange}
        label="Definir grupos de tamaño"
        description="Rangos por nº de elegibles del curso-horario; el histograma de bandas se dibuja sobre esta definición."
      />
      {enabled && (
        <>
          <div
            className="cmv2-ch-grupos-list"
            role="group"
            aria-label="Grupos de tamaño de curso-horario"
            data-qa-geometry-group="calc-muestra/marco-grupos-tamano"
            data-qa-geometry-contract="equal"
          >
            {groups.map((group) => {
              const openTop = sizeGroupMaxValue(group.max) === Number.POSITIVE_INFINITY;
              return (
                <div key={group.id} className="cmv2-ch-grupos-row" data-grupo={group.id}>
                  <span className="cmv2-ch-grupos-tag" aria-hidden="true">
                    <i data-grupo={group.id} />
                    {group.label}
                  </span>
                  {/* C1: «Desde» y «Hasta» son un rango, no dos campos sueltos. */}
                  <PulsoFieldRow
                    className="cmv2-ch-grupos-rango"
                    role="group"
                    ariaLabel={`Rango de elegibles del grupo ${group.label}`}
                    geometryGroup="calc-muestra/marco-grupos-rango"
                  >
                  <PulsoField label="Desde" inline>
                    <PulsoInput
                      size="sm"
                      numeric
                      type="number"
                      min={0}
                      step={1}
                      value={group.min}
                      onChange={(e) => onGroupsChange(updateSizeGroup(groups, group.id, { min: Number(e.currentTarget.value) }))}
                      aria-label={`Mínimo de elegibles del grupo ${group.label}`}
                    />
                  </PulsoField>
                  <PulsoField label="Hasta" inline>
                    <PulsoInput
                      size="sm"
                      numeric
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
                  </PulsoField>
                  </PulsoFieldRow>
                  <PulsoButton
                    variant="icon"
                    size="sm"
                    intent="remove"
                    className="cmv2-ch-grupos-quitar"
                    onClick={() => onGroupsChange(removeSizeGroup(groups, group.id))}
                    disabled={groups.length <= 1}
                    aria-label={`Quitar grupo ${group.label}`}
                    title={groups.length <= 1 ? "Debe quedar al menos un grupo" : `Quitar ${group.label}`}
                  >
                    <X size={13} aria-hidden="true" />
                  </PulsoButton>
                </div>
              );
            })}
          </div>
          {groups.length < MAX_GROUPS && (
            <PulsoButton
              variant="ghost"
              size="sm"
              className="cmv2-ch-grupos-agregar"
              onClick={() => onGroupsChange(appendSizeGroup(groups))}
            >
              <Plus size={13} aria-hidden="true" />
              Agregar grupo
            </PulsoButton>
          )}
        </>
      )}
    </div>
  );
}
