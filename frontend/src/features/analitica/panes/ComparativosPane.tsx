// Pestaña Comparativos de Analítica (contrato E4-E7, R4).
//
// Tabula la serie de mediciones armonizada en Carga › Equivalencias como un
// comparativo simple (frecuencias por período) o de cruces. Lo que decide la
// pestaña vive en `comparativosModel.ts`: aquí sólo se presenta.
//
// Readiness propia (`readinessPropia` en el catálogo): la pestaña lee la matriz
// aparte del `preparar` de la sección, así que publica su marca en sus tres
// estados terminales (cargada, sin serie que comparar y error).

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileJson,
  GitCompare,
  Loader2,
  Play,
} from "lucide-react";
import {
  apiAnaliticaComparativoCruces,
  type ComparativoAviso,
  apiAnaliticaComparativoFrecuencias,
  normalizarComparativoResultado,
  type ComparativoResultado,
  type ComparativoTipo,
} from "../../../api/analitica";
import { downloadUrl } from "../../../api/core";
import { getEquivalencias, type EquivalenciasEstado } from "../../../api/equivalencias";
import { EmptyState, ErrorBlock, LoadingBlock } from "../../../components/States";
import { JobProgress } from "../../../components/JobProgress";
import {
  DIRECCION_EQUIVALENCIAS,
  accionParaAviso,
  accionParaError,
  bloqueoDeGeneracion,
  comparativosReducer,
  construirBody,
  celdaNa,
  celdaNoOfrecidas,
  errorDesde,
  especialesSinMapa,
  etiquetaDeAviso,
  estadoInicial,
  filasArmonizadas,
  formatoBytes,
  motivoVacio,
  periodosDeSerie,
  preguntasEfectivas,
  cantidad,
  detalleCobertura,
  rotuloDe,
  rotuloPorDefecto,
  totalSinMapa,
  type CeldaResumen,
  type ComparativosUi,
  type ErrorComparativo,
  type FilaArmonizada,
  type MotivoVacio,
} from "./comparativosModel";
import "./ComparativosPane.css";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "lista"; equivalencias: EquivalenciasEstado };

const COPY_VACIO: Record<MotivoVacio, { titulo: string; pista: string }> = {
  "sin-equivalencias": {
    titulo: "Aún no hay matriz de equivalencias",
    pista: "Declara en Carga, pestaña Equivalencias, qué variable es la misma pregunta en cada medición y armoniza sus escalas. Después vuelve aquí para generar el comparativo.",
  },
  "sin-armonizadas": {
    titulo: "Ninguna pregunta está armonizada",
    pista: "La matriz existe pero ninguna fila declara una escala común. Abre una fila en Carga, pestaña Equivalencias, y armonízala entre mediciones.",
  },
  "sin-serie": {
    titulo: "La serie tiene menos de dos mediciones",
    pista: "Un comparativo necesita al menos dos bases en el orden de la serie. Revísalo en Carga, pestaña Equivalencias.",
  },
};

export function ComparativosPane() {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });

  useEffect(() => {
    let cancelado = false;
    getEquivalencias()
      .then((equivalencias) => {
        if (!cancelado) setCarga({ estado: "lista", equivalencias });
      })
      .catch((e: unknown) => {
        if (!cancelado) setCarga({ estado: "error", mensaje: e instanceof Error ? e.message : String(e) });
      });
    return () => { cancelado = true; };
  }, []);

  if (carga.estado === "cargando") {
    return <LoadingBlock label="Leyendo la matriz de equivalencias…" />;
  }
  if (carga.estado === "error") {
    return (
      <div
        data-audit-ready="analitica-comparativos"
        className="pulso-comparativos"
        data-qa-geometry-group="comparativos-error"
        data-qa-geometry-contract="intrinsic"
      >
        <ErrorBlock label="No se pudo leer la matriz de equivalencias" detail={carga.mensaje} />
      </div>
    );
  }
  const motivo = motivoVacio(carga.equivalencias);
  if (motivo) {
    return (
      <div
        data-audit-ready="analitica-comparativos"
        className="pulso-comparativos"
        data-qa-geometry-group="comparativos-vacio"
        data-qa-geometry-contract="intrinsic"
      >
        <EmptyState
          icon={<GitCompare size={20} />}
          title={COPY_VACIO[motivo].titulo}
          hint={COPY_VACIO[motivo].pista}
          cta={(
            <Link className="pulso-comparativos-enlace" to={DIRECCION_EQUIVALENCIAS}>
              Ir a Equivalencias <ArrowRight size={14} />
            </Link>
          )}
        />
      </div>
    );
  }
  return <ComparativosMesa equivalencias={carga.equivalencias} />;
}

