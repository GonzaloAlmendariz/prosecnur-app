// Editor de una variable calculada de la base (ADR 0106, punto 2): nombre,
// etiqueta y una de dos reglas. La lógica (borrador, validación, cuerpo del
// POST) vive en `variablesBaseModel`; aquí sólo hay render y eventos.

import { useId, useMemo, useReducer, useState } from "react";
import type { CalculadaADeclarar, ReglaCalculada, VariableCalculada } from "../../../api/baseVariables";
import type { VariableDeBase } from "../../../api/equivalencias";
import { PulsoButton } from "../../../components/PulsoButton";
import { Copy, Plus, Save, Trash2 } from "../../../vendor/lucide-react";
import { ArmonizacionAsignarEnMasa } from "../ArmonizacionAsignarEnMasa";
import { DESTINO_SIN_MAPA, textoMarcados } from "../armonizacionMasaModel";
import { avisoNoListable } from "../codigosObservadosModel";
import { observadosListos, useCodigosObservados, type LecturaCodigosObservados } from "../useCodigosObservados";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import {
  borradorCalculadaDesde,
  calculadaParaGuardar,
  filasRecodificacion,
  opcionesDeOrigen,
  reducirCalculada,
  validarCalculada,
  type AccionCalculada,
  type BorradorCalculada,
  type OpcionDeOrigen,
} from "./variablesBaseModel";
import { PreguntaOrigen, PreguntasAlguna } from "./SelectorPreguntas";
import { FormulaCampo } from "./FormulaCampo";
import { ayudasDisponibles } from "../segmentos/segmentosModel";
import { MapaPorRangos } from "../MapaPorRangos";
import { PlegableValorPorValor } from "../ArmonizacionAyudaMapa";

const REGLAS: { id: ReglaCalculada; rotulo: string; ayuda: string }[] = [
  { id: "alguna", rotulo: "Alguna de varias preguntas", ayuda: "Sí si alguna tiene uno de los códigos indicados." },
  { id: "recodificar", rotulo: "Recodificar una pregunta", ayuda: "Lleva sus códigos o valores a una escala nueva." },
  { id: "formula", rotulo: "Fórmula", ayuda: "Una operación con variables de la base, como 2026 − P8." },
];

export type CalculadaEditorProps = {
  /** La base de la calculada: de ella se leen los códigos observados del origen. */
  base: string;
  inicial: VariableCalculada | null;
  /** `null` mientras llega el catálogo de la base. */
  preguntas: readonly VariableDeBase[] | null;
  catalogoError: boolean;
  ocupados: readonly string[];
  guardando: boolean;
  error: string;
  onGuardar: (c: CalculadaADeclarar) => Promise<boolean>;
  onCancelar: () => void;
};

export function CalculadaEditor({
  base,
  inicial,
  preguntas,
  catalogoError,
  ocupados,
  guardando,
  error,
  onGuardar,
  onCancelar,
}: CalculadaEditorProps) {
  const id = useId();
  const [b, despachar] = useReducer(reducirCalculada, inicial, borradorCalculadaDesde);
  const [intento, setIntento] = useState(false);
  const lista = preguntas ?? [];
  const lectura = useCodigosObservados(b.regla === "recodificar" ? base : "", b.recodificar.variable);
  const observados = observadosListos(lectura);
  const origen = useMemo(
    () => opcionesDeOrigen(lista, b.recodificar.variable, b.recodificar.mapa, observados),
    [lista, b.recodificar.variable, b.recodificar.mapa, observados],
  );
  const errores = validarCalculada(b, ocupados, origen);

  const guardar = async () => {
    setIntento(true);
    if (errores.length) return;
    await onGuardar(calculadaParaGuardar(b));
  };

  return (
    <div className="pulso-vb-editor" role="group" aria-labelledby={`${id}-titulo`}>
      <h4 id={`${id}-titulo`} className="pulso-vb-editor-titulo">
        {inicial ? `Editar «${inicial.nombre}»` : "Nueva variable calculada"}
      </h4>

      <div className="pulso-vb-campos">
        <label className="pulso-compuesto-campo">
          <span>Etiqueta</span>
          <input
            value={b.etiqueta}
            placeholder="Cómo se lee en tablas y gráficos"
            onChange={(e) => despachar({ tipo: "etiqueta", valor: e.target.value })}
          />
        </label>
        <label className="pulso-compuesto-campo">
          <span>Nombre en la base</span>
          <input
            className="pulso-vb-mono"
            value={b.nombre}
            placeholder="Se propone desde la etiqueta"
            disabled={b.editando}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => despachar({ tipo: "nombre", valor: e.target.value })}
          />
        </label>
      </div>

      <div className="pulso-vb-reglas" role="radiogroup" aria-label="Regla">
        {REGLAS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={b.regla === r.id}
            className={b.regla === r.id ? "pulso-vb-regla is-activa" : "pulso-vb-regla"}
            onClick={() => despachar({ tipo: "regla", valor: r.id })}
          >
            <strong>{r.rotulo}</strong>
            <small>{r.ayuda}</small>
          </button>
        ))}
      </div>

      {preguntas === null ? (
        <p className="pulso-armon-nota" role="status">Leyendo las preguntas de la base…</p>
      ) : catalogoError ? (
        // C5 categoría 3: el catálogo no llegó.
        <p className="pulso-armon-aviso" role="alert">No se pudieron leer las preguntas de la base.</p>
      ) : b.regla === "formula" ? (
        <FormulaCampo
          expresion={b.formula.expresion}
          opciones={lista}
          onCambio={(valor) => despachar({ tipo: "expresion", valor })}
        />
      ) : b.regla === "alguna" ? (
        <PreguntasAlguna
          opciones={lista}
          variables={b.alguna.variables}
          codigosTexto={b.alguna.codigosTexto}
          despachar={(accion) => despachar({ tipo: "alguna", accion })}
        />
      ) : (
        <Recodificar b={b} preguntas={lista} origen={origen} lectura={lectura} despachar={despachar} />
      )}

      <div className="pulso-vb-editor-pie">
        <span className="pulso-vb-editor-estado" aria-live="polite">
          {error ? (
            <span className="pulso-armon-error" role="alert">{error}</span>
          ) : intento && errores.length ? (
            <span className="pulso-armon-error">{errores[0]}</span>
          ) : null}
        </span>
        <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={onCancelar}>
          Cancelar
        </PulsoButton>
        <PulsoButton
          variant="primary"
          size="sm"
          className="pulso-armon-btn"
          disabled={guardando || (intento && errores.length > 0)}
          onClick={() => void guardar()}
        >
          <Save size={14} aria-hidden="true" />
          {guardando ? "Calculando…" : "Guardar y calcular"}
        </PulsoButton>
      </div>
    </div>
  );
}

