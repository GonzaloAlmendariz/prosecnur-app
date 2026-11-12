import type { ExploradorFicha } from "../../../../api/validacionExplorar";
import { fmtN, fmtPct } from "./explorarModelo";

/**
 * E11: "En los datos". Sólo cifras que la ficha trae. Las reglas que leen la
 * pregunta tienen su propio panel, "Reglas sobre esta pregunta"
 * (`ReglasDeLaPregunta`).
 */
export default function PanelDatos({ ficha, filtrado }: { ficha: ExploradorFicha; filtrado: boolean }) {
  const d = ficha.datos;
  const categorica = ficha.tipo === "so" || ficha.tipo === "sm";
  return (
    <section className="vx-panel" aria-label="Lo que se ve en los datos">
      <div className="vx-panel-cab">
        <h4>En los datos</h4>
        {filtrado && <span>toda la base, sin filtros</span>}
      </div>
      <dl className="vx-dl is-cifras" data-qa-geometry-group="validacion/explorar-ficha-datos" data-qa-geometry-contract="intrinsic">
        <dt>Sin respuesta</dt>
        <dd>
          {fmtN(d.n_sin_respuesta)}
          {d.n_total > 0 ? ` (${fmtPct((100 * d.n_sin_respuesta) / d.n_total)})` : ""}
        </dd>
        {categorica && (
          <>
            <dt>Fuera de la lista</dt>
            <dd>{fmtN(d.n_fuera_de_lista)}</dd>
          </>
        )}
        {d.n_otro_textos !== null && (
          <>
            <dt>Textos en "Otro"</dt>
            <dd>{fmtN(d.n_otro_textos)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
