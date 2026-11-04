import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import type { DistritoRevision, RevisionMarco } from "../../seleccion/revisionMarco";
import "./evidenciaRevision.css";

/**
 * P8 de la paridad con la página clásica: la evidencia de la Revisión contra el marco. La lista del
 * inspector dice qué hacer; la tira de viviendas (escala logarítmica, titular arriba, reemplazo abajo)
 * muestra por qué, y la tabla por distrito dice dónde se concentra. Rescatado de
 * `seleccion/RevisionContraMarco.tsx` (2c641554b^).
 */

const formato = (n: number) => n.toLocaleString("es-PE");

const COLUMNAS_DISTRITO: readonly PulsoTableColumna<DistritoRevision>[] = [
  { id: "distrito", encabezado: "Distrito", ancho: 96, celda: (d) => d.distrito, valor: (d) => d.distrito },
  { id: "titulares", encabezado: "UMP", ancho: 42, tipo: "cifra", celda: (d) => formato(d.titulares), valor: (d) => d.titulares },
  { id: "reemplazos", encabezado: "R", ancho: 34, tipo: "cifra", celda: (d) => formato(d.reemplazos), valor: (d) => d.reemplazos },
  {
    id: "revision",
    encabezado: "Revisión",
    ancho: 104,
    celda: (d) => (
      <span className="hr-revision-estado" data-tono={d.errores ? "error" : d.observaciones ? "aviso" : "ok"}>
        {d.errores ? `${formato(d.errores)} a corregir` : d.observaciones ? `${formato(d.observaciones)} a revisar` : "Sin obs."}
      </span>
    ),
    valor: (d) => d.errores * 1000 + d.observaciones,
  },
];

/** Posición en una escala logarítmica de 0 a ~1.000 viviendas, en %. */
export function posicionLog(viviendas: number, maximo: number): number {
  return (Math.log10(viviendas + 1) / Math.log10(Math.max(maximo, 1000) + 1)) * 100;
}

function TiraDeViviendas({ revision }: { revision: RevisionMarco }) {
  const maximo = Math.max(1000, ...revision.viviendasTitulares, ...revision.viviendasReemplazos);
  const referencia = revision.entrevistasPorRuta;
  const marcas = [0, 10, 100, 1000].filter((v) => v <= maximo);
  return (
    <figure className="hr-revision-tira" aria-label="Viviendas por manzana elegida, en escala logarítmica">
      <figcaption>Viviendas por manzana elegida, escala logarítmica</figcaption>
      <div className="hr-revision-tira-rejilla">
        <span />
        <div className="hr-revision-tira-pista is-referencia">
          {referencia > 0 ? (
            <span className="hr-revision-tira-ref-texto" style={{ left: `${posicionLog(referencia, maximo)}%` }}>
              {formato(referencia)} entrevistas por ruta
            </span>
          ) : null}
        </div>
        <span className="hr-revision-tira-rotulo">Titular</span>
        <div className="hr-revision-tira-pista">
          {referencia > 0 ? <span className="hr-revision-tira-ref" style={{ left: `${posicionLog(referencia, maximo)}%` }} /> : null}
          {revision.viviendasTitulares.map((v, i) => (
            <span key={`t${i}`} className="hr-revision-tira-punto is-titular" style={{ left: `${posicionLog(v, maximo)}%` }} title={`${formato(v)} viviendas`} />
          ))}
        </div>
        <span className="hr-revision-tira-rotulo">Reemplazo</span>
        <div className="hr-revision-tira-pista">
          {referencia > 0 ? <span className="hr-revision-tira-ref" style={{ left: `${posicionLog(referencia, maximo)}%` }} /> : null}
          {revision.viviendasReemplazos.map((v, i) => (
            <span
              key={`r${i}`}
              className={`hr-revision-tira-punto ${v < referencia ? "is-corto" : "is-reemplazo"}`}
              style={{ left: `${posicionLog(v, maximo)}%` }}
              title={`${formato(v)} viviendas`}
            />
          ))}
        </div>
        <span />
        <div className="hr-revision-tira-eje">
          {marcas.map((v) => (
            <span key={v} style={{ left: `${posicionLog(v, maximo)}%` }} data-extremo={v === 0 ? "inicio" : v === 1000 ? "fin" : undefined}>
              {formato(v)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function EvidenciaRevision({ revision }: { revision: RevisionMarco }) {
  if (!revision.viviendasTitulares.length) return null;
  return (
    <details className="hr-revision-evidencia-plegable">
      <summary>Evidencia: viviendas por manzana y revisión por distrito</summary>
      <TiraDeViviendas revision={revision} />
      <PulsoTable ariaLabel="Revisión por distrito" densidad="compacta" columnas={COLUMNAS_DISTRITO} filas={revision.distritos} idDeFila={(d) => d.distrito} />
    </details>
  );
}
