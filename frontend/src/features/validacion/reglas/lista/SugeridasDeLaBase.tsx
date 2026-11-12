/**
 * "Sugeridas al mirar la base" bajo la lista de las propias (prototipo
 * `pp-v-sug`, `vistas.js:639-642`): lo que el motor propone tras leer la base,
 * con su porqué, los casos que marca hoy (si el motor los mide) y "Añadir". Añadir abre el panel de regla armado con ella,
 * como "Usar" dentro del panel; se guarda desde ahí.
 */
import { Plus } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { textoDeLaCasa } from "../panel/QueRevisar";
import type { ReglaSemilla } from "../../types";

export function SugeridasDeLaBase({
  semillas,
  ocupada,
  onAnadir,
}: {
  semillas: readonly ReglaSemilla[];
  ocupada: boolean;
  onAnadir: (semilla: ReglaSemilla) => void;
}) {
  if (!semillas.length) return null;
  return (
    <section className="pulso-rl-sugeridas" aria-labelledby="pulso-rl-sugeridas-titulo">
      <h3 id="pulso-rl-sugeridas-titulo" className="pulso-rl-seccion-rotulo">
        <span>Sugeridas al mirar la base</span>
        <span className="pulso-rl-familias-n">{formatoConteo(semillas.length)}</span>
      </h3>
      <ul
        className="pulso-rl-sugeridas-lista"
        data-qa-geometry-group="validacion/reglas-sugeridas"
        data-qa-geometry-contract="intrinsic"
      >
        {semillas.map((s, i) => (
          <li key={`${s.nombre}-${i}`} className="pulso-rl-sugerida" data-qa-geometry-member="">
            <div className="pulso-rl-sugerida-texto">
              <b>{textoDeLaCasa(s.nombre)}</b>
              <span>{textoDeLaCasa(s.semilla.porque)}</span>
              {typeof s.semilla.n_casos_hoy === "number" ? (
                <span className="pulso-rl-sugerida-casos">Casos que marca hoy: {formatoConteo(s.semilla.n_casos_hoy)}</span>
              ) : null}
            </div>
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={ocupada}
              aria-label={`Añadir la sugerida ${s.nombre}`}
              onClick={() => onAnadir(s)}
            >
              <Plus size={13} aria-hidden="true" />
              Añadir
            </PulsoButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
