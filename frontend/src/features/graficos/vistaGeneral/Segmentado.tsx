// Segmentado de la barra del Informe (Maquetas/Word, tamaño de tarjeta) con el patrón WAI-ARIA de grupo de radios:
// un solo punto de tabulación (la opción elegida) y las flechas mueven y eligen. Observación del verificador de la
// fase Informe (2026-10-15): cada opción era un tab stop y las flechas no hacían nada.

import { useRef, type KeyboardEvent } from "react";

type Props<K extends string> = {
  etiqueta: string;
  opciones: readonly { clave: K; rotulo: string }[];
  valor: K;
  onCambiar: (k: K) => void;
};

export function Segmentado<K extends string>({ etiqueta, opciones, valor, onCambiar }: Props<K>) {
  const grupo = useRef<HTMLDivElement>(null);
  const onTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const extremo = e.key === "Home" ? 0 : e.key === "End" ? opciones.length - 1 : null;
    if (!paso && extremo === null) return;
    e.preventDefault();
    const i = opciones.findIndex((o) => o.clave === valor);
    const j = extremo ?? (i + paso + opciones.length) % opciones.length;
    onCambiar(opciones[j].clave);
    grupo.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[j]?.focus();
  };
  return (
    <div ref={grupo} className="pulso-f6-vg-tamano" role="radiogroup" aria-label={etiqueta} onKeyDown={onTecla}>
      {opciones.map(({ clave, rotulo }) => (
        <button key={clave} type="button" role="radio" aria-checked={valor === clave} tabIndex={valor === clave ? 0 : -1}
          className={`pulso-f6-vg-tamano-op${valor === clave ? " is-activo" : ""}`} onClick={() => onCambiar(clave)}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}
