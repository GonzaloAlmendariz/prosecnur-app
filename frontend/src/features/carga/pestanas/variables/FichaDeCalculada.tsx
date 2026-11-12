import { Link, useInRouterContext } from "react-router-dom";
import { ArrowRight, Pencil, Trash2 } from "../../../../vendor/lucide-react";
import type { ResumenCalculada, VariableCalculada } from "../../../../api/baseVariables";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { conNivel } from "../../../../lib/navegacion/direccion";
import { escalaConCuentas, numeroCorto, textoCasos } from "./variablesModel";

const ROTULO_REGLA: Record<VariableCalculada["regla"], string> = {
  alguna: "Alguna marcada",
  recodificar: "Recodificación",
  formula: "Fórmula",
};

/** La calculada elegida: de qué sale, su escala con la cuenta por categoría y qué casos quedan sin dato. */
export function FichaDeCalculada({ calculada: c, resumen }: { calculada: VariableCalculada; resumen: ResumenCalculada | undefined }) {
  const escala = c.regla === "formula" ? [] : escalaConCuentas(c, resumen);
  const mayor = Math.max(1, ...escala.map((e) => e.n ?? 0));
  const numerico = resumen?.numerico ?? null;
  return (
    <div className="pulso-variables-ficha" data-qa-geometry-group="carga/variables-ficha" data-qa-geometry-contract="intrinsic">
      <section aria-labelledby={`pulso-variables-sale-${c.nombre}`}>
        <h4 id={`pulso-variables-sale-${c.nombre}`} className="pulso-variables-h">Sale de</h4>
        <p className="pulso-variables-ruta">
          {c.variables.length > 0 ? c.variables.map((v) => <code key={v}>{v}</code>) : <span>Sin variables de origen</span>}
          <ArrowRight size={14} aria-hidden="true" />
          <span>{ROTULO_REGLA[c.regla]}</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span className="pulso-variables-tipo" data-tono={c.regla === "formula" ? "int" : "so"}>
            {c.regla === "formula" ? "Numérica" : "Opción única"}
          </span>
        </p>
      </section>

      {c.regla === "formula" ? (
        <section aria-labelledby={`pulso-variables-formula-${c.nombre}`}>
          <h4 id={`pulso-variables-formula-${c.nombre}`} className="pulso-variables-h">Fórmula</h4>
          <p className="pulso-variables-formula"><code>{c.expresion}</code></p>
          {numerico && numerico.minimo !== null && numerico.maximo !== null ? (
            <p className="pulso-variables-nota">{`Con valor ${textoCasos(numerico.n_validos)}, de ${numeroCorto(numerico.minimo)} a ${numeroCorto(numerico.maximo)}`}</p>
          ) : null}
        </section>
      ) : (
        <section aria-labelledby={`pulso-variables-escala-${c.nombre}`}>
          <h4 id={`pulso-variables-escala-${c.nombre}`} className="pulso-variables-h">Categorías</h4>
          <ul className="pulso-variables-escala">
            {escala.map((e) => (
              <li key={e.codigo}>
                <code>{e.codigo}</code>
                <b>{e.etiqueta}</b>
                {e.n === null ? null : (
                  <>
                    <span className="pulso-variables-barra" aria-hidden="true"><i style={{ inlineSize: `${(e.n / mayor) * 100}%` }} /></span>
                    <em>{formatoConteo(e.n)}</em>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {resumen && resumen.n_sin_dato > 0 ? (
        <p className="pulso-variables-impacto">
          <b>{formatoConteo(resumen.n_sin_dato)}</b>
          <span>{resumen.n_sin_dato === 1 ? "caso queda sin dato." : "casos quedan sin dato."}</span>
        </p>
      ) : null}
    </div>
  );
}

/** El pie de la calculada: Editar y Quitar, con la confirmación en el mismo lugar; la de un segmento se edita en Segmentos. */
export function PieDeCalculada({
  calculada: c,
  confirmando,
  quitando,
  onEditar,
  onPedirQuitar,
  onQuitar,
  onCancelar,
}: {
  calculada: VariableCalculada;
  confirmando: boolean;
  quitando: boolean;
  onEditar: () => void;
  onPedirQuitar: () => void;
  onQuitar: () => void;
  onCancelar: () => void;
}) {
  const enRouter = useInRouterContext();
  if (c.segmento) {
    // Es la variable de un segmento de cruce (ADR 0107): editarla aquí desincronizaría el segmento entre las bases.
    const destino = `/carga${conNivel(conNivel("?pestana=equivalencias", "panel", "segmentos"), "foco", c.segmento)}`;
    return (
      <>
        <span className="pulso-variables-nota">Variable de un segmento de cruce</span>
        {enRouter ? <Link className="pulso-button pulso-button--secondary pulso-button--md" to={destino}>Editar en Segmentos</Link> : null}
      </>
    );
  }
  if (confirmando) {
    return (
      <>
        <span className="pulso-variables-nota" role="alert">{`¿Quitar "${c.nombre}"?`}</span>
        <PulsoButton variant="danger" confirm size="md" disabled={quitando} onClick={onQuitar}><Trash2 size={14} aria-hidden="true" />Quitar</PulsoButton>
        <PulsoButton variant="secondary" size="md" onClick={onCancelar}>Cancelar</PulsoButton>
      </>
    );
  }
  return (
    <>
      <PulsoButton variant="secondary" size="md" onClick={onEditar}>
        <Pencil size={14} aria-hidden="true" />
        Editar
      </PulsoButton>
      <PulsoButton variant="secondary" size="md" disabled={quitando} onClick={onPedirQuitar}>
        <Trash2 size={14} aria-hidden="true" />
        Quitar
      </PulsoButton>
    </>
  );
}
