// Subcapítulos de un capítulo del índice (I5): una fila por subcapítulo con su número, para escribir, subir, bajar o quitar,
// y «Agregar subcapítulo». Reemplaza el texto con un subcapítulo por línea, que obligaba a separar con Enter.

import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "../../../vendor/lucide-react";

type Props = {
  numeroCapitulo: number;
  nombreCapitulo: string;
  subcapitulos: readonly string[];
  onCambiar: (subcapitulos: string[]) => void;
};

export function SubcapitulosEditor({ numeroCapitulo, nombreCapitulo, subcapitulos, onCambiar }: Props) {
  const filas = [...subcapitulos];
  const enfocar = useRef<number | null>(null);
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (enfocar.current === null) return;
    lista.current?.querySelectorAll<HTMLInputElement>("input")[enfocar.current]?.focus();
    enfocar.current = null;
  });
  const cambiar = (i: number, v: string) => onCambiar(filas.map((s, j) => (j === i ? v : s)));
  const insertar = (en: number) => { enfocar.current = en; onCambiar([...filas.slice(0, en), "", ...filas.slice(en)]); };
  const quitar = (i: number) => onCambiar(filas.filter((_, j) => j !== i));
  const mover = (i: number, a: number) => {
    const out = [...filas]; const [x] = out.splice(i, 1); out.splice(a, 0, x); onCambiar(out);
  };
  return (
    <div className="pulso-f6-subcaps">
      {filas.length > 0 && (
        <ol ref={lista} className="pulso-f6-subcaps-lista" aria-label={`Subcapítulos de «${nombreCapitulo}»`}>
          {filas.map((s, i) => (
            <li key={i} className="pulso-f6-subcaps-fila">
              <span className="pulso-f6-subcaps-num" aria-hidden="true">{numeroCapitulo}.{i + 1}</span>
              <input
                className="pulso-f6-input"
                value={s}
                placeholder="Nombre del subcapítulo"
                aria-label={`Subcapítulo ${numeroCapitulo}.${i + 1}`}
                onChange={(e) => cambiar(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertar(i + 1); } }}
              />
              <button type="button" className="pulso-f6-icono-boton" aria-label={`Subir el subcapítulo ${numeroCapitulo}.${i + 1}`} disabled={i === 0} onClick={() => mover(i, i - 1)}>
                <ArrowUp size={13} aria-hidden="true" />
              </button>
              <button type="button" className="pulso-f6-icono-boton" aria-label={`Bajar el subcapítulo ${numeroCapitulo}.${i + 1}`} disabled={i === filas.length - 1} onClick={() => mover(i, i + 1)}>
                <ArrowDown size={13} aria-hidden="true" />
              </button>
              <button type="button" className="pulso-f6-icono-boton" aria-label={`Quitar el subcapítulo ${numeroCapitulo}.${i + 1}`} onClick={() => quitar(i)}>
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="pulso-f6-texto-boton pulso-f6-subcaps-agregar" onClick={() => insertar(filas.length)}>
        <Plus size={13} aria-hidden="true" /> Agregar subcapítulo
      </button>
    </div>
  );
}
