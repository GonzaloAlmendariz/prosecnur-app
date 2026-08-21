/**
 * «De dónde sale cada tasa», como diagrama.
 *
 * Gonzalo: «la parte del pie de página donde sale de dónde sale cada tasa,
 * creo que no tiene por qué ser texto, sino podría ser tranquilamente un
 * diagrama mejor explicado y que no ocupe solo la mitad de la pantalla».
 *
 * Antes era un párrafo de cinco líneas limitado a 84ch que describía la curva
 * sin mostrarla nunca. Acá se ve: cada peldaño es un tramo de tamaño de aula
 * con lo que rinde y cuántas aulas del marco caen en él. Es también la
 * respuesta a la otra pregunta —«¿a qué se refiere con un mix de tamaños?»—,
 * porque el mix de una facultad es cómo reparte sus aulas por estos peldaños.
 *
 * Si el motor no publica los tramos no se dibuja nada: una curva de ejemplo
 * sería peor que ninguna.
 */
import { fmtInt } from "../../sharedCore";
import { curvaRendimiento, etiquetaPeldano, type PeldanoCurva } from "./curvaRendimientoModel";
import type { FilaTasaFacultad } from "./tasaFacultadModel";

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function CurvaRendimientoDiagrama({ filas }: { filas: FilaTasaFacultad[] }) {
  const curva: PeldanoCurva[] = curvaRendimiento(filas);
  if (curva.length < 2) return null;
  const conResidual = filas.filter((f) => f.conResidual);
  const maxTasa = Math.max(...curva.map((p) => p.tasa));

  return (
    <section className="cmv2-curva" aria-label="De dónde sale la tasa de cada facultad">
      <h4 className="cmv2-curva-titulo">De dónde sale cada tasa</h4>
      <ol className="cmv2-curva-escalera">
        {curva.map((p, i) => (
          <li key={p.tasa} className="cmv2-curva-peldano">
            <span className="cmv2-curva-rango">
              {etiquetaPeldano(p, i === curva.length - 1, i === 0)}
              <small>elegibles</small>
            </span>
            <i className="cmv2-curva-track" role="img" aria-label={`Rinde ${pct(p.tasa)}`}>
              <b style={{ width: `${(p.tasa / maxTasa) * 100}%` }} />
            </i>
            <span className="cmv2-curva-tasa">{pct(p.tasa)}</span>
            <span className="cmv2-curva-aulas">
              {fmtInt(p.nAulas)} <small>{p.nAulas === 1 ? "aula" : "aulas"}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="cmv2-curva-cierre">
        Un aula chica entrega más proporción de sus elegibles que una grande. La tasa de cada
        facultad es este rendimiento promediado por <b>su</b> mezcla de aulas
        {conResidual.length > 0 ? (
          <>
            , corregido por lo que rindió en el histórico — sólo en{" "}
            <b>{fmtInt(conResidual.length)}</b> de {fmtInt(filas.length)} facultades, las que
            acumularon base suficiente.
          </>
        ) : (
          <>. Ninguna facultad tiene aún corrección propia del histórico.</>
        )}
      </p>
    </section>
  );
}
