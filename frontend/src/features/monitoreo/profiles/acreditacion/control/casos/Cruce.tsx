import { useMemo } from "react";
import { Alert } from "../../../../../../components/Alert";
import type { MonitoreoInternalQueries } from "../../../../../../api/client";
import { fmt } from "../../formato";
import { useTamano } from "../../avance/graficosDeAvance";
import { COLUMNAS, conteoPor, dibujarFlujo, type EnlaceDeFlujo } from "./flujoDeCruce";
import "../../avance/avance.css";
import "./cruce.css";

/** Rótulos que el motor publica con su nombre interno de etapa. */
const ROTULO_DE_LLAVE: Record<string, string> = {
  "Llave en base": "Llave del padrón, sin respuesta",
};

function Lista({ titulo, filas }: { titulo: string; filas: Array<{ rotulo: string; casos: number }> }) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.casos));
  return (
    <section className="acr-cr-lista" aria-label={titulo}>
      <span className="acr-av-antetitulo">{titulo}</span>
      {filas.length ? (
        <ul>
          {filas.map((fila) => (
            <li key={fila.rotulo}>
              <span>{fila.rotulo}</span>
              <span className="acr-av-pista"><i style={{ width: `${(fila.casos / maximo) * 100}%` }} /></span>
              <b className="acr-av-num">{fmt(fila.casos)}</b>
            </li>
          ))}
        </ul>
      ) : <Alert kind="info">El corte no lo trae.</Alert>}
    </section>
  );
}

function Diagrama({ enlaces }: { enlaces: readonly EnlaceDeFlujo[] }) {
  const [ref, { ancho, alto }] = useTamano<HTMLDivElement>();
  const arriba = 26;
  const anchoRotulo = 190;
  const dibujo = useMemo(
    () => dibujarFlujo(enlaces, Math.max(0, ancho - anchoRotulo), Math.max(0, alto - arriba)),
    [enlaces, ancho, alto],
  );
  const paso = COLUMNAS.length > 1 ? (Math.max(0, ancho - anchoRotulo) - 12) / (COLUMNAS.length - 1) : 0;
  return (
    <div ref={ref} className="acr-cr-diagrama" role="img" aria-label={dibujo.nodos.map((nodo) => `${nodo.nombre}: ${fmt(nodo.valor)}`).join("; ")}>
      {ancho > 0 && alto > 0 ? (
        <svg width={ancho} height={alto} aria-hidden="true">
          {COLUMNAS.map((columna, indice) => (
            <text key={columna.id} className="acr-av-eje-titulo" x={indice * paso} y={12}>{columna.rotulo}</text>
          ))}
          <g transform={`translate(0, ${arriba})`}>
            {dibujo.cintas.map((cinta) => (
              <path key={cinta.clave} className={`acr-cr-cinta is-${cinta.tono}`} d={cinta.d}>
                <title>{`${cinta.origen} a ${cinta.destino}: ${fmt(cinta.valor)}`}</title>
              </path>
            ))}
            {dibujo.nodos.map((nodo) => (
              <g key={nodo.nombre}>
                <rect className={`acr-cr-nodo is-${nodo.tono}`} x={nodo.x} y={nodo.y} width={12} height={nodo.alto} rx={2} />
                <text className="acr-cr-rotulo" x={nodo.x + 18} y={nodo.y + Math.min(nodo.alto / 2, 16) + 4}>
                  <tspan className="is-nombre">{nodo.nombre}</tspan>
                  <tspan className="is-cifra" dx={6}>{fmt(nodo.valor)}</tspan>
                </text>
              </g>
            ))}
          </g>
        </svg>
      ) : null}
    </div>
  );
}

/**
 * Control › Cruce (ficha Ctl6): cómo se volvió avance cada respuesta. El
 * diagrama recorre origen, canal, plataforma y resultado con los registros del
 * corte; a la derecha, la llave usada, cómo cruzó con el padrón y la estrategia
 * de cada canal, persona por persona (`case_rollup`).
 */
export function Cruce({ consultas }: { consultas: MonitoreoInternalQueries }) {
  const enlaces = consultas.flow?.links ?? [];
  const personas = consultas.case_rollup?.length ? consultas.case_rollup : consultas.cases;
  const registros = useMemo(() => dibujarFlujo(enlaces, 1, 1).registros, [enlaces]);
  const fuera = useMemo(
    () => enlaces.filter((enlace) => enlace.source === "Fuera de base").reduce((suma, enlace) => suma + enlace.value, 0),
    [enlaces],
  );
  const llave = useMemo(() => conteoPor(personas, (caso) => {
    const rotulo = String(caso.primary_identity_label ?? "");
    return ROTULO_DE_LLAVE[rotulo] ?? rotulo;
  }), [personas]);
  const cruce = useMemo(() => conteoPor(personas.filter((caso) => String(caso.base_result ?? "").toLowerCase().startsWith("cruz")), (caso) => {
    const valor = String(caso.base_result ?? "");
    return valor === "Cruzó" ? "Cruzó por llave" : valor;
  }), [personas]);
  const estrategia = useMemo(() => conteoPor(personas, (caso) => String(caso.channel_key_strategy_label ?? "")), [personas]);

  if (!enlaces.length) {
    return (
      <div className="acr-cr is-vacio" data-vacio>
        <Alert kind="info">El corte todavía no trae el cruce del padrón con las respuestas.</Alert>
      </div>
    );
  }
  return (
    <div className="acr-cr" data-qa-geometry-group="acreditacion-control-cruce" data-qa-geometry-contract="intrinsic">
      <section className="acr-av-panel acr-cr-principal" aria-label="De la respuesta al avance">
        <header className="acr-av-panel-cabecera">
          <h3>
            De la respuesta al avance
            <span className="acr-av-tenue">
              {`${fmt(registros)} registros: ${fmt(registros - fuera)} personas del padrón y ${fmt(fuera)} ${fuera === 1 ? "respuesta" : "respuestas"} fuera de él`}
            </span>
          </h3>
        </header>
        <div className="acr-cr-cuerpo" data-qa-geometry-capacity="owned">
          <Diagrama enlaces={enlaces} />
        </div>
      </section>
      <aside className="acr-av-panel acr-cr-derecha" aria-label="Llave y estrategia">
        <div className="acr-cr-listas">
          <Lista titulo="Llave usada" filas={llave} />
          <Lista titulo="Cómo cruzó con el padrón" filas={cruce} />
          <Lista titulo="Estrategia por canal" filas={estrategia} />
        </div>
      </aside>
    </div>
  );
}
