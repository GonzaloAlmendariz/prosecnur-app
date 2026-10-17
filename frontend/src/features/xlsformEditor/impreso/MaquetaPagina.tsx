// Esquema de la primera página impresa con las opciones actuales (M12, 2026-10-17). «Así queda» estaba vacío hasta
// pulsar «Previsualizar», que genera el PDF real y tarda: unos 490×670 px en blanco justo donde se mira el efecto
// de cada opción. Ahora la página A4 se dibuja al instante y cambia con columnas, cabecera, instrucciones y ancho de
// matrices. Mismo idioma que las maquetas del kit: tinta en gris, color sólo en el acento.

import type { ReactNode } from "react";
import type { PdfDialogState } from "../shell/pdfExportPreference";

const TINTA = "var(--pulso-border-strong)";
const LINEA = "var(--pulso-border)";
const SUAVE = "var(--pulso-surface-2)";
const ACENTO = "var(--module-accent, var(--pulso-primary))";
const M = 14; // margen
const ANCHO = 210 - 2 * M;

const barra = (x: number, y: number, w: number, fill = LINEA, h = 2.6) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;

/** Una pregunta: número, enunciado y tres opciones. Devuelve el dibujo y su alto. */
function pregunta(x: number, y: number, w: number, n: number): [ReactNode, number] {
  const largo = [0.82, 0.64, 0.74][n % 3]!;
  return [
    <g key={`p${x}-${y}`}>
      <rect x={x} y={y} width={6} height={5} rx={1.2} fill={ACENTO} />
      {barra(x + 9, y + 1.2, (w - 9) * largo, TINTA)}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={x + 11} cy={y + 10.5 + i * 5.6} r={1.6} fill="none" stroke={TINTA} strokeWidth={0.6} />
          {barra(x + 15, y + 9.3 + i * 5.6, (w - 15) * [0.42, 0.34, 0.5][i]!)}
        </g>
      ))}
    </g>,
    28,
  ];
}

function matriz(x: number, y: number, w: number): [ReactNode, number] {
  const cols = 4;
  const etiqueta = w * 0.38;
  const paso = (w - etiqueta) / cols;
  return [
    <g key={`m${x}-${y}`}>
      <rect x={x} y={y} width={6} height={5} rx={1.2} fill={ACENTO} />
      {barra(x + 9, y + 1.2, w * 0.5, TINTA)}
      <rect x={x} y={y + 8} width={w} height={7} fill={SUAVE} />
      {Array.from({ length: cols }, (_, c) => <g key={c}>{barra(x + etiqueta + c * paso + paso * 0.2, y + 10.7, paso * 0.6, TINTA, 1.8)}</g>)}
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          {barra(x + 2, y + 19 + r * 6.4, etiqueta * [0.8, 0.62, 0.72, 0.55][r]!)}
          {Array.from({ length: cols }, (_, c) => <circle key={c} cx={x + etiqueta + c * paso + paso / 2} cy={y + 20.3 + r * 6.4} r={1.5} fill="none" stroke={TINTA} strokeWidth={0.6} />)}
          <path d={`M${x} ${y + 23.5 + r * 6.4} h${w}`} stroke={LINEA} strokeWidth={0.4} />
        </g>
      ))}
    </g>,
    44,
  ];
}

/** Columnas de preguntas desde `y` hasta el pie. */
function columnasDesde(y: number, columnas: 1 | 2, desde: number): ReactNode[] {
  const out: ReactNode[] = [];
  const gap = 8;
  const w = columnas === 2 ? (ANCHO - gap) / 2 : ANCHO;
  for (let c = 0; c < columnas; c++) {
    let yy = y;
    let n = desde + c * 10;
    while (yy + 28 <= 278) {
      const [dib, alto] = pregunta(M + c * (w + gap), yy, w, n++);
      out.push(dib);
      yy += alto + 4;
    }
  }
  return out;
}

export function MaquetaPagina({ estado, hayMatrices }: { estado: PdfDialogState; hayMatrices: boolean }) {
  let y = M;
  const partes: ReactNode[] = [];
  // Cabecera
  if (estado.showHeaderTitle) partes.push(<g key="tit">{barra(M, y + 1, 92, TINTA, 3.4)}{barra(M, y + 7, 54, LINEA, 2.2)}</g>);
  if (estado.showQuestionnaireNumber) {
    partes.push(
      <g key="num">
        {barra(210 - M - 44, y + 3, 8, TINTA, 2)}
        {[0, 1, 2, 3].map((i) => <rect key={i} x={210 - M - 32 + i * 8} y={y} width={7} height={8} rx={1} fill="none" stroke={TINTA} strokeWidth={0.7} />)}
      </g>,
    );
  }
  if (estado.showHeaderTitle || estado.showQuestionnaireNumber) {
    y += 13;
    partes.push(<path key="sep" d={`M${M} ${y} h${ANCHO}`} stroke={TINTA} strokeWidth={0.6} />);
    y += 6;
  }
  // Instrucciones
  if (estado.defaultIntro) {
    partes.push(
      <g key="intro">
        <rect x={M} y={y} width={ANCHO} height={18} rx={2} fill={SUAVE} />
        {barra(M + 5, y + 4, 34, TINTA, 2.2)}
        {barra(M + 5, y + 9.5, ANCHO * 0.78)}
        {barra(M + 5, y + 13.5, ANCHO * 0.56)}
      </g>,
    );
    y += 24;
  }
  // Una matriz al principio, a lo ancho o en la primera columna.
  const enColumna = estado.columns !== 1 && estado.matrixLayout === "column";
  if (hayMatrices && !enColumna) {
    const [dib, alto] = matriz(M, y, ANCHO);
    partes.push(dib);
    y += alto + 6;
  }
  if (estado.columns === "auto") {
    // Automáticas: la batería ancha a toda la página, lo demás a dos columnas.
    const [p1, a1] = pregunta(M, y, ANCHO, 0);
    partes.push(p1);
    y += a1 + 4;
    partes.push(...columnasDesde(y, 2, 1));
  } else if (enColumna && hayMatrices) {
    const gap = 8;
    const w = (ANCHO - gap) / 2;
    const [dib, alto] = matriz(M, y, w);
    partes.push(dib);
    let yy = y + alto + 6;
    let n = 0;
    while (yy + 28 <= 278) { const [p, a] = pregunta(M, yy, w, n++); partes.push(p); yy += a + 4; }
    yy = y; n = 10;
    while (yy + 28 <= 278) { const [p, a] = pregunta(M + w + gap, yy, w, n++); partes.push(p); yy += a + 4; }
  } else {
    partes.push(...columnasDesde(y, estado.columns === 2 ? 2 : 1, 0));
  }
  return (
    <svg className="pulso-xf-imp-pagina" viewBox="0 0 210 297" role="img" aria-label="Esquema de la primera página con estas opciones">
      <rect x={0.5} y={0.5} width={209} height={296} rx={3} fill="var(--pulso-surface)" stroke={LINEA} />
      {partes}
      {barra(103, 287, 4, TINTA, 1.8)}
    </svg>
  );
}
