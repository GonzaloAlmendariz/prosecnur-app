// Celdas del Editor XLSForm. Desde E10 (2026-10-20) ninguna celda escribe en el workbook por tecla: el borrador vive en
// SheetsView (lo comparte con la barra de fórmula) y se confirma al salir de la celda o con Enter; Esc lo descarta.
// Escribir por tecla clonaba el workbook y repintaba la página entera: 650 ms por tecla en ACNUR.

import { memo } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { iconForType } from "../helpers/icons";
import { aplicarInicioFin } from "./cursorTeclas";

export type CeldaHojaProps = {
  fila: number;
  columna: string;
  /** Lo que muestra la celda: el borrador si lo hay, si no el valor guardado. */
  valor: string;
  /** Valor guardado: decide input o textarea sin remontar mientras se escribe. */
  guardado: string;
  esExpresion: boolean;
  onEditar: (fila: number, columna: string, valor: string) => void;
  onConfirmar: () => void;
  onDescartar: () => void;
};

const TITULO_NAME = "El cambio de nombre se aplica al salir de la celda o con Enter; Esc lo descarta.";

function teclas(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, pendiente: boolean, props: CeldaHojaProps) {
  if (aplicarInicioFin(e)) return;
  if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    props.onConfirmar();
  } else if (e.key === "Escape" && pendiente) {
    e.preventDefault();
    e.stopPropagation();
    props.onDescartar();
  }
}

export const CeldaHoja = memo(function CeldaHoja(props: CeldaHojaProps) {
  const { fila, columna, valor, guardado, esExpresion, onEditar, onConfirmar } = props;
  const pendiente = valor !== guardado;
  const clase = `pulso-xfs-cell${esExpresion ? " is-expression" : ""}${pendiente ? " is-pending" : ""}`;
  const comunes = {
    value: valor,
    onBlur: onConfirmar,
    spellCheck: !esExpresion,
    "aria-label": `${columna}, fila ${fila + 1}`,
    "data-columna": columna,
    title: columna === "name" ? TITULO_NAME : undefined,
  };

  if (columna === "type") {
    const baseType = valor.trim().split(/\s+/)[0] ?? "";
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
          className={`pulso-xfs-cell is-expression${pendiente ? " is-pending" : ""}`}
          {...comunes}
          spellCheck={false}
          onChange={(e) => onEditar(fila, columna, e.target.value)}
          onKeyDown={(e) => teclas(e, pendiente, props)}
        />
      </span>
    );
  }

  // Textarea si lo guardado es largo o trae saltos; en reposo muestra hasta 3 líneas y se abre al editar (CSS).
  if (guardado.includes("\n") || guardado.length > 40) {
    return (
      <textarea
        className={`${clase} is-multiline`}
        {...comunes}
        rows={1}
        onChange={(e) => onEditar(fila, columna, e.target.value)}
        onKeyDown={(e) => teclas(e, pendiente, props)}
      />
    );
  }
  return (
    <input
      type="text"
      className={clase}
      {...comunes}
      onChange={(e) => onEditar(fila, columna, e.target.value)}
      onKeyDown={(e) => teclas(e, pendiente, props)}
    />
  );
});
