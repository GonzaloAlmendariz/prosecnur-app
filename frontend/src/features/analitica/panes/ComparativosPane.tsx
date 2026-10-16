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
} from "../../../vendor/lucide-react";
import {
  apiAnaliticaComparativoCruces,
  type ComparativoOmitida,
  apiAnaliticaComparativoFrecuencias,
  normalizarComparativoResultado,
  type ComparativoResultado,
  type ComparativoTipo,
} from "../../../api/analitica";
import { downloadUrl } from "../../../api/core";
import { getEquivalencias, type EquivalenciasEstado } from "../../../api/equivalencias";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { CifrasPestana } from "../CifrasPestana";
import { JobProgress } from "../../../components/JobProgress";
import {
  DIRECCION_EQUIVALENCIAS,
  accionParaError,
  avisosGenerales,
  celdaSinVariable,
  detalleDeOmitida,
  direccionDeOmitida,
  omitidasDe,
  textoMotivoOmision,
  bloqueoDeGeneracion,
  comparativosReducer,
  construirBody,
  celdaNa,
  celdaNoOfrecidas,
  errorDesde,
  especialesSinMapa,
  estadoInicial,
  clavesCrucesPorDefecto,
  clavesPreguntasPorDefecto,
  filasArmonizadas,
  opcionesDeNotaComparativo,
  formatoBytes,
  motivoVacio,
  periodosDeSerie,
  preguntasEfectivas,
  cantidad,
  rotuloDe,
  rotuloPorDefecto,
  rotulosPorDefecto,
  rotulosRepetidos,
  totalSinMapa,
  type CeldaResumen,
  type ComparativosUi,
  type ErrorComparativo,
  type MotivoVacio,
} from "./comparativosModel";
import { ComparativosLista } from "./ComparativosLista";
import { ComparativosAvisos } from "./ComparativosAvisos";
import { NotasPieEditor } from "./NotasPieEditor";
import { AvisoPonderacionSerie, PonderacionDeLaSerieLinea } from "./ComparativosPonderacion";
import { usePonderacionDeLaSerie } from "../usePonderacionDeLaSerie";
import { PulsoButton } from "../../../components/PulsoButton";
import { rotuloDeMatriz } from "../../../lib/rotuloDeMatriz";
import { mayuscula, nombreDeSerie, type NombreDeSerie } from "../../carga/nombreDeSerie";
import "./ComparativosPane.css";
import "./ComparativosPonderacion.css";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "lista"; equivalencias: EquivalenciasEstado };

