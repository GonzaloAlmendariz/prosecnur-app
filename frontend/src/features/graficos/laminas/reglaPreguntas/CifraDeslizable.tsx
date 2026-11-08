// La cifra de la regla (umbral, N o distancia) como slider con su valor escrito al lado. El slider recorre el eje del
// reparto que va encima (misma pista, mismo ancho): arrastrar el pulgar es mover el corte. Flechas mueven un paso,
// Shift + flecha (o RePág/AvPág) el paso grande, Inicio y Fin los extremos. El número admite todo el rango del campo,
// aunque el slider se limite a lo que el reparto dibuja. La pista no tiene paso nativo: el pulgar sigue al valor exacto
// (un umbral escrito a mano, 58 con paso 5) y el arrastre cae en el paso (alPaso). Mientras se mueve sólo se avisa `onMover`; `onSoltar` confirma.

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { alPaso, valorPorTecla, type Recorrido } from "./repartoRegla";

type Limites = { min: number; max: number };

type Props = {
  id: string;
  rotulo: string;
  valor: number;
  /** Lo que recorre la pista (el eje del reparto) y lo que admite la cifra desde el slider. */
  recorrido: Recorrido;
  /** Lo que admite el número escrito (el rango del campo). */
  campo: Limites;
  paso: number;
  grande: number;
  onMover: (v: number) => void;
  onSoltar: () => void;
  /** Lo que va entre el valor y la pista (el reparto, que comparte su ancho) y lo que va debajo (el eje). */
  encima?: ReactNode;
  debajo?: ReactNode;
};

const TECLAS = new Set(["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

export function CifraDeslizable({ id, rotulo, valor, recorrido, campo, paso, grande, onMover, onSoltar, encima, debajo }: Props) {
  const [texto, setTexto] = useState<string | null>(null);
  const idRotulo = `${id}-rotulo`;
  const idNumero = `${id}-numero`;
  const { pista, valores } = recorrido;
  const acotar = (v: number) => Math.min(valores.max, Math.max(valores.min, v));
  const enPista = acotar(valor);

  const teclaEn = (l: Limites, actual: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { setTexto(null); onSoltar(); return; }
    if (!TECLAS.has(e.key)) return;
    // En el número sólo las flechas verticales: las horizontales mueven el cursor del texto.
    if (e.currentTarget.type === "text" && !["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) return;
    const v = valorPorTecla(e.key, e.shiftKey, actual, { ...l, paso, grande });
    if (v === null) return;
    e.preventDefault();
    setTexto(null);
    onMover(v);
  };

  return (
    <div className="pulso-f6-regla-deslizador">
      <div className="pulso-f6-regla-deslizador-cabeza">
        <label className="pulso-f6-dato-rotulo" id={idRotulo} htmlFor={idNumero}>{rotulo}</label>
        <input id={idNumero} type="text" inputMode="numeric" autoComplete="off" className="pulso-f6-input pulso-f6-regla-numero"
          value={texto ?? String(valor)}
          onChange={(e) => {
            const crudo = e.target.value.replace(/[^\d.,]/g, "");
            setTexto(crudo);
            const n = Number(crudo.replace(",", "."));
            if (crudo !== "" && Number.isFinite(n) && n >= campo.min && n <= campo.max) onMover(n);
          }}
          onBlur={() => { setTexto(null); onSoltar(); }}
          onKeyDown={teclaEn(campo, valor)} />
      </div>
      {encima}
      <input id={id} type="range" className="pulso-f6-regla-rango" aria-labelledby={idRotulo}
        min={pista.min} max={pista.max} step="any" value={enPista} aria-valuetext={String(valor)}
        onChange={(e) => onMover(alPaso(Number(e.currentTarget.value), paso, valores))}
        onKeyDown={teclaEn(valores, enPista)}
        onPointerUp={onSoltar} onKeyUp={onSoltar} onBlur={onSoltar} />
      {debajo}
    </div>
  );
}
