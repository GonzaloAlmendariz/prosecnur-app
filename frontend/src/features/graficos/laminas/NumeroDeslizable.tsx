// Número acotado de la tarjeta como slider con su valor escrito al lado (ítem 11 de la oleada del inspector, 2026-11-08):
// envuelve la CifraDeslizable de la regla de preguntas. Mientras se arrastra, la cifra cambia en vivo; al soltar (o tras
// la espera de useCifraEnVivo, con teclado o escritura) se confirma UNA vez: un paso de deshacer y un render de la
// lámina, no uno por píxel. El tramo sale de modeloNumeroDeslizable.ts.
//
// Con `vacio` el número admite «sin valor» (la letra en «Auto», el espacio de las etiquetas que se ajusta a los nombres):
// un botón lo dice y lo restablece; mientras rige, la cifra se ve tenue.

import { useRef, type ReactNode } from "react";
import { CifraDeslizable } from "./reglaPreguntas/CifraDeslizable";
import { useCifraEnVivo } from "./reglaPreguntas/useCifraEnVivo";
import { valorDeslizable, type RangoDeslizable } from "./modeloNumeroDeslizable";
import "./numeroDeslizable.css";

type Props = {
  id: string;
  rotulo: string;
  /** El «?» y el sello de alcance, junto al rótulo. */
  marcas?: ReactNode;
  rango: RangoDeslizable;
  valor: unknown;
  porDefecto?: unknown;
  /** Rótulo del «sin valor» («Auto», «Automático»); sin él, el número siempre tiene valor. */
  vacio?: string;
  onCambio: (v: number | null) => void;
  qa?: string;
};

export function NumeroDeslizable({ id, rotulo, marcas, rango, valor, porDefecto, vacio, onCambio, qa }: Props) {
  const mostrado = valorDeslizable(valor, porDefecto, rango);
  // El destino se fija al empezar a mover: una confirmación pendiente al cambiar de gráfico va al gráfico que se movió.
  const destino = useRef(onCambio);
  const cifra = useCifraEnVivo(mostrado.valor, `${id}:${rango.min}:${rango.max}`, (v) => destino.current(v));
  const mover = (v: number) => { destino.current = onCambio; cifra.mover(v); };
  const enVacio = !!vacio && mostrado.vacio && !cifra.enVivo;
  // Sin valor de referencia («Auto» del espacio de las etiquetas lo calcula la lámina) no hay cifra que mostrar: se ve sólo «Auto».
  const sinCifra = enVacio && (typeof porDefecto !== "number" || !Number.isFinite(porDefecto));
  return (
    <div className={`pulso-f6-dato pulso-f6-numdesl${enVacio ? " is-vacio" : ""}${sinCifra ? " is-sin-cifra" : ""}`} data-qa={qa}>
      <CifraDeslizable id={id} rotulo={rotulo} valor={cifra.valor}
        recorrido={{ pista: { min: rango.min, max: rango.max }, valores: { min: rango.min, max: rango.max } }}
        campo={{ min: rango.min, max: rango.max }} paso={rango.paso} grande={rango.grande}
        onMover={mover} onSoltar={cifra.soltar} />
      {marcas ? <span className="pulso-f6-numdesl-marcas">{marcas}</span> : null}
      {vacio ? (
        <button type="button" className="pulso-f6-numdesl-vacio" aria-pressed={enVacio}
          aria-label={enVacio ? `${rotulo}: ${vacio}` : `Volver a ${vacio.toLowerCase()} en ${rotulo.toLowerCase()}`}
          onClick={() => { if (!enVacio) onCambio(null); }}>
          {vacio}
        </button>
      ) : null}
    </div>
  );
}
