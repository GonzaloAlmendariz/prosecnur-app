import { useState } from "react";
import type { HojasRutaDeliveryTab } from "../store";
import type { GrupoRevision, RevisionMarco, TonoRevision } from "./revisionMarco";
import "./revisionMarco.css";

// Selección › Revisión: lo que conviene mirar antes de imprimir, con las
// viviendas censales de cada manzana. La lista manda (qué hacer), la tira de
// viviendas es la evidencia y la tabla por distrito dice dónde se concentra.

const ETIQUETA_TONO: Record<TonoRevision, string> = { error: "A corregir", aviso: "A revisar", info: "Para saber" };
const VISIBLES = 6;

const formato = (n: number) => n.toLocaleString("es-PE");

function GrupoObservado({ grupo, onVer }: { grupo: GrupoRevision; onVer: (tab: HojasRutaDeliveryTab) => void }) {
  const [todas, setTodas] = useState(false);
  const umps = todas ? grupo.umps : grupo.umps.slice(0, VISIBLES);
  const deReemplazo = grupo.tipo.startsWith("reemplazo");
  return (
    <article className="hr-revision-grupo" data-tono={grupo.tono}>
      <span className="hr-revision-punto" aria-hidden="true">{grupo.tono === "info" ? "i" : "!"}</span>
      <div className="hr-revision-grupo-copia">
        <span className="hr-revision-tono">{ETIQUETA_TONO[grupo.tono]}</span>
        <strong>{grupo.titulo}</strong>
        <p>{grupo.detalle}</p>
        <ul className="hr-revision-umps">
          {umps.map((u) => (
            <li key={u.idManzana}>
              <span className="hr-revision-ump">{u.distrito} · {u.codigo}{u.titular ? ` de ${u.titular}` : ""}</span>
              <code>{u.idManzana}</code>
              <span className="hr-revision-cifra">{formato(u.viviendas)} viv. · {formato(u.entrevistas)} ent.</span>
            </li>
          ))}
        </ul>
        <div className="hr-revision-acciones">
          {grupo.umps.length > VISIBLES ? (
            <button type="button" onClick={() => setTodas((v) => !v)}>
              {todas ? "Ver menos" : `Ver las ${formato(grupo.umps.length)}`}
            </button>
          ) : null}
          <button type="button" onClick={() => onVer(deReemplazo ? "reemplazos" : "titulares")}>
            {deReemplazo ? "Abrir Reemplazos" : "Abrir Titulares"}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Posición en una escala logarítmica de 0 a ~1.000 viviendas, en %. */
function posicion(viviendas: number, maximo: number): number {
  return (Math.log10(viviendas + 1) / Math.log10(Math.max(maximo, 1000) + 1)) * 100;
}

function TiraDeViviendas({ revision }: { revision: RevisionMarco }) {
  const maximo = Math.max(1000, ...revision.viviendasTitulares, ...revision.viviendasReemplazos);
  const referencia = revision.entrevistasPorRuta;
  const marcas = [0, 10, 100, 1000].filter((v) => v <= maximo);
  return (
    <figure className="hr-revision-tira" aria-label="Viviendas por manzana elegida, en escala logarítmica">
      <figcaption>Viviendas por manzana elegida · escala logarítmica</figcaption>
      <div className="hr-revision-tira-rejilla">
        <span />
        <div className="hr-revision-tira-pista is-referencia">
          {referencia > 0 ? (
            <span className="hr-revision-tira-ref-texto" style={{ left: `${posicion(referencia, maximo)}%` }}>
              {formato(referencia)} entrevistas por ruta
            </span>
          ) : null}
        </div>
        <span className="hr-revision-tira-rotulo">Titular</span>
        <div className="hr-revision-tira-pista">
          {referencia > 0 ? <span className="hr-revision-tira-ref" style={{ left: `${posicion(referencia, maximo)}%` }} /> : null}
          {revision.viviendasTitulares.map((v, i) => (
            <span key={`t${i}`} className="hr-revision-tira-punto is-titular" style={{ left: `${posicion(v, maximo)}%` }} title={`${formato(v)} viviendas`} />
          ))}
        </div>
        <span className="hr-revision-tira-rotulo">Reemplazo</span>
        <div className="hr-revision-tira-pista">
          {referencia > 0 ? <span className="hr-revision-tira-ref" style={{ left: `${posicion(referencia, maximo)}%` }} /> : null}
          {revision.viviendasReemplazos.map((v, i) => (
            <span
              key={`r${i}`}
              className={`hr-revision-tira-punto ${v < referencia ? "is-corto" : "is-reemplazo"}`}
              style={{ left: `${posicion(v, maximo)}%` }}
              title={`${formato(v)} viviendas`}
            />
          ))}
        </div>
        <span />
        <div className="hr-revision-tira-eje">
          {marcas.map((v) => (
            <span key={v} style={{ left: `${posicion(v, maximo)}%` }} data-extremo={v === 0 ? "inicio" : v === 1000 ? "fin" : undefined}>
              {formato(v)}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function RevisionContraMarco({
  revision,
  onVer,
}: {
  revision: RevisionMarco;
  onVer: (tab: HojasRutaDeliveryTab) => void;
}) {
  return (
    <section className="hojas-ruta-delivery-section hr-revision" aria-label="Revisión contra el marco">
      <div className="hr-revision-lista">
        {revision.grupos.length ? (
          revision.grupos.map((grupo) => <GrupoObservado key={grupo.tipo} grupo={grupo} onVer={onVer} />)
        ) : (
          <div className="hr-revision-vacio" role="status">
            <strong>Sin observaciones</strong>
            <span>Todas las manzanas elegidas tienen viviendas suficientes para sus entrevistas y cada titular tiene su reemplazo.</span>
          </div>
        )}
      </div>
      <aside className="hr-revision-evidencia" aria-label="Evidencia">
        <TiraDeViviendas revision={revision} />
        <table className="hr-revision-distritos">
          <thead>
            <tr><th>Distrito</th><th data-tipo="cifra">UMP</th><th data-tipo="cifra">R</th><th>Revisión</th></tr>
          </thead>
          <tbody>
            {revision.distritos.map((d) => (
              <tr key={d.distrito}>
                <td>{d.distrito}</td>
                <td data-tipo="cifra">{formato(d.titulares)}</td>
                <td data-tipo="cifra">{formato(d.reemplazos)}</td>
                <td>
                  <span className="hr-revision-estado" data-tono={d.errores ? "error" : d.observaciones ? "aviso" : "ok"}>
                    {d.errores ? `${formato(d.errores)} a corregir` : d.observaciones ? `${formato(d.observaciones)} a revisar` : "Sin observaciones"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
    </section>
  );
}
