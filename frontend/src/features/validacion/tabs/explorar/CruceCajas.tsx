import type { ExploradorCruceCaja } from "../../../../api/validacionExplorar";
import CajaResumen from "./CajaResumen";
import { fmtN, fmtValor } from "./explorarModelo";

/** E8 — cajas por grupo, todas en la misma escala para que se comparen. */
export default function CruceCajas({ grupos }: { grupos: readonly ExploradorCruceCaja[] }) {
  if (!grupos.length) return <p className="vx-pie">Sin grupos con valores para comparar.</p>;
  const escala = { min: Math.min(...grupos.map((g) => g.min)), max: Math.max(...grupos.map((g) => g.max)) };
  return (
    <div className="vx-cajas">
      {grupos.map((g, i) => (
        <div key={`${g.etiqueta}-${i}`} className="vx-cajas-fila">
          <span className="vx-barra-etq">{g.etiqueta}</span>
          <CajaResumen {...g} escala={escala} etiqueta={g.etiqueta} />
          <span>
            Md {fmtValor(g.mediana)} · n {fmtN(g.n)}
            {g.n_atipicos > 0 ? ` · ${fmtN(g.n_atipicos)} atíp.` : ""}
          </span>
        </div>
      ))}
      <div className="vx-cajas-eje" aria-hidden>
        <span />
        <span className="vx-eje">
          <span>{fmtValor(escala.min)}</span>
          <span>{fmtValor(escala.max)}</span>
        </span>
        <span />
      </div>
    </div>
  );
}
