import { INFO_MARCA, RIEL, type CasillaRiel } from "./marcasNodo";
import "./riel.css";

// Cabecera de columnas del riel (identidad «Señales», 2026-10-17): «OB CO RE CA FI» sobre las casillas, fija al
// hacer scroll. Cada rótulo corto lleva su nombre completo para el lector de pantalla y al pasar el puntero.
// S10 (2026-10-17): «SI» se leía «sí» y «ƒx» como fórmula suelta; las cinco abreviaturas son dos letras del nombre
// (Obligatoria, Condición, Restricción, Cálculo, Filtro) y ninguna es una palabra.

export const ABREVIATURA_COLUMNA: Readonly<Record<CasillaRiel, string>> = {
  oblig: "OB",
  cond: "CO",
  regla: "RE",
  calc: "CA",
  filtro: "FI",
};

const NOMBRE_COLUMNA: Readonly<Record<CasillaRiel, string>> = {
  oblig: INFO_MARCA.oblig.nombre,
  cond: "Condición",
  regla: INFO_MARCA.regla.nombre,
  calc: INFO_MARCA.calc.nombre,
  filtro: INFO_MARCA.filtro.nombre,
};

export function CabeceraRiel({ className }: { className?: string }) {
  return (
    <div className={className ? `xfk-riel-cab ${className}` : "xfk-riel-cab"}>
      <span className="xfk-riel-cab__rotulo">Pregunta</span>
      <span
        className="xfk-riel-cab__cols"
        role="list"
        aria-label="Columnas de marcas"
        data-qa-geometry-group="xlsform/riel-cab"
        data-qa-geometry-contract="equal"
      >
        {RIEL.map((k) => (
          <abbr key={k} role="listitem" className="xfk-riel-cab__col" data-columna={k} title={NOMBRE_COLUMNA[k]} aria-label={NOMBRE_COLUMNA[k]}>
            {ABREVIATURA_COLUMNA[k]}
          </abbr>
        ))}
      </span>
    </div>
  );
}
