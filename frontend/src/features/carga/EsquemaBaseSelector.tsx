import { Layers, Repeat } from "lucide-react";
import type { EstudioBase } from "../../api/client";
import { RepeatBadge } from "../../components/RepeatBadge";
import { isRepeatChildBase } from "../../lib/repeatIdentity";
import { esquemaOptionLabel, isRepeatMother, repeatGroupOfMother } from "./esquemaBaseModel";

// Selector de base para la vista de esquema del instrumento en Carga (multibase).
//
// En un estudio con grupos repeat, el `begin_repeat` vive en el instrumento de
// la base MADRE (que conserva la sección repetible); la base HIJA `kobo_repeat`
// promueve esas preguntas a top-level. Este control deja alternar madre↔hija
// para ver cada esquema, y marca con la identidad naranja `--pulso-repeat-*`
// tanto las opciones como la base seleccionada cuando corresponde. La lógica de
// selección/etiquetas vive en `esquemaBaseModel.ts` (testeada).

export function EsquemaBaseSelector({
  bases,
  value,
  onChange,
}: {
  bases: Record<string, EstudioBase>;
  value: string;
  onChange: (name: string) => void;
}) {
  const names = Object.keys(bases);
  if (names.length === 0) return null;

  const selected = bases[value];
  const selectedIsChild = isRepeatChildBase(selected);
  const selectedIsMother = isRepeatMother(bases, value);
  const motherGroup = selectedIsMother ? repeatGroupOfMother(bases, value) : null;

  return (
    <div className="pulso-carga-esquema-base" aria-label="Base del esquema del instrumento">
      <label className="pulso-carga-esquema-base-field">
        <span className="pulso-carga-esquema-base-label">
          <Layers size={13} aria-hidden="true" /> Esquema de la base
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={names.length <= 1}
        >
          {names.map((name) => (
            <option key={name} value={name}>
              {esquemaOptionLabel(bases, name)}
            </option>
          ))}
        </select>
      </label>
      {selectedIsChild && (
        <RepeatBadge
          repeatGroup={selected?.repeat_group ?? null}
          title={selected?.parent_base ? `Base hija de ${selected.parent_base}` : undefined}
        />
      )}
      {!selectedIsChild && selectedIsMother && (
        <span
          className="pulso-carga-esquema-base-mother"
          title={motherGroup ? `Contiene el grupo repetible ${motherGroup}` : "Contiene un grupo repetible"}
        >
          <Repeat size={12} aria-hidden="true" />
          {motherGroup ? `Grupo repetible ${motherGroup}` : "Con grupo repetible"}
        </span>
      )}
    </div>
  );
}
