import { ArrowRightLeft, X } from "lucide-react";
import { fmt, fmtConSigno } from "../rotulos";
import type { FichaDeUmp as Ficha } from "./fichaUmpModel";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import { CuotaPorVariable } from "./CuotaPorVariable";

const TONO_DE_SILUETA = { pendiente: "falta", subsanada: "info", completa: "ok" } as const;

/**
 * Ficha de una UMP (P1 de Avance › Mapa e inspector de Avance › UMP). Va al
 * costado del mapa o de la tabla, nunca encima: se abre con
 * `panel=ump&foco=<UMP>` y se cierra quitando el panel.
 */
export function FichaDeUmp({
  ficha,
  onCerrar,
  onSugerencia,
}: {
  ficha: Ficha;
  onCerrar: () => void;
  onSugerencia?: () => void;
}) {
  return (
    <aside className="mon-ump-ficha" aria-labelledby="mon-ump-ficha-titulo" data-qa-geometry-member="ficha">
      <header className="mon-ump-ficha-cabecera">
        <SiluetaDeDistrito distrito={ficha.distrito} tono={TONO_DE_SILUETA[ficha.estado]} lado={48} />
        <div data-qa-geometry-group="territorial-ump-identidad" data-qa-geometry-contract="intrinsic">
          <h3 id="mon-ump-ficha-titulo">UMP {ficha.ump}</h3>
          <span className="mon-ump-base">{ficha.distrito}, manzana {ficha.tipo.toLowerCase()} {ficha.manzana}</span>
          <span className="mon-ump-base">{ficha.aplicador}</span>
        </div>
        <button type="button" className="mon-ump-cerrar" aria-label={`Cerrar la ficha de la UMP ${ficha.ump}`} onClick={onCerrar}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <span className={`mon-ump-estado is-${ficha.estado}`}>{ficha.rotuloDeEstado}</span>

      <dl className="mon-ump-cifras">
        <div>
          <dt>Cuentan</dt>
          <dd>
            <b>{fmt(ficha.cuentan)}</b> / {fmt(ficha.meta)}
            {ficha.subsanado !== 0 ? <small> ({fmt(ficha.levantadas)} {fmtConSigno(ficha.subsanado)} subsanado)</small> : null}
          </dd>
        </div>
        <div>
          <dt>En el corte</dt>
          <dd>
            {ficha.enCorte == null ? "—" : <b>{fmt(ficha.enCorte)}</b>}
            {ficha.noCuentan ? <small> ({fmt(ficha.noCuentan)} no cuentan)</small> : null}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="mon-ump-ficha-cuota" className="mon-ump-cuota">
        <h4 id="mon-ump-ficha-cuota" className="mon-ump-subtitulo">Cuota por variable</h4>
        <CuotaPorVariable variables={ficha.variables} titulo={`Cuota de la UMP ${ficha.ump}`} />
      </section>

      {ficha.sugerencia ? (
        <p className="mon-ump-sugerencia">
          <ArrowRightLeft size={14} aria-hidden="true" />
          <span>Subsanación sugerida desde la {ficha.sugerencia}</span>
          {onSugerencia ? <button type="button" className="mon-ump-enlace" onClick={onSugerencia}>Revisar</button> : null}
        </p>
      ) : null}

      <section aria-labelledby="mon-ump-ficha-casos" className="mon-ump-casos-marco">
        <h4 id="mon-ump-ficha-casos" className="mon-ump-subtitulo">Casos de la UMP</h4>
        {ficha.casos === null ? (
          <p className="mon-ump-base">Los casos llegan con el corte de Validación, que aún se está preparando.</p>
        ) : ficha.casos.length ? (
          <ol className="mon-ump-casos" data-qa-geometry-capacity="owned" data-qa-geometry-group="territorial-ump-casos" data-qa-geometry-contract="intrinsic">
            {ficha.casos.map((caso) => (
              <li key={caso.id} className={`is-${caso.estado}`}>
                <span className="mon-ump-caso-cuando">{caso.fecha}{caso.hora ? ` ${caso.hora}` : ""}</span>
                <span>{caso.sexo}, {caso.edad}</span>
                <span className="mon-ump-caso-gps">{caso.distancia}</span>
                <b>{caso.rotuloDeEstado}</b>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mon-ump-base">Sin casos en el corte.</p>
        )}
      </section>
    </aside>
  );
}