function ComparativosMesa({ equivalencias }: { equivalencias: EquivalenciasEstado }) {
  const filas = useMemo(() => filasArmonizadas(equivalencias), [equivalencias]);
  const periodos = useMemo(() => periodosDeSerie(equivalencias), [equivalencias]);
  const [ui, dispatch] = useReducer(comparativosReducer, undefined, () => estadoInicial(filas, periodos));

  const ocupado = ui.enviando !== null || ui.job !== null;

  async function generar(tipo: ComparativoTipo) {
    if (bloqueoDeGeneracion(ui, tipo) || ocupado) return;
    dispatch({ tipo: "enviando", comparativo: tipo });
    const body = construirBody(ui, tipo, filas, periodos);
    try {
      const inicio = tipo === "cruces"
        ? await apiAnaliticaComparativoCruces(body)
        : await apiAnaliticaComparativoFrecuencias(body);
      dispatch({ tipo: "job", comparativo: tipo, id: inicio.job_id });
    } catch (e) {
      dispatch({ tipo: "fallo", error: errorDesde(e) });
    }
  }

  const onDone = useCallback((datos: unknown) => {
    dispatch({ tipo: "listo", datos: normalizarComparativoResultado(datos) });
  }, []);
  const onError = useCallback((mensaje: string) => {
    dispatch({ tipo: "fallo", error: errorDesde(mensaje) });
  }, []);
  const onCancelled = useCallback(() => dispatch({ tipo: "cancelado" }), []);

  const bloqueoSimple = bloqueoDeGeneracion(ui, "frecuencias");
  const bloqueoCruces = bloqueoDeGeneracion(ui, "cruces");

  return (
    <div className="pulso-comparativos analitica-report-shell" data-audit-ready="analitica-comparativos">
      <dl
        className="pulso-comparativos-cifras"
        data-qa-geometry-group="comparativos-cifras"
        data-qa-geometry-contract="equal"
      >
        <Cifra etiqueta="Mediciones" valor={periodos.length} />
        <Cifra etiqueta="Preguntas armonizadas" valor={filas.length} />
        <Cifra etiqueta="Preguntas elegidas" valor={preguntasEfectivas(ui, "frecuencias").length} />
        <Cifra etiqueta="Variables de cruce" valor={ui.cruces.length} />
      </dl>

      <div
        className="pulso-comparativos-secciones"
        data-qa-geometry-group="comparativos-secciones"
        data-qa-geometry-contract="intrinsic"
      >
        <RotulosPeriodos periodos={periodos} ui={ui} onCambio={(base, valor) => dispatch({ tipo: "rotulo", base, valor })} />

        <ListaDeFilas
          id="comparativos-preguntas"
          titulo="Preguntas del comparativo"
          ayuda="Cada pregunta elegida sale como una tabla con una columna por medición. En el comparativo de cruces se omiten las que también son cruce."
          filas={filas}
          elegidas={ui.preguntas}
          marcadas={ui.cruces}
          marca="También es cruce"
          totalPeriodos={periodos.length}
          rotulos={ui.rotulos}
          onAlternar={(clave) => dispatch({ tipo: "alternar-pregunta", clave })}
          acciones={(
            <div className="pulso-comparativos-lista-acciones">
              <button type="button" className="pulso-ghost" onClick={() => dispatch({ tipo: "todas-las-preguntas", claves: filas.filter((f) => f.seleccionable).map((f) => f.clave) })}>
                Todas
              </button>
              <button type="button" className="pulso-ghost" onClick={() => dispatch({ tipo: "ninguna-pregunta" })}>
                Ninguna
              </button>
            </div>
          )}
        />

        <ListaDeFilas
          id="comparativos-cruces"
          titulo="Variables de cruce"
          ayuda="Sólo para el comparativo de cruces. Una variable de cruce no se tabula como pregunta en ese archivo."
          filas={filas}
          elegidas={ui.cruces}
          marcadas={[]}
          marca=""
          totalPeriodos={periodos.length}
          rotulos={ui.rotulos}
          onAlternar={(clave) => dispatch({ tipo: "alternar-cruce", clave })}
        />

        <Notas
          filas={filas.filter((f) => ui.preguntas.includes(f.clave))}
          ui={ui}
          onNota={(clave, valor) => dispatch({ tipo: "nota-pregunta", clave, valor })}
          onGenerales={(valor) => dispatch({ tipo: "notas-generales", valor })}
        />
      </div>

      <div className="pulso-comparativos-generar">
        <div className="pulso-comparativos-botones">
          <BotonGenerar
            etiqueta="Generar comparativo simple"
            corriendo={ui.enviando === "frecuencias" || ui.job?.tipo === "frecuencias"}
            deshabilitado={ocupado || bloqueoSimple !== null}
            variante="pulso-primary"
            onClick={() => { void generar("frecuencias"); }}
          />
          <BotonGenerar
            etiqueta="Generar comparativo de cruces"
            corriendo={ui.enviando === "cruces" || ui.job?.tipo === "cruces"}
            deshabilitado={ocupado || bloqueoCruces !== null}
            variante="pulso-secondary"
            onClick={() => { void generar("cruces"); }}
          />
        </div>
        {(bloqueoSimple || bloqueoCruces) && !ocupado ? (
          <p className="pulso-comparativos-bloqueo">{bloqueoSimple ?? bloqueoCruces}</p>
        ) : null}
        {ui.job ? (
          <JobProgress<unknown>
            label={ui.job.tipo === "cruces" ? "Comparativo de cruces" : "Comparativo simple"}
            jobId={ui.job.id}
            onDone={onDone}
            onError={onError}
            onCancelled={onCancelled}
          />
        ) : null}
        {ui.error ? <ErrorConAccion error={ui.error} /> : null}
      </div>

      {ui.resultado ? <Resultado tipo={ui.resultado.tipo} datos={ui.resultado.datos} /> : null}
    </div>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="pulso-comparativos-cifra" data-qa-geometry-member>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

function RotulosPeriodos({
  periodos,
  ui,
  onCambio,
}: {
  periodos: string[];
  ui: ComparativosUi;
  onCambio: (base: string, valor: string) => void;
}) {
  return (
    <section className="pulso-comparativos-bloque" aria-labelledby="comparativos-rotulos-titulo" data-qa-geometry-member>
      <header className="pulso-comparativos-bloque-head">
        <h3 id="comparativos-rotulos-titulo">Rótulos de las mediciones</h3>
        <p>Así se titula cada columna del comparativo, en el orden de la serie.</p>
      </header>
      <div
        className="pulso-comparativos-rotulos"
        data-qa-geometry-group="comparativos-rotulos"
        data-qa-geometry-contract="equal"
      >
        {periodos.map((base) => (
          <label key={base} className="pulso-comparativos-rotulo" data-qa-geometry-member>
            <span className="pulso-comparativos-rotulo-base" title={base}>{base}</span>
            <input
              type="text"
              value={ui.rotulos[base] ?? ""}
              placeholder={rotuloPorDefecto(base)}
              onChange={(e) => onCambio(base, e.target.value)}
              aria-label={`Rótulo de la medición ${base}`}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function ListaDeFilas({
  id,
  titulo,
  ayuda,
  filas,
  elegidas,
  marcadas,
  marca,
  totalPeriodos,
  rotulos,
  onAlternar,
  acciones,
}: {
  id: string;
  titulo: string;
  ayuda: string;
  filas: FilaArmonizada[];
  elegidas: string[];
  /** Filas que llevan una marca informativa, sin cambiar su selección. */
  marcadas: string[];
  marca: string;
  totalPeriodos: number;
  rotulos: Record<string, string>;
  onAlternar: (clave: string) => void;
  acciones?: JSX.Element;
}) {
  return (
    <fieldset className="pulso-comparativos-bloque pulso-comparativos-lista" data-qa-geometry-member>
      <legend className="pulso-sr-only">{titulo}</legend>
      <header className="pulso-comparativos-bloque-head">
        <h3 id={`${id}-titulo`} aria-hidden="true">{titulo}</h3>
        <p>{ayuda}</p>
        {acciones}
      </header>
      <ul
        className="pulso-comparativos-filas"
        // Intrínseco: cada fila mide lo que su enunciado necesita. Igualar los
        // marcos obligaría a recortar el enunciado, que es lo que se elige.
        data-qa-geometry-group={`${id}-filas`}
        data-qa-geometry-contract="intrinsic"
      >
        {filas.map((fila) => {
          const conMarca = Boolean(marca) && marcadas.includes(fila.clave);
          const marcada = fila.seleccionable && elegidas.includes(fila.clave);
          return (
            <li key={fila.clave} data-qa-geometry-member>
              <label
                className={`pulso-comparativos-fila${marcada ? " is-on" : ""}${fila.seleccionable ? "" : " is-off"}`}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={!fila.seleccionable}
                  onChange={() => onAlternar(fila.clave)}
                />
                <span className="pulso-comparativos-fila-copy">
                  <strong>{fila.etiqueta}</strong>
                  <small>
                    {fila.seccion ? `${fila.seccion}, ` : ""}
                    {detalleCobertura(fila, totalPeriodos, rotulos)}
                  </small>
                  {!fila.seleccionable ? (
                    <span className="pulso-comparativos-fila-marca is-off">No es comparable en ninguna medición</span>
                  ) : conMarca ? (
                    <span className="pulso-comparativos-fila-marca">{marca}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function Notas({
  filas,
  ui,
  onNota,
  onGenerales,
}: {
  filas: FilaArmonizada[];
  ui: ComparativosUi;
  onNota: (clave: string, valor: string) => void;
  onGenerales: (valor: string) => void;
}) {
  const conNota = filas.filter((f) => (ui.notasPregunta[f.clave] ?? "").trim()).length
    + (ui.notasGenerales.trim() ? 1 : 0);
  return (
    <details className="pulso-comparativos-bloque pulso-comparativos-notas" data-qa-geometry-member>
      <summary>
        <span>Notas al pie</span>
        <small>{conNota ? `${conNota} con texto` : "Opcional"}</small>
      </summary>
      <div className="pulso-comparativos-notas-cuerpo">
        <label className="pulso-comparativos-campo">
          <span>Notas generales, una por línea. Salen bajo todas las tablas.</span>
          <textarea
            rows={3}
            value={ui.notasGenerales}
            onChange={(e) => onGenerales(e.target.value)}
          />
        </label>
        {filas.length ? (
          <div className="pulso-comparativos-notas-preguntas">
            {filas.map((fila) => (
              <label key={fila.clave} className="pulso-comparativos-campo">
                <span>Nota de {fila.etiqueta}</span>
                <input
                  type="text"
                  value={ui.notasPregunta[fila.clave] ?? ""}
                  onChange={(e) => onNota(fila.clave, e.target.value)}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="pulso-comparativos-nota-vacia">Elige preguntas para escribirles una nota propia.</p>
        )}
      </div>
    </details>
  );
}

function BotonGenerar({
  etiqueta,
  corriendo,
  deshabilitado,
  variante,
  onClick,
}: {
  etiqueta: string;
  corriendo: boolean;
  deshabilitado: boolean;
  variante: "pulso-primary" | "pulso-secondary";
  onClick: () => void;
}) {
  return (
    <button type="button" className={variante} disabled={deshabilitado} onClick={onClick} aria-busy={corriendo}>
      {corriendo ? <Loader2 size={14} className="pulso-spin" /> : <Play size={14} />}
      {corriendo ? "Generando…" : etiqueta}
    </button>
  );
}

function ErrorConAccion({ error }: { error: ErrorComparativo }) {
  const accion = accionParaError(error.codigo);
  return (
    <div className="pulso-comparativos-error">
      <ErrorBlock
        label="No se pudo generar el comparativo"
        detail={error.codigo ? `${error.mensaje} (${error.codigo})` : error.mensaje}
      />
      {accion ? (
        <Link className="pulso-comparativos-enlace" to={accion.href}>
          {accion.etiqueta} <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

function Resultado({ tipo, datos }: { tipo: ComparativoTipo; datos: ComparativoResultado }) {
  const manifest = datos.artifacts.find((a) => a.role === "manifest");
  return (
    <section className="pulso-comparativos-resultado" aria-labelledby="comparativos-resultado-titulo">
      <header className="pulso-comparativos-bloque-head">
        <h3 id="comparativos-resultado-titulo">
          {tipo === "cruces" ? "Comparativo de cruces generado" : "Comparativo simple generado"}
        </h3>
        <p>
          {cantidad(datos.resumen.n_preguntas, "pregunta", "preguntas")} en {cantidad(datos.periodos.length, "medición", "mediciones")}
          {datos.periodos.length ? ` (${datos.periodos.map((p) => p.rotulo).join(", ")})` : ""}
        </p>
      </header>

      <div className="pulso-comparativos-descargas">
        {datos.file_id ? (
          <a className="analitica-download-pill" href={downloadUrl(datos.file_id)} download={datos.filename}>
            <Download size={12} /> {datos.filename}
            {datos.size ? <small>{formatoBytes(datos.size)}</small> : null}
          </a>
        ) : null}
        {manifest ? (
          <a className="pulso-comparativos-manifest" href={downloadUrl(manifest.file_id)} download={manifest.filename}>
            <FileJson size={12} /> Manifest
          </a>
        ) : null}
      </div>

      {datos.resumen.avisos.length ? (
        <ul className="pulso-comparativos-avisos" aria-label="Avisos del comparativo">
          {datos.resumen.avisos.map((aviso, i) => (
            <AvisoFila key={`${aviso.tipoOriginal}-${i}`} aviso={aviso} />
          ))}
        </ul>
      ) : (
        <p className="pulso-comparativos-sin-avisos">El motor no reportó avisos para este comparativo.</p>
      )}

      <div className="pulso-comparativos-tabla-marco">
        <table className="pulso-comparativos-tabla">
          <caption className="pulso-sr-only">Resumen por pregunta</caption>
          <thead>
            <tr>
              <th scope="col">Pregunta</th>
              <th scope="col" title="Dónde la pregunta no es comparable">n.c.</th>
              <th scope="col" title="Casillas sin casos o sin respuesta sustantiva">n.a.</th>
              <th scope="col">Sin mapa</th>
              <th scope="col">No ofrecidas</th>
            </tr>
          </thead>
          <tbody>
            {datos.resumen.preguntas.map((p, i) => {
              const sinMapa = totalSinMapa(p);
              const especiales = p.sin_mapa.filter((s) => s.n_especial_sin_mapa > 0);
              const na = celdaNa(p, tipo, datos.periodos);
              const noOfrecidas = celdaNoOfrecidas(p, tipo, datos.periodos);
              return (
                <tr key={`${p.titulo}-${i}`}>
                  <th scope="row">
                    {p.titulo}
                    {p.n_reducidas ? (
                      <small className="pulso-comparativos-reducidas">
                        {cantidad(p.n_reducidas, "columna de cruce", "columnas de cruce")} con base reducida
                      </small>
                    ) : null}
                  </th>
                  <td><ListaCelda items={p.n_c.map((x) => rotuloDe(x, datos.periodos))} vacio="Ninguna" /></td>
                  <td><CeldaCubierta celda={na} /></td>
                  <td>
                    {sinMapa ? (
                      <ul className="pulso-comparativos-celda-lista">
                        {p.sin_mapa.filter((s) => s.n_sin_mapa > 0).map((s) => (
                          <li key={s.base}>
                            {rotuloDe(s.base, datos.periodos)}: {cantidad(s.n_sin_mapa, "caso", "casos")}
                            {s.codigos_sin_mapa.length ? ` (códigos ${s.codigos_sin_mapa.join(", ")})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : "0"}
                    {especiales.length ? (
                      <ul className="pulso-comparativos-celda-lista pulso-comparativos-especiales">
                        {especiales.map((s) => (
                          <li key={s.base}>
                            {rotuloDe(s.base, datos.periodos)}: {s.n_especial_sin_mapa} especiales fuera de la escala
                            {especialesSinMapa(s).length ? ` (${especialesSinMapa(s).join(", ")})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td><CeldaCubierta celda={noOfrecidas} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AvisoFila({ aviso }: { aviso: ComparativoAviso }) {
  const accion = accionParaAviso(aviso);
  return (
    <li>
      <AlertTriangle size={13} aria-hidden="true" />
      <span className="pulso-comparativos-aviso-tipo">{etiquetaDeAviso(aviso)}</span>
      <span className="pulso-comparativos-aviso-texto">{aviso.mensaje}</span>
      {accion ? (
        <Link className="pulso-comparativos-aviso-accion" to={accion.href}>{accion.etiqueta}</Link>
      ) : null}
    </li>
  );
}

function ListaCelda({ items, vacio }: { items: string[]; vacio: string }) {
  if (!items.length) return <>{vacio}</>;
  return (
    <ul className="pulso-comparativos-celda-lista">
      {items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
    </ul>
  );
}

/**
 * Celda que sólo dice «Ninguna» si el resumen cubre el caso. Si no lo cubre,
 * «—»: el comparativo puede tenerlas y el resumen no las reporta.
 */
function CeldaCubierta({ celda }: { celda: CeldaResumen }) {
  if (!celda.items.length) {
    return celda.cubierto ? <>Ninguna</> : <span title="El resumen no lo reporta para este comparativo">—</span>;
  }
  return (
    <>
      <ListaCelda items={celda.items} vacio="Ninguna" />
      {celda.cubierto ? null : <small className="pulso-comparativos-reducidas">Puede haber más en las variables de cruce</small>}
    </>
  );
}
