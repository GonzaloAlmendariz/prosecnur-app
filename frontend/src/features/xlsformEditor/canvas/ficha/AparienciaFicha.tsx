// Apariencia en la plataforma (C9, C13): cada opción dibujada, elegida con un toque. La impresa no se edita aquí:
// vive en «Impreso» y la ficha lleva ahí.

import type { ReactNode } from "react";
import { Check } from "../../../../vendor/lucide-react";
import { aparienciaActiva, aparienciaAjena, aparienciasDe, conApariencia, type DibujoApariencia } from "./modeloFicha";
import { EnlaceIr } from "./piezasFicha";

const barra = (x: number, y: number, w: number, o = 0.35) => <rect x={x} y={y} width={w} height="4" rx="2" fill="currentColor" opacity={o} />;
const contorno = { fill: "none", stroke: "currentColor", strokeWidth: 1.25 } as const;

const DIBUJOS: Readonly<Record<DibujoApariencia, ReactNode>> = {
  lista: (
    <>
      <circle cx="12" cy="12" r="4" {...contorno} />{barra(22, 10, 60)}
      <circle cx="12" cy="26" r="4" fill="currentColor" />{barra(22, 24, 48)}
      <circle cx="12" cy="40" r="4" {...contorno} />{barra(22, 38, 54)}
    </>
  ),
  desplegable: (
    <>
      <rect x="6" y="16" width="120" height="22" rx="6" {...contorno} />{barra(14, 25, 54)}
      <path d="M108 24l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  fila: (
    <>
      <rect x="4" y="18" width="34" height="18" rx="9" {...contorno} />
      <rect x="44" y="18" width="34" height="18" rx="9" fill="currentColor" opacity="0.9" />
      <rect x="84" y="18" width="34" height="18" rx="9" {...contorno} />
    </>
  ),
  buscador: (
    <>
      <rect x="6" y="8" width="120" height="18" rx="6" {...contorno} />
      <circle cx="16" cy="17" r="4" {...contorno} />
      <rect x="6" y="30" width="120" height="16" rx="4" fill="currentColor" opacity="0.1" />{barra(14, 36, 50)}
    </>
  ),
  linea: <><rect x="6" y="18" width="120" height="20" rx="6" {...contorno} />{barra(14, 26, 40)}</>,
  lineas: <><rect x="6" y="6" width="120" height="42" rx="6" {...contorno} />{barra(14, 14, 96)}{barra(14, 23, 84)}{barra(14, 32, 60)}</>,
  fecha: <><rect x="6" y="18" width="34" height="20" rx="5" {...contorno} /><rect x="48" y="18" width="34" height="20" rx="5" {...contorno} /><rect x="90" y="18" width="36" height="20" rx="5" {...contorno} /></>,
  mes: <><rect x="20" y="18" width="40" height="20" rx="5" {...contorno} /><rect x="68" y="18" width="44" height="20" rx="5" {...contorno} /></>,
  anio: <><rect x="40" y="18" width="52" height="20" rx="5" {...contorno} />{barra(50, 26, 24)}</>,
  pantalla: (
    <>
      <rect x="34" y="6" width="64" height="42" rx="6" {...contorno} />{barra(42, 16, 40, 0.45)}
      <rect x="42" y="26" width="48" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </>
  ),
  junta: (
    <>
      <rect x="34" y="4" width="64" height="46" rx="6" {...contorno} />
      <rect x="42" y="11" width="34" height="3" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="42" y="17" width="48" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="42" y="28" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="42" y="34" width="48" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1" />
    </>
  ),
};

export function AparienciaFicha({ base, appearance, onCambio, onIrImpreso }: {
  base: string;
  appearance: string;
  onCambio: (appearance: string) => void;
  onIrImpreso?: () => void;
}) {
  const opciones = aparienciasDe(base);
  const activa = aparienciaActiva(base, appearance);
  const ajena = aparienciaAjena(base, appearance);
  const impreso = onIrImpreso ? (
    <div className="xfh-nota-imp">
      <span>Cómo sale impresa se decide en Impreso.</span>
      <EnlaceIr onClick={onIrImpreso}>Abrir Impreso</EnlaceIr>
    </div>
  ) : null;
  if (!opciones) {
    return (
      <>
        <p className="xfh-aviso-suave">Este tipo se muestra de una sola forma en la plataforma.</p>
        {impreso}
      </>
    );
  }
  return (
    <>
      <div
        className={opciones.length > 2 ? "xfh-apariencias" : "xfh-apariencias is-dos"}
        role="radiogroup"
        aria-label="Apariencia en la plataforma"
        data-qa-geometry-group="xlsform/ficha-apariencias"
        data-qa-geometry-contract="equal"
      >
        {opciones.map((o) => {
          const on = o.valor === activa;
          return (
            <button
              key={o.valor || "estandar"}
              type="button"
              role="radio"
              aria-checked={on}
              className="xfh-apa"
              onClick={() => { if (!on) onCambio(conApariencia(base, appearance, o.valor)); }}
              data-qa-geometry-member=""
            >
              <span className="xfh-apa__lienzo">
                <svg viewBox="0 0 132 54" aria-hidden="true" focusable="false">{DIBUJOS[o.dibujo]}</svg>
                <span className="xfh-apa__check" aria-hidden="true"><Check size={10} strokeWidth={3.2} /></span>
              </span>
              <b>{o.nombre}</b>
              <small>{o.detalle}</small>
            </button>
          );
        })}
      </div>
      {ajena.length ? (
        <p className="xfh-det__sub">También trae {ajena.map((t, i) => <span key={t}>{i ? ", " : ""}<code className="xfh-code">{t}</code></span>)}, que se conserva.</p>
      ) : null}
      {impreso}
    </>
  );
}
