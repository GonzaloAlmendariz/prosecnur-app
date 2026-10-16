// Celdas del Editor XLSForm: texto/expresión, name con borrador (renombra en blur) y type con selector.
// Extraído de sheets/SheetsView.tsx — refactor puro, revamp 2026-10-16.

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { iconForType } from "../helpers/icons";

// -----------------------------------------------------------------------------
// SheetCell — input controlado, autosize altura para textos largos.
// -----------------------------------------------------------------------------

export type SheetCellProps = {
  value: string;
  onChange: (next: string) => void;
  isExpression: boolean;
};

export function SheetCell({ value, onChange, isExpression }: SheetCellProps) {
  // Autosize: usamos textarea si el valor tiene saltos de línea o es muy
  // largo (>40 chars). Sino, input simple.
  const isMultiline = value.includes("\n") || value.length > 40;
  if (isMultiline) {
    return (
      <textarea
        className={`pulso-xfs-cell ${
          isExpression ? "is-expression" : ""
        } is-multiline`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(6, Math.max(2, value.split("\n").length))}
        spellCheck={!isExpression}
      />
    );
  }
  return (
    <input
      type="text"
      className={`pulso-xfs-cell ${isExpression ? "is-expression" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={!isExpression}
    />
  );
}

// -----------------------------------------------------------------------------
// DraftNameCell — celda de `name` (survey) con borrador local.
// -----------------------------------------------------------------------------
// A diferencia de SheetCell, NO aplica por tecla: el commit ocurre en blur o
// Enter (Esc revierte). Aplicar un rename propaga referencias ${old}→${new}
// en todo el survey, así que hacerlo por tecleo generaba renames intermedios
// y un toast por carácter.
// -----------------------------------------------------------------------------

export type DraftNameCellProps = {
  value: string;
  onCommit: (next: string) => void;
};

export function DraftNameCell({ value, onCommit }: DraftNameCellProps) {
  const [draft, setDraft] = useState(value);

  // Realinea el borrador si el valor cambia desde fuera (undo, otra vista).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const dirty = draft !== value;

  function commit() {
    if (dirty) onCommit(draft);
  }

  return (
    <input
      type="text"
      className={`pulso-xfs-cell is-expression${dirty ? " is-pending" : ""}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape" && dirty) {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value);
        }
      }}
      spellCheck={false}
      title="El cambio de nombre se aplica al salir de la celda o con Enter; Esc lo descarta."
    />
  );
}

// -----------------------------------------------------------------------------
// TypeCell — celda de la columna `type`: chip compacto con el color e icono
// del tipo (paletteForType / iconForType), editable en línea.
// -----------------------------------------------------------------------------

export type TypeCellProps = {
  value: string;
  onChange: (next: string) => void;
};

export function TypeCell({ value, onChange }: TypeCellProps) {
  const baseType = value.trim().split(/\s+/)[0] ?? "";
  const Icon = iconForType(baseType);
  const chipStyle = {
    "--xfs-type-color": paletteForType(baseType),
    "--xfs-type-bg": paletteSoftForType(baseType),
  } as CSSProperties;
  return (
    <span className="pulso-xfs-type-chip" style={chipStyle}>
      <Icon size={12} aria-hidden />
      <input
        type="text"
        className="pulso-xfs-cell is-expression"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </span>
  );
}