const COPY_VACIO: Record<MotivoVacio, { titulo: string; pista: string }> = {
  "sin-equivalencias": {
    titulo: "Aún no hay matriz de equivalencias",
    pista: "Declara en Carga, pestaña Equivalencias, qué variable es la misma pregunta en cada base y armoniza sus respuestas. Después vuelve aquí para generar el comparativo.",
  },
  "sin-armonizadas": {
    titulo: "Ninguna pregunta está armonizada",
    pista: "La matriz existe pero ninguna fila declara una escala común. Abre una fila en Carga, pestaña Equivalencias, y armonízala entre bases.",
  },
  "sin-serie": {
    titulo: "La serie tiene menos de dos bases",
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
        <EstadoVacio
          tamano="normal"
          icono={<GitCompare size={18} />}
          titulo={COPY_VACIO[motivo].titulo}
          descripcion={COPY_VACIO[motivo].pista}
          accion={(
            <Link className="pulso-comparativos-enlace" to={DIRECCION_EQUIVALENCIAS}>
              Ir a Equivalencias <ArrowRight size={14} aria-hidden="true" />
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
  const ponderacion = usePonderacionDeLaSerie(periodos);

  const ocupado = ui.enviando !== null || ui.job !== null;
  // Una sola decisión de cómo se nombra la serie, con los rótulos que vienen de
  // los datos: «años» si todos lo son, «mediciones» si no.
  const serie = nombreDeSerie(periodos.map((p) => (ui.rotulos[p] ?? "").trim() || p));

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

  const opcionesDeNota = useMemo(() => opcionesDeNotaComparativo(filas, ui.preguntas), [filas, ui.preguntas]);

  // Los segmentos de cruce del estudio no cuentan como preguntas armonizadas:
  // entran como variables de cruce, igual que en el motor (ADR 0107).
  const segmentos = useMemo(() => clavesCrucesPorDefecto(filas), [filas]);

  const bloqueoSimple = bloqueoDeGeneracion(ui, "frecuencias");
  const bloqueoCruces = bloqueoDeGeneracion(ui, "cruces");

  return (
    <div className="pulso-comparativos analitica-report-shell" data-audit-ready="analitica-comparativos">
      <Presentacion serie={serie} />

      {/* Una sola primitiva de cifras por pestaña (P-M1): las tarjetas KPI
          quedan para los homepages. */}
      <CifrasPestana
        ariaLabel="Cifras del comparativo"
        cifras={[
          { clave: "serie", etiqueta: mayuscula(serie.plural), valor: formatoConteo(periodos.length) },
          { clave: "armonizadas", etiqueta: "Preguntas armonizadas", valor: formatoConteo(filas.filter((f) => !f.esSegmento).length) },
          { clave: "elegidas", etiqueta: "Preguntas elegidas", valor: formatoConteo(preguntasEfectivas(ui, "frecuencias").length) },
          { clave: "cruce", etiqueta: "Variables de cruce", valor: formatoConteo(ui.cruces.length) },
        ]}
      />

      {/* Cómo pondera cada base: el comparativo aplica la declarada de cada una. */}
      <PonderacionDeLaSerieLinea lectura={ponderacion} />

      <div
        className="pulso-comparativos-secciones"
        data-qa-geometry-group="comparativos-secciones"
        data-qa-geometry-contract="intrinsic"
      >
        <RotulosPeriodos periodos={periodos} ui={ui} serie={serie} onCambio={(base, valor) => dispatch({ tipo: "rotulo", base, valor })} />

        <ComparativosLista
          id="comparativos-preguntas"
          titulo="Preguntas del comparativo"
          ayuda={`Cada pregunta elegida sale como una tabla con una columna por ${serie.singular}. En el comparativo de cruces se omiten las que también son variable de cruce.`}
          filas={filas}
          elegidas={ui.preguntas}
          marcadas={ui.cruces}
          marca="También es variable de cruce"
          periodos={periodos}
          rotulos={ui.rotulos}
          serie={serie}
          onAlternar={(clave) => dispatch({ tipo: "alternar-pregunta", clave })}
          onElegirVarias={(claves, valor) => dispatch({ tipo: "elegir-preguntas", claves, valor })}
          acciones={(
            <div className="pulso-comparativos-lista-acciones">
              <PulsoButton variant="ghost" size="sm" onClick={() => dispatch({ tipo: "todas-las-preguntas", claves: clavesPreguntasPorDefecto(filas) })}>
                Todas
              </PulsoButton>
              <PulsoButton variant="ghost" size="sm" onClick={() => dispatch({ tipo: "ninguna-pregunta" })}>
                Ninguna
              </PulsoButton>
            </div>
          )}
        />

        <ComparativosLista
          id="comparativos-cruces"
          titulo="Variables de cruce"
          ayuda="Sólo para el comparativo de cruces. Cada pregunta se abre por las respuestas de la variable de cruce, y esa variable no se tabula como pregunta en ese archivo. Los segmentos de cruce del estudio vienen elegidos."
          filas={filas}
          elegidas={ui.cruces}
          marcadas={segmentos}
          marca="Segmento de cruce del estudio"
          periodos={periodos}
          rotulos={ui.rotulos}
          serie={serie}
          onAlternar={(clave) => dispatch({ tipo: "alternar-cruce", clave })}
        />

        <NotasPieEditor
          variante="comparativo"
          preguntas={opcionesDeNota}
          notasPregunta={ui.notasPregunta}
          notasGenerales={ui.notasGenerales}
          onNota={(clave, valor) => dispatch({ tipo: "nota-pregunta", clave, valor })}
          onGenerales={(valor) => dispatch({ tipo: "notas-generales", valor })}
        />
      </div>

      <div className="pulso-comparativos-generar">
        <AvisoPonderacionSerie lectura={ponderacion} />
        <div className="pulso-comparativos-botones">
          <BotonGenerar
            etiqueta="Generar comparativo simple"
            corriendo={ui.enviando === "frecuencias" || ui.job?.tipo === "frecuencias"}
            deshabilitado={ocupado || bloqueoSimple !== null}
            variante="primary"
            onClick={() => { void generar("frecuencias"); }}
          />
          <BotonGenerar
            etiqueta="Generar comparativo de cruces"
            corriendo={ui.enviando === "cruces" || ui.job?.tipo === "cruces"}
            deshabilitado={ocupado || bloqueoCruces !== null}
            variante="secondary"
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

/**
 * Qué produce la pestaña y qué entra en ella. Sin esto, «Comparativos» y
 * «Preguntas armonizadas» no decían qué es armonizar ni por qué falta una
 * pregunta que sí está en la matriz.
 */
function Presentacion({ serie }: { serie: NombreDeSerie }) {
  return (
    <section className="pulso-comparativos-presentacion" aria-labelledby="comparativos-presentacion-titulo">
      <GitCompare size={18} aria-hidden="true" />
      <div>
        <h2 id="comparativos-presentacion-titulo">Comparar una pregunta entre {serie.plural}</h2>
        <p>
          Un comparativo pone cada pregunta lado a lado en {serie.todas}, con una columna por {serie.singular},
          y se descarga como Excel. El simple da la frecuencia de cada respuesta. El de cruces la abre además
          por una variable de cruce.
        </p>
        <p>
          Solo entran las preguntas armonizadas, es decir, las que tienen sus respuestas puestas en una misma
          escala en todas las bases. Si falta una, armonízala en Equivalencias.
        </p>
      </div>
      <Link className="pulso-comparativos-enlace" to={DIRECCION_EQUIVALENCIAS}>
        Ir a Equivalencias <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
}

function RotulosPeriodos({
  periodos,
  ui,
  serie,
  onCambio,
}: {
  periodos: string[];
  ui: ComparativosUi;
  serie: NombreDeSerie;
  onCambio: (base: string, valor: string) => void;
}) {
  const porDefecto = rotulosPorDefecto(periodos);
  const repetidos = rotulosRepetidos(ui.rotulos, periodos);
  return (
    <section className="pulso-comparativos-bloque" aria-labelledby="comparativos-rotulos-titulo" data-qa-geometry-member>
      <header className="pulso-comparativos-bloque-head">
        <h3 id="comparativos-rotulos-titulo">Rótulos de {serie.articulo} {serie.plural}</h3>
        <p>
          Así se titula cada columna del comparativo, en el orden de la serie. Si el nombre de la base
          trae un año, se propone el año. Si no, se propone el nombre de la base.
        </p>
      </header>
      <ol
        className="pulso-comparativos-rotulos"
        data-qa-geometry-group="comparativos-rotulos"
        data-qa-geometry-contract="equal"
      >
        {periodos.map((base, i) => {
          // El nombre de la base solo se repite encima si dice algo distinto
          // de lo que ya muestra el campo (P-B3): con bases nombradas, el
          // rótulo propuesto ES el nombre y salía dos veces.
          const propuesto = porDefecto[base] ?? rotuloPorDefecto(base);
          const valor = (ui.rotulos[base] ?? "").trim() || propuesto;
          const mostrarBase = valor !== base;
          return (
          <li key={base} data-qa-geometry-member>
            <label className="pulso-comparativos-rotulo">
              <span className="pulso-comparativos-rotulo-base" title={base}>
                <span className="pulso-comparativos-rotulo-pos" aria-hidden="true">{i + 1}</span>
                {mostrarBase ? base : null}
              </span>
              <input
                type="text"
                value={ui.rotulos[base] ?? ""}
                placeholder={propuesto}
                onChange={(e) => onCambio(base, e.target.value)}
                aria-label={`Rótulo de la columna ${i + 1}, base ${base}`}
              />
            </label>
          </li>
          );
        })}
      </ol>
      {repetidos.length ? (
        <p className="pulso-comparativos-rotulos-aviso" role="status">
          <AlertTriangle size={13} aria-hidden="true" />
          {repetidos.length === 1
            ? `«${repetidos[0]}» titula a más de una columna. Cambia uno de los rótulos para que las columnas se distingan.`
            : `${repetidos.map((r) => `«${r}»`).join(", ")} titulan a más de una columna. Cambia los rótulos para que las columnas se distingan.`}
        </p>
      ) : null}
    </section>
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
  variante: "primary" | "secondary";
  onClick: () => void;
}) {
  return (
    <PulsoButton variant={variante} size="lg" disabled={deshabilitado} onClick={onClick} aria-busy={corriendo}>
      {corriendo ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      {corriendo ? "Generando…" : etiqueta}
    </PulsoButton>
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
          {cantidad(datos.resumen.n_preguntas, "pregunta", "preguntas")} en {cantidad(datos.periodos.length, nombreDeSerie(datos.periodos.map((p) => p.rotulo)).singular, nombreDeSerie(datos.periodos.map((p) => p.rotulo)).plural)}
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

      <PreguntasOmitidas omitidas={omitidasDe(datos.resumen)} periodos={datos.periodos} />

      <ComparativosAvisos avisos={avisosGenerales(datos.resumen.avisos)} />

      <div className="pulso-comparativos-tabla-marco">
        <table className="pulso-comparativos-tabla">
          <caption className="pulso-sr-only">Resumen por pregunta</caption>
          <thead>
            <tr>
              <th scope="col">Pregunta</th>
              <th scope="col" title="Dónde la pregunta no es comparable">n.c.</th>
              <th scope="col" title="Casillas sin casos o sin respuesta sustantiva">n.a.</th>
              <th scope="col" title="Mediciones donde la pregunta no tiene variable. Salen como n.c.">Sin variable</th>
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
                  <td><ListaCelda items={p.n_c.map((x) => rotuloDe(x, datos.periodos))} /></td>
                  <td><CeldaCubierta celda={na} /></td>
                  <td><ListaCelda items={celdaSinVariable(p, datos.periodos)} /></td>
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
                    ) : <CeldaNada />}
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

/**
 * Lo que quedó fuera del comparativo y por qué. Va destacado y antes de los
 * demás avisos: una pregunta omitida no es una nota al margen, es una tabla que
 * el usuario esperaba y no está en el archivo.
 */
function PreguntasOmitidas({
  omitidas,
  periodos,
}: {
  omitidas: ComparativoOmitida[];
  periodos: ComparativoResultado["periodos"];
}) {
  if (!omitidas.length) return null;
  return (
    <section className="pulso-comparativos-omitidas" aria-labelledby="comparativos-omitidas-titulo">
      <header>
        <AlertTriangle size={15} aria-hidden="true" />
        <h4 id="comparativos-omitidas-titulo">
          {omitidas.length === 1 ? "1 fila quedó fuera del comparativo" : `${omitidas.length} filas quedaron fuera del comparativo`}
        </h4>
        <p>
          {omitidas.length === 1
            ? "No tiene tabla en el archivo. El libro la lista en la hoja «Preguntas omitidas»."
            : "No tienen tabla en el archivo. El libro las lista en la hoja «Preguntas omitidas»."}
        </p>
      </header>
      <ul
        className="pulso-comparativos-omitidas-lista"
        // Intrínseco: cada omisión mide lo que su detalle necesita.
        data-qa-geometry-group="comparativos-omitidas"
        data-qa-geometry-contract="intrinsic"
      >
        {omitidas.map((o, i) => (
          <li key={`${o.fila}-${o.base}-${i}`} data-qa-geometry-member>
            <div className="pulso-comparativos-omitida-cabeza">
              <strong>{rotuloDeMatriz(o.titulo)}</strong>
              <span className="pulso-comparativos-omitida-tipo">
                {o.tipo === "cruce" ? "Variable de cruce" : "Pregunta"}
              </span>
            </div>
            <p className="pulso-comparativos-omitida-motivo">
              {textoMotivoOmision(o.motivo, o.ausentes)}
              {o.base ? `. Base afectada: ${rotuloDe(o.base, periodos)}.` : "."}
            </p>
            {/* Un solo párrafo de detalle: el del motor ya nombra los códigos
                cuando los hay, y repetirlos aparte decía lo mismo dos veces. */}
            {detalleDeOmitida(o, periodos) ? (
              <p className="pulso-comparativos-omitida-detalle">{detalleDeOmitida(o, periodos)}</p>
            ) : null}
            <Link className="pulso-comparativos-aviso-accion" to={direccionDeOmitida(o)}>
              Revisar en Equivalencias
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Celda sin nada que listar: «—» atenuado, el mismo que usa Equivalencias
 * (P-B4). Antes se repetía «Ninguna» en todas las filas y «0» en Sin mapa.
 * El lector de pantalla oye «Ninguna».
 */
function CeldaNada() {
  return (
    <span className="pulso-comparativos-nada">
      <span aria-hidden="true">—</span>
      <span className="pulso-sr-only">Ninguna</span>
    </span>
  );
}

function ListaCelda({ items }: { items: string[] }) {
  if (!items.length) return <CeldaNada />;
  return (
    <ul className="pulso-comparativos-celda-lista">
      {items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
    </ul>
  );
}

/**
 * Celda que sólo dice «ninguna» («—») si el resumen cubre el caso. Si no lo
 * cubre lo dice con palabras: el comparativo puede tenerlas y el resumen no
 * las reporta, y eso no es lo mismo que «ninguna».
 */
function CeldaCubierta({ celda }: { celda: CeldaResumen }) {
  if (!celda.items.length) {
    return celda.cubierto
      ? <CeldaNada />
      : <span className="pulso-comparativos-nada" title="El resumen no lo reporta para este comparativo">sin dato</span>;
  }
  return (
    <>
      <ListaCelda items={celda.items} />
      {celda.cubierto ? null : <small className="pulso-comparativos-reducidas">Puede haber más en las variables de cruce</small>}
    </>
  );
}