function Recodificar({
  b,
  preguntas,
  origen,
  lectura,
  despachar,
}: {
  b: BorradorCalculada;
  preguntas: readonly VariableDeBase[];
  origen: OpcionDeOrigen[];
  lectura: LecturaCodigosObservados;
  despachar: (a: AccionCalculada) => void;
}) {
  const observados = observadosListos(lectura);
  // Texto, identificador o tipo desconocido: una línea en lugar de la tabla.
  const noListable = observados ? avisoNoListable(observados.tipo) : null;
  const conCasos = observados !== null && !noListable;
  const r = b.recodificar;
  const filas = filasRecodificacion(origen, r);
  const escalaValida = r.escala.filter((c) => c.codigo.trim());
  const sinMapa = filas.filter((f) => f.sinMapa).map((f) => f.codigo);
  // Una variable numérica (una edad, una fórmula) se agrupa en rangos.
  const numerica = !noListable && escalaValida.length > 0 && ayudasDisponibles(origen.filter((o) => o.n !== 0)).includes("rangos");
  return (
    <div className="pulso-vb-bloque">
      <PreguntaOrigen opciones={preguntas} variable={r.variable} onElegir={(variable) => despachar({ tipo: "origen", variable })} />

      {r.variable && (
        <>
          <div className="pulso-vb-subtitulo">
            <h5>Escala nueva</h5>
            <span className="pulso-vb-subtitulo-acciones">
              {origen.length > 0 && (
                <PulsoButton variant="ghost" size="sm" className="pulso-armon-btn" onClick={() => despachar({ tipo: "copiar-opciones", opciones: origen })}>
                  <Copy size={13} aria-hidden="true" />
                  Partir de las opciones de {r.variable}
                </PulsoButton>
              )}
              <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={() => despachar({ tipo: "categoria-agregar" })}>
                <Plus size={13} aria-hidden="true" />
                Agregar categoría
              </PulsoButton>
            </span>
          </div>
          {r.escala.length === 0 ? (
            // C3: el vacío es de la escala y dice cómo se llena.
            <p className="pulso-armon-vacio">Agrega las categorías o parte de las opciones de {r.variable}.</p>
          ) : (
            <ol className="pulso-armon-escala">
              {r.escala.map((c, i) => (
                <li key={c.clave}>
                  <span className="pulso-armon-escala-pos" aria-hidden="true">{i + 1}</span>
                  <input
                    value={c.codigo}
                    aria-label={`Código de la categoría ${i + 1}`}
                    onChange={(e) => despachar({ tipo: "categoria-codigo", clave: c.clave, valor: e.target.value })}
                  />
                  <input
                    value={c.etiqueta}
                    placeholder="Etiqueta"
                    aria-label={`Etiqueta de la categoría ${i + 1}`}
                    onChange={(e) => despachar({ tipo: "categoria-etiqueta", clave: c.clave, valor: e.target.value })}
                  />
                  <button
                    type="button"
                    className="pulso-icon pulso-icon-danger"
                    aria-label={`Quitar la categoría ${c.etiqueta || c.codigo || i + 1}`}
                    onClick={() => despachar({ tipo: "categoria-quitar", clave: c.clave })}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="pulso-vb-subtitulo">
            <h5>Cada código de {r.variable}</h5>
            <span className="pulso-armon-ayuda">
              Un código sin mapa queda sin dato.
              {observados && observados.n_sin_dato > 0 ? ` Sin dato: ${formatoConteoDe(observados.n_sin_dato, "caso", "casos")}.` : ""}
            </span>
          </div>
          {numerica && (
            // Origen numérico (una fórmula, una edad): rangos en línea, como en Segmentos y Armonizar.
            <MapaPorRangos
              key={r.variable}
              base={r.variable}
              origen={r.variable}
              valores={origen}
              escala={escalaValida.map((c) => ({ codigo: c.codigo.trim(), etiqueta: c.etiqueta }))}
              mapa={r.mapa}
              onAsignar={(cambios) => {
                const porDestino = new Map<string, string[]>();
                for (const [codigo, destino] of Object.entries(cambios)) {
                  const k = destino ?? "";
                  porDestino.set(k, [...(porDestino.get(k) ?? []), codigo]);
                }
                for (const [k, codigos] of porDestino) despachar({ tipo: "destino", codigos, destino: k === "" ? null : k });
              }}
            />
          )}
          {lectura.tipo === "cargando" && (
            <p className="pulso-armon-nota" role="status">Leyendo los valores de {r.variable}…</p>
          )}
          {lectura.tipo === "error" && (
            // C5 categoría 3: queda la lista del instrumento.
            <p className="pulso-armon-aviso" role="alert">No se pudieron leer los valores de {r.variable}: {lectura.mensaje}</p>
          )}
          {noListable ? (
            <p className="pulso-armon-aviso" role="status">{noListable}</p>
          ) : origen.length === 0 ? (
            <p className="pulso-armon-nota">{r.variable} no trae lista de respuestas.</p>
          ) : (
            <PlegableValorPorValor plegado={numerica} n={origen.length} base={r.variable}>
              <ArmonizacionAsignarEnMasa
                base={r.variable}
                escala={escalaValida}
                nMarcados={r.marcados.length}
                nSinMapa={sinMapa.length}
                onAsignar={(eleccion) => despachar({ tipo: "destino", codigos: r.marcados, destino: eleccion === DESTINO_SIN_MAPA ? null : eleccion })}
                onMarcarSinMapa={() => despachar({ tipo: "marcar-varios", codigos: sinMapa })}
                onLimpiar={() => despachar({ tipo: "limpiar-marcas" })}
              />
              <div className="pulso-armon-tabla-wrap">
                <table className="pulso-armon-tabla pulso-vb-recod">
                  <caption className="pulso-sr-only">
                    Códigos de {r.variable} y su categoría en la escala nueva. {textoMarcados(r.marcados.length)}.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col"><span className="pulso-sr-only">Marcar</span></th>
                      <th scope="col">Código</th>
                      <th scope="col">Respuesta</th>
                      {conCasos && <th scope="col" className="is-num">Casos</th>}
                      <th scope="col">Categoría nueva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const marcado = r.marcados.includes(f.codigo);
                      return (
                        <tr key={f.codigo} className={[marcado ? "is-marcado" : "", f.sinMapa ? "is-sin-mapa" : ""].filter(Boolean).join(" ") || undefined}>
                          <td className="pulso-armon-marca">
                            <input
                              type="checkbox"
                              checked={marcado}
                              aria-label={`Marcar el código ${f.codigo}`}
                              onChange={(e) => despachar({ tipo: "marcar", codigo: f.codigo, marcado: e.currentTarget.checked })}
                            />
                          </td>
                          <td className="pulso-armon-codigo">{f.codigo}</td>
                          <td>{f.etiqueta || <span className="pulso-armon-tenue">Sin etiqueta</span>}</td>
                          {conCasos && <td className="is-num">{f.n === null ? <span className="pulso-armon-tenue">sin conteo</span> : formatoConteo(f.n)}</td>}
                          <td>
                            <select
                              value={f.destino ?? ""}
                              aria-label={`Categoría nueva del código ${f.codigo}`}
                              onChange={(e) => despachar({ tipo: "destino", codigos: [f.codigo], destino: e.target.value || null })}
                            >
                              <option value="">Sin mapa</option>
                              {escalaValida.map((c) => (
                                <option key={c.clave} value={c.codigo}>{c.etiqueta || c.codigo}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </PlegableValorPorValor>
          )}
        </>
      )}
    </div>
  );
}
