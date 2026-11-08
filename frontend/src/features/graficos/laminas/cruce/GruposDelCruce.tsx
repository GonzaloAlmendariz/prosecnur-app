// Los grupos de «Dividir por» con su n (oleada I2, ítem 7): una ficha por grupo, leída del detalle del motor (la base
// exacta de cada barra). Los de menos de 30 casos llevan «pocos casos»; si el gráfico admite excluir grupos, un clic en
// esa ficha lo manda a «Excluir grupos». Sin detalle (o sin una barra por grupo), no pinta nada. R7-16: se manda el
// RÓTULO del grupo que se ve (el del detalle), nunca el código de la lista original: con un recodificado que renumera
// (`<var>_recod`) ese código excluía otro grupo. El motor casa rótulos sin mayúsculas ni tildes y avisa si es ambiguo.
//
// Superficie intrínseca (C1): las fichas envuelven; el vacío es del control (no se dibuja).

import { AlertTriangle } from "../../../../vendor/lucide-react";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { CifraEstado } from "../cifrasInspector/CifraEstado";
import { useDetalleCifras } from "../cifrasInspector/useDetalleCifras";
import { gruposDe, POCOS_CASOS } from "./modeloGrupos";
import "./gruposDelCruce.css";

type Props = {
  graficador: string;
  scope: "active" | "consolidated";
  args: Readonly<Record<string, unknown>>;
  /** Excluye el grupo por su rótulo (el que se ve); sin ella las fichas sólo informan. */
  onExcluir?: (rotulo: string) => void;
};

export function GruposDelCruce({ graficador, scope, args, onExcluir }: Props) {
  const det = useDetalleCifras(graficador, scope, [{ clave: "actual", args }]).actual;
  const grupos = gruposDe(det?.detalle ?? null);
  if (!grupos.length) return det && !det.vigente && !det.detalle ? <CifraEstado texto={null} vigente={false} qa="grupos-cruce-carga" /> : null;
  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-grupos" data-qa="grupos-cruce"
      data-qa-geometry-group="graficos/f6-grupos" data-qa-geometry-contract="intrinsic">
      <div className={`pulso-f6-cats${det?.vigente ? "" : " is-anterior"}`} role="group" aria-label="Grupos del cruce">
        {grupos.map((g) => {
          const n = g.n === null ? null : `n=${formatoConteo(g.n)}`;
          const rotulo = g.pocos && onExcluir ? (g.rotulo || g.clave) : null;
          const contenido = (
            <>
              <span className="pulso-f6-cat-texto">{g.rotulo}</span>
              {n && <span className="pulso-f6-cat-n">{n}</span>}
              {g.pocos && <span className="pulso-f6-grupos-pocos"><AlertTriangle size={12} aria-hidden="true" />pocos casos</span>}
            </>
          );
          return rotulo && onExcluir ? (
            <button key={g.clave} type="button" className="pulso-f6-cat is-pocos" data-qa="grupo-pocos"
              title={`Menos de ${POCOS_CASOS} casos. Excluir el grupo`} aria-label={`${g.rotulo}, ${n ?? ""}, pocos casos. Excluir el grupo`}
              onClick={() => onExcluir(rotulo)}>{contenido}</button>
          ) : (
            <span key={g.clave} className={`pulso-f6-cat is-estatico${g.pocos ? " is-pocos" : ""}`}
              title={g.pocos ? `Menos de ${POCOS_CASOS} casos` : undefined}>{contenido}</span>
          );
        })}
      </div>
    </div>
  );
}
