import { fmtN } from "./explorarModelo";

const POR_GRUPO = 8;

/** E8 — respuestas abiertas agrupadas por la otra variable. */
export default function CruceLista({
  grupos,
}: {
  grupos: readonly { etiqueta: string; respuestas: readonly { texto: string; n: number }[] }[];
}) {
  if (!grupos.length) return <p className="vx-pie">Sin respuestas abiertas en este cruce.</p>;
  return (
    <div className="vx-grupos">
      {grupos.map((g, i) => (
        <section key={`${g.etiqueta}-${i}`} className="vx-grupo" aria-label={g.etiqueta}>
          <h5>{g.etiqueta}</h5>
          {g.respuestas.length === 0 ? (
            <p className="vx-pie">Sin respuestas.</p>
          ) : (
            <ul className="vx-textos">
              {g.respuestas.slice(0, POR_GRUPO).map((r) => (
                <li key={r.texto}>
                  <span>{r.texto}</span>
                  <span>× {fmtN(r.n)}</span>
                </li>
              ))}
            </ul>
          )}
          {g.respuestas.length > POR_GRUPO && (
            <p className="vx-pie">y {fmtN(g.respuestas.length - POR_GRUPO)} respuestas distintas más</p>
          )}
        </section>
      ))}
    </div>
  );
}
