import type { Prueba } from "./armadorModelo";

// Un valor de prueba pintado por partes: cada tramo con el tono de su bloque y, si falla, el tramo que falla
// marcado y el resto atenuado. Un hueco al final señala lo que falta.

export function PruebaValor({ texto, prueba }: { texto: string; prueba: Prueba }) {
  const tramos = prueba.tramos.filter((p) => p.texto);
  if (prueba.ok) {
    return (
      <span className="xfa-valor">
        {tramos.map((p) => (
          <span key={p.i} className={`xfa-valor__p xfa-tono-${(p.i % 5) + 1}`}>
            {p.texto}
          </span>
        ))}
      </span>
    );
  }
  const ini = prueba.ini + prueba.parcial;
  const mal = texto.slice(ini, ini + prueba.largo);
  const resto = texto.slice(ini + prueba.largo);
  return (
    <span className="xfa-valor">
      {tramos.map((p) => (
        <span key={p.i} className={`xfa-valor__p xfa-tono-${(p.i % 5) + 1}`}>
          {p.texto}
        </span>
      ))}
      {prueba.parcial > 0 && <span className={`xfa-valor__p xfa-tono-${(prueba.k % 5) + 1}`}>{texto.slice(prueba.ini, ini)}</span>}
      {mal && <span className="xfa-valor__mal">{mal}</span>}
      {resto && <span className="xfa-valor__resto">{resto}</span>}
      {prueba.hueco && <span className="xfa-valor__hueco" aria-hidden="true" />}
    </span>
  );
}
