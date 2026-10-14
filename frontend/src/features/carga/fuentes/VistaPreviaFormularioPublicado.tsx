// Vista previa de «Formulario publicado» (ADR 0102): antes de crear la base —y
// después, en «Ver armonización», con lo guardado— se ve cuánto calza, lo que no entra y cada recodificación con su código y su
// etiqueta por separado («SIN INF», 5 → 99). Sólo pinta; el veredicto y los
// contadores salen de `formularioPublicadoModel`.

import { UMBRAL_COBERTURA, type VistaPreviaFormularioPublicado as VistaPreviaDatos } from "../../../api/cargaFormularioPublicado";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "../../../vendor/lucide-react";
import { contadoresVistaPrevia, veredictoVistaPrevia } from "./formularioPublicadoModel";

/** Las primeras recodificaciones a la vista; el resto, plegado. */
const RECODIFICACIONES_VISIBLES = 6;

function TablaRecodificaciones({ filas, etiqueta }: { filas: VistaPreviaDatos["recodificaciones"]; etiqueta: string }) {
  return (
    <table className="pulso-bfp-recod">
      <caption className="pulso-sr-only">{etiqueta}</caption>
      <thead>
        <tr>
          <th scope="col">Variable</th>
          <th scope="col">Etiqueta</th>
          <th scope="col" className="is-codigo">Código de la fuente</th>
          <th scope="col" aria-hidden="true" className="is-flecha" />
          <th scope="col" className="is-codigo">Código del formulario</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((r, i) => (
          <tr key={`${r.variable}:${r.desde}:${r.hacia}:${i}`}>
            <td className="is-variable">{r.variable}</td>
            <td className="is-etiqueta">{r.etiqueta || "Sin etiqueta"}</td>
            <td className="is-codigo"><span className="pulso-bfp-codigo">{r.desde || "vacío"}</span></td>
            <td className="is-flecha" aria-hidden="true"><ArrowRight size={13} /></td>
            <td className="is-codigo"><span className="pulso-bfp-codigo is-destino">{r.hacia || "vacío"}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListaVariables({ titulo, items }: { titulo: string; items: { variable: string; etiqueta: string }[] }) {
  if (!items.length) return null;
  return (
    <details className="pulso-bfp-detalle">
      <summary>{titulo} ({formatoConteo(items.length)})</summary>
      <ul>
        {items.map((x) => (
          <li key={x.variable}><span className="pulso-bfp-var">{x.variable}</span>{x.etiqueta ? <span>{x.etiqueta}</span> : null}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Veredicto, contadores, recodificaciones y lo que no calza. La usan la vista
 * previa antes de crear la base y el panel «Ver armonización» con lo guardado;
 * `grupoQa` distingue ambas superficies para el Contrato de Superficie (C1).
 */
export function VistaPreviaFormularioPublicado({ vistaPrevia, grupoQa = "carga/formulario-publicado" }: { vistaPrevia: VistaPreviaDatos; grupoQa?: string }) {
  const veredicto = veredictoVistaPrevia(vistaPrevia);
  const contadores = contadoresVistaPrevia(vistaPrevia);
  const bloqueado = veredicto.nivel === "bloqueado";
  const recod = vistaPrevia.recodificaciones;
  const visibles = recod.slice(0, RECODIFICACIONES_VISIBLES);
  const resto = recod.slice(RECODIFICACIONES_VISIBLES);
  const umbral = Math.round(UMBRAL_COBERTURA * 100);

  return (
    <div className="pulso-bfp-previa" data-qa-geometry-group={`${grupoQa}/vista-previa`} data-qa-geometry-contract="intrinsic">
      <div className={bloqueado ? "pulso-bfp-veredicto is-bloqueado" : "pulso-bfp-veredicto is-listo"} data-qa-geometry-member role={bloqueado ? "alert" : "status"}>
        <span className="pulso-bfp-veredicto-icono" aria-hidden="true">
          {bloqueado ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        </span>
        <div className="pulso-bfp-veredicto-texto">
          <strong>{veredicto.titulo}</strong>
          <span>{veredicto.detalle}</span>
          {vistaPrevia.fuentes.length > 1 ? (
            <span className="pulso-bfp-fuentes">
              {vistaPrevia.fuentes.map((f) => `${f.titulo || f.survey_id || f.tipo}: ${formatoConteoDe(f.n_filas, "respuesta")}`).join(" · ")}
            </span>
          ) : null}
        </div>
        {veredicto.porcentaje != null ? (
          <div className="pulso-bfp-medidor-caja">
            <div
              className="pulso-bfp-medidor"
              role="meter"
              aria-label="Variables del formulario que calzan"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={veredicto.porcentaje}
              aria-valuetext={`${veredicto.porcentaje} %; el mínimo es ${umbral} %`}
            >
              <span className="pulso-bfp-medidor-relleno" style={{ inlineSize: `${veredicto.porcentaje}%` }} />
              <span className="pulso-bfp-medidor-umbral" style={{ insetInlineStart: `${umbral}%` }} title={`Mínimo ${umbral} %`} />
            </div>
            <span className="pulso-bfp-medidor-cifra">{veredicto.porcentaje} %</span>
          </div>
        ) : null}
      </div>

      <dl className="pulso-bfp-contadores" data-qa-geometry-member data-qa-geometry-group={`${grupoQa}/contadores`} data-qa-geometry-contract="equal">
        {contadores.map((c) => (
          <div key={c.clave} className={c.valor ? "pulso-bfp-contador has-valor" : "pulso-bfp-contador"} data-qa-geometry-member>
            <dt>{c.rotulo}</dt>
            <dd>{formatoConteo(c.valor)}</dd>
            <small>{c.ayuda}</small>
          </div>
        ))}
      </dl>

      {recod.length ? (
        <section className="pulso-bfp-seccion" aria-label="Recodificaciones" data-qa-geometry-member>
          <h5>Recodificaciones <span>({formatoConteo(recod.length)})</span></h5>
          <p>Los códigos de la fuente se llevan a los del formulario según la etiqueta de cada opción, nunca por posición.</p>
          <TablaRecodificaciones filas={visibles} etiqueta="Recodificaciones de la fuente al formulario" />
          {resto.length ? (
            <details className="pulso-bfp-detalle">
              <summary>Ver las otras {formatoConteo(resto.length)}</summary>
              <TablaRecodificaciones filas={resto} etiqueta="Recodificaciones restantes" />
            </details>
          ) : null}
        </section>
      ) : null}

      {vistaPrevia.sin_par_instrumento.length || vistaPrevia.sin_par_fuente.length || vistaPrevia.agregadas_fuente.length || vistaPrevia.opciones_sin_par.length ? (
        <section className="pulso-bfp-seccion" aria-label="Lo que no calza" data-qa-geometry-member>
          <ListaVariables titulo="Preguntas del formulario sin par (quedan vacías)" items={vistaPrevia.sin_par_instrumento} />
          <ListaVariables titulo="Columnas de la fuente que no entran" items={vistaPrevia.sin_par_fuente} />
          <ListaVariables titulo="Columnas agregadas en la limpieza (entran con su nombre)" items={vistaPrevia.agregadas_fuente} />
          {vistaPrevia.opciones_sin_par.length ? (
            <details className="pulso-bfp-detalle">
              <summary>Opciones sin par, por variable ({formatoConteo(vistaPrevia.opciones_sin_par.length)})</summary>
              <p className="pulso-bfp-nota">Estas respuestas usan opciones que el formulario no tiene. Para conservarlas, agrégalas a la lista en Formularios y vuelve a publicar.</p>
              <ul>
                {vistaPrevia.opciones_sin_par.map((x) => (
                  <li key={x.variable}>
                    <span className="pulso-bfp-var">{x.variable}</span>
                    <span>{formatoConteoDe(x.n, "respuesta")} quedan vacías</span>
                    {x.etiquetas.length ? (
                      <span className="pulso-bfp-etiquetas-perdidas">
                        {x.etiquetas.map((e) => (
                          <span key={e.etiqueta} className="pulso-bfp-etiqueta-perdida">{e.etiqueta} <span className="is-n">{formatoConteo(e.n)}</span></span>
                        ))}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
