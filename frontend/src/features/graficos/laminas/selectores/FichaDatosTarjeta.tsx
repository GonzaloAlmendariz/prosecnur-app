// Ficha «Datos» de una tarjeta del selector de láminas (auditoría del selector, hallazgo 2). Tres filas fijas:
// «Preguntas» (los tipos que usa el gráfico, el principal destacado), «Públicos» (uno, varios o uno o varios, y cada
// base con su n) y «Tu estudio» (lo que el estudio tiene para ese gráfico o, en una línea, qué falta). La ficha no
// bloquea la tarjeta ni sugiere otra: el analista decide. Modelo en fichaDatos.ts.

import { useId } from "react";
import { CircleAlert } from "../../../../vendor/lucide-react";
import type { UsaGrafico } from "../../iconos/catalogoTipos.generated";
import { Panel } from "../../../../components/Panel";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { ErrorBlock } from "../../../../components/States";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { cruzarConEstudio, ROTULO_PREGUNTA, ROTULO_PUBLICOS, type EstadoInventario } from "./fichaDatos";

type Props = {
  usa: UsaGrafico;
  inventario: EstadoInventario;
  /** Sufijo del grupo C1 cuando hay dos fichas en pantalla (la vista Comparar). */
  grupo?: string;
};

export function FichaDatosTarjeta({ usa, inventario, grupo }: Props) {
  const id = useId();
  const cruce = inventario.estado === "listo" ? cruzarConEstudio(usa, inventario.publicos) : null;
  return (
    <Panel
      variant="subtle"
      className="pulso-f6-datos"
      aria-labelledby={`${id}-titulo`}
      data-ficha-datos=""
      data-qa-geometry-group={`graficos/f6-ficha-datos${grupo ? `-${grupo}` : ""}`}
      data-qa-geometry-contract="intrinsic"
    >
      <h4 id={`${id}-titulo`} className="pulso-f6-datos-titulo">Datos</h4>
      <dl className="pulso-f6-datos-filas">
        <div className="pulso-f6-datos-fila" data-fila-datos="preguntas" data-qa-geometry-member>
          <dt>Preguntas</dt>
          <dd>
            <ul className="pulso-f6-datos-chips" aria-label="Tipos de pregunta que usa">
              {usa.pregunta.map((t, i) => (
                <li key={t} className={i === 0 ? "pulso-f6-chip pulso-f6-dato-chip is-principal" : "pulso-f6-chip pulso-f6-dato-chip"}
                  data-pregunta={t} data-principal={i === 0 ? "" : undefined}>
                  {ROTULO_PREGUNTA[t]}
                  {i === 0 && usa.pregunta.length > 1 && <span className="pulso-sr-only"> (principal)</span>}
                </li>
              ))}
              {usa.cruce && <li className="pulso-f6-chip pulso-f6-dato-chip is-secundario" data-cruce="">Admite cruce</li>}
            </ul>
          </dd>
        </div>
        <div className="pulso-f6-datos-fila" data-fila-datos="publicos" data-qa-geometry-member>
          <dt>Públicos</dt>
          <dd>
            <span className="pulso-f6-datos-cuantos" data-publicos={usa.publicos}>{ROTULO_PUBLICOS[usa.publicos]}</span>
            {usa.padron && <span className="pulso-f6-chip pulso-f6-dato-chip is-secundario" data-padron="">Usa padrón</span>}
            {cruce && cruce.publicos.length > 0 && (
              <ul className="pulso-f6-datos-chips" aria-label="Públicos del estudio">
                {cruce.publicos.map((p) => (
                  <li key={p.base} className="pulso-f6-chip pulso-f6-dato-chip is-publico" data-base={p.base}
                    data-sin-preguntas={p.preguntas === 0 ? "" : undefined}>
                    {p.publico}
                    <span className="pulso-f6-dato-n">n = {formatoConteo(p.n)}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div className="pulso-f6-datos-fila" data-fila-datos="estudio" data-qa-geometry-member>
          <dt>Tu estudio</dt>
          <dd aria-live="polite">
            {inventario.estado === "cargando" && <CargaDeBloque label="Leyendo el estudio…" />}
            {inventario.estado === "error" && <ErrorBlock label="No se pudo leer el estudio" detail={inventario.mensaje} />}
            {cruce && (
              <>
                {cruce.resumen && <p className="pulso-f6-datos-resumen">{cruce.resumen}</p>}
                {cruce.faltas.map((f) => (
                  <p key={f} className="pulso-f6-datos-falta" data-falta="">
                    <CircleAlert size={13} aria-hidden="true" />
                    {f}
                  </p>
                ))}
              </>
            )}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
