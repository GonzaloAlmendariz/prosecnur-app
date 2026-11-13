// "Entregables de la base" (prototipo, Analítica › Entrega): los entregables
// numerados en tres grupos, con sus formatos y su estado cuando el motor lo
// publica. Los de Base de datos y Documentación se abren aquí (`?foco=`); las
// tablas se arman en su pestaña y la fila lleva allá.

import { Link, useLocation } from "react-router-dom";

import { EstadoChip } from "../../../components/EstadoChip";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { conNivel } from "../../../lib/navegacion/direccion";
import { ArrowRight, Package } from "../../../vendor/lucide-react";
import {
  NOMBRE_DEL_GRUPO,
  gruposDeEntrega,
  rotuloDeEstado,
  type Entregable,
  type EntregableId,
  type EstadoDeEntregable,
} from "./modeloDeEntrega";

function Estado({ estado }: { estado: EstadoDeEntregable }) {
  const rotulo = rotuloDeEstado(estado);
  if (rotulo === null) return null;
  return <EstadoChip label={rotulo} tone={estado === "generado" ? "success" : "neutral"} />;
}

export function ListaDeEntregables({ entregables, elegido, estadoDe, causaDe, onElegir }: {
  entregables: readonly Entregable[];
  elegido: EntregableId;
  estadoDe: (id: EntregableId) => EstadoDeEntregable;
  causaDe: (id: EntregableId) => string | null;
  onElegir: (id: EntregableId) => void;
}) {
  const location = useLocation();
  const grupos = gruposDeEntrega(entregables);
  let n = 0;
  return (
    <PanelDeMesa
      zona="entregables"
      titulo="Entregables de la base"
      icono={<Package size={16} aria-hidden="true" />}
      conteo={entregables.length}
    >
      <div className="entrega-lista" data-qa-geometry-group="analitica/entrega-lista" data-qa-geometry-contract="intrinsic">
        {grupos.map((g) => (
          <section key={g.grupo} className="entrega-grupo" aria-label={NOMBRE_DEL_GRUPO[g.grupo]}>
            <h3 className="entrega-grupo-titulo">{NOMBRE_DEL_GRUPO[g.grupo]}</h3>
            <ol className="entrega-filas" start={n + 1}>
              {g.entregables.map((e) => {
                n += 1;
                const causa = causaDe(e.id);
                const contenido = (
                  <>
                    <i className="entrega-numero" aria-hidden="true">{n}</i>
                    <span className="entrega-texto">
                      <b>{e.nombre}</b>
                      <span>{e.formatos}</span>
                      {causa ? <span className="entrega-causa">{causa}</span> : null}
                    </span>
                    <span className="entrega-estado">
                      <Estado estado={estadoDe(e.id)} />
                      {e.pestana ? <ArrowRight size={14} aria-hidden="true" className="entrega-ir" /> : null}
                    </span>
                  </>
                );
                return (
                  <li key={e.id}>
                    {e.pestana ? (
                      <Link
                        className="entrega-fila"
                        to={{
                          pathname: location.pathname,
                          search: conNivel(conNivel(conNivel(location.search, "pestana", e.pestana), "foco", null), "panel", null),
                        }}
                        title={`Se arma y se genera en la pestaña ${e.nombre}`}
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="entrega-fila"
                        aria-current={e.id === elegido ? "true" : undefined}
                        onClick={() => onElegir(e.id)}
                      >
                        {contenido}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </PanelDeMesa>
  );
}
