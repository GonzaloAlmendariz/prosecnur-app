/**
 * "Decisiones aplicadas" de Cierre (prototipo `validacion-cierre`, `pp-dec`):
 * una tabla con filas de grupo, primero los casos excluidos, después los
 * valores cambiados, las que no cambiaron nada y las que no se aplicaron. Cada
 * fila es el hallazgo con su motivo, su clase, el tratamiento y su cifra; el
 * nombre lleva al hallazgo en Hallazgos (`foco`). "Ver el registro completo"
 * abre el panel `registro`.
 *
 * Tabla con roles (no `<table>`, contrato `tablasDelKit`). C1: la tabla se
 * declara `intrinsic` (la cabecera de 38, los grupos y las filas no son pares).
 */
import { Fragment, type ReactNode } from "react";
import { History } from "../../../vendor/lucide-react";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { rotuloDeClase } from "../hallazgos/modeloHallazgos";
import type { GrupoDeDecisiones } from "./modeloCierre";

export function DecisionesAplicadas({
  titulo,
  grupos,
  conteo,
  aviso,
  vacio,
  ocupado,
  onVerRegistro,
  onAbrirHallazgo,
}: {
  titulo: string;
  grupos: readonly GrupoDeDecisiones[];
  conteo: number | undefined;
  /** Por qué las cifras por decisión no cuadran con la cadena. */
  aviso: string | null;
  /** El vacío del contenedor cuando no hay grupos. */
  vacio: ReactNode;
  ocupado: boolean;
  onVerRegistro: () => void;
  onAbrirHallazgo: (sourceId: string) => void;
}) {
  const filas = grupos.reduce((t, g) => t + g.filas.length + 1, 0);
  return (
    <PanelDeMesa
      zona="decisiones"
      titulo={titulo}
      conteo={conteo}
      ocupado={ocupado}
      acciones={(
        <PulsoButton variant="secondary" size="sm" onClick={onVerRegistro}>
          <History size={14} aria-hidden="true" />
          Ver el registro completo
        </PulsoButton>
      )}
    >
      {grupos.length === 0 ? vacio : (
        <>
          {aviso ? <p className="pulso-ci-nota" data-tono="aviso">{aviso}</p> : null}
          <div
            className="pulso-ci-tabla"
            role="table"
            aria-label={titulo}
            aria-rowcount={filas + 1}
            data-qa-geometry-group="validacion/cierre-decisiones"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="pulso-ci-fila pulso-ci-cabecera" role="row">
              <span role="columnheader">Hallazgo y motivo</span>
              <span role="columnheader">Clase</span>
              <span role="columnheader">Tratamiento</span>
              <span role="columnheader" data-tipo="cifra">Cantidad</span>
            </div>
            {grupos.map((g) => (
              <Fragment key={g.efecto}>
                <div className="pulso-ci-fila pulso-ci-grupo" role="row" data-efecto={g.efecto}>
                  <span role="cell" className="pulso-ci-grupo-celda">
                    <b>{g.titulo}</b>
                    {g.resumen ? <span>{g.resumen}</span> : null}
                  </span>
                </div>
                {g.filas.map((f) => (
                  <div key={f.id} className="pulso-ci-fila" role="row">
                    <span role="cell" className="pulso-ci-hallazgo">
                      {f.enCola ? (
                        <button type="button" className="pulso-ci-nombre" onClick={() => onAbrirHallazgo(f.sourceId)}>
                          {f.hallazgo}
                        </button>
                      ) : (
                        <b className="pulso-ci-nombre">{f.hallazgo}</b>
                      )}
                      {f.motivo ? <small>{f.motivo}</small> : null}
                      {f.nota ? <small data-tono="aviso">{f.nota}</small> : null}
                    </span>
                    <span role="cell">
                      {f.clase ? (
                        <span className="pulso-ci-etiqueta" data-clase={f.clase === "caso_a_revisar" ? "revisar" : "inconsistencia"}>
                          {rotuloDeClase(f.clase)}
                        </span>
                      ) : null}
                    </span>
                    <span role="cell">{f.tratamiento}</span>
                    <span role="cell" data-tipo="cifra">{f.cifra === null ? "" : formatoConteo(f.cifra)}</span>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </PanelDeMesa>
  );
}
