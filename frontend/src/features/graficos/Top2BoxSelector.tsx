// Selector del Top Two Box: las categorías de la escala como chips y exactamente dos elegidas (R14). Reemplaza al campo
// de texto separado por comas, que no ofrecía las categorías ni exigía dos, y cuya ayuda prometía que el vacío usaba las
// dos últimas (el motor ya no las deduce). Contrato de Superficie: el marco no depende del número de categorías (los
// chips envuelven), el vacío vive dentro de la caja con lo que falta (C3/C5) y ninguna etiqueta se recorta (C4).

import { alternarCategoria, estadoTop2Box, TOP2BOX_CANTIDAD } from "./top2boxSeleccion";

type Props = {
  /** Categorías elegibles de la escala, en su orden (sin las especiales). */
  categorias: string[];
  seleccion: string[];
  onChange: (seleccion: string[]) => void;
};

export function Top2BoxSelector({ categorias, seleccion, onChange }: Props) {
  const estado = estadoTop2Box(seleccion, categorias);
  const llena = seleccion.length >= TOP2BOX_CANTIDAD;
  if (!categorias.length) {
    return (
      <div style={vacioStyle} data-qa="top2box-vacio">
        Elige preguntas que compartan una escala con categorías para declarar su Top Two Box.
      </div>
    );
  }
  return (
    <div style={cajaStyle} data-qa="top2box-selector">
      <div role="group" aria-label="Categorías del Top Two Box" style={chipsStyle}>
        {categorias.map((c) => {
          const elegida = seleccion.includes(c);
          const bloqueada = !elegida && llena;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={elegida}
              disabled={bloqueada}
              onClick={() => onChange(alternarCategoria(seleccion, c, categorias))}
              style={elegida ? chipElegidaStyle : bloqueada ? chipBloqueadaStyle : chipStyle}
            >
              {c}
            </button>
          );
        })}
      </div>
      <div style={{ ...mensajeStyle, color: estado.tono === "ok" ? "var(--pulso-success-fg)" : "var(--pulso-warn-fg)" }} data-qa="top2box-estado">
        {estado.mensaje}
      </div>
    </div>
  );
}

const cajaStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const chipsStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const chipStyle: React.CSSProperties = {
  border: "1px solid var(--pulso-border)", borderRadius: 999, padding: "3px 10px", fontSize: 11, lineHeight: 1.35,
  background: "var(--pulso-surface)", color: "var(--pulso-text)", cursor: "pointer", textAlign: "left", whiteSpace: "normal",
};
const chipElegidaStyle: React.CSSProperties = {
  ...chipStyle, border: "1px solid var(--pulso-primary-border)", background: "var(--pulso-primary-soft)", color: "var(--pulso-primary)", fontWeight: 700,
};
const chipBloqueadaStyle: React.CSSProperties = { ...chipStyle, color: "var(--pulso-text-soft)", cursor: "not-allowed", opacity: 0.6 };
const mensajeStyle: React.CSSProperties = { fontSize: 11 };
const vacioStyle: React.CSSProperties = {
  border: "1px dashed var(--pulso-border)", borderRadius: 7, padding: "7px 9px", fontSize: 11, color: "var(--pulso-text-soft)",
};
