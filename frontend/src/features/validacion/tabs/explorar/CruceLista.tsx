import { fmtN } from "./explorarModelo";

const POR_GRUPO = 6;

/**
 * E8m — la abierta agrupada por las categorías de una única. Cada respuesta lleva una barra en la misma escala
 * para todos los grupos, así que un grupo con más repeticiones se ve; la más repetida va en navy. Si ninguna
 * respuesta se repite, no hay barras: una barra llena para cada «1» no dice nada.
 */
export default function CruceLista({
  grupos,
}: {
  grupos: readonly { etiqueta: string; respuestas: readonly { texto: string; n: number }[] }[];
}) {
  if (!grupos.length) return <p className="vx-pie">Sin respuestas abiertas en este cruce.</p>;
  const max = Math.max(1, ...grupos.flatMap((g) => g.respuestas.map((r) => r.n)));
  const conBarras = max > 1;
  return (
    <div className="vx-grupos">
      {grupos.map((g, i) => {
        const total = g.respuestas.reduce((t, r) => t + r.n, 0);
        return (
          <section key={`${g.etiqueta}-${i}`} className="vx-grupo" aria-label={g.etiqueta}>
            <h5>
              {g.etiqueta}
              <span>{fmtN(total)} {total === 1 ? "respuesta" : "respuestas"}</span>
            </h5>
            {g.respuestas.length === 0 ? (
              <p className="vx-pie">Sin respuestas.</p>
            ) : (
              <ul className={`vx-textos${conBarras ? " con-barras" : ""}`}>
                {g.respuestas.slice(0, POR_GRUPO).map((r) => (
                  <li key={r.texto} className={conBarras && r.n === max ? "is-mayor" : undefined}>
                    <span>{r.texto}</span>
                    <span>{fmtN(r.n)}</span>
                    {conBarras && (
                      <span className="vx-texto-barra" aria-hidden>
                        <i style={{ width: `${(100 * r.n) / max}%` }} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {g.respuestas.length > POR_GRUPO && (
              <p className="vx-pie">y {fmtN(g.respuestas.length - POR_GRUPO)} respuestas distintas más</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
