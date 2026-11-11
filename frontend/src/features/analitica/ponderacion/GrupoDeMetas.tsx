// Una variable dentro de la tabla de metas: su fila de título, con las acciones
// de la variable, y una fila por categoría. En modo `ajuste` cada categoría
// muestra la muestra, la meta que se teclea y el resultado ponderado; en modo
// `estrato`, solo la población del estrato.

import type { PonderMarginCompare, ValorColumna } from "../../../api/analitica";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { SIN_CIFRA } from "../../../lib/formatoNumero";
import { Landmark, X } from "../../../vendor/lucide-react";
import { BarrasMuestraMeta } from "./BarrasMuestraMeta";
import { codigoVisible } from "./etiquetasDeCategorias";
import {
  comparacionDe, conMeta, escalaDeBarras, metasDesdeLaMuestra, metasEnConteos, metasIguales, porcentaje,
  type MetasPorCategoria,
} from "./metasModelo";

export type GrupoDeMetasProps = {
  modo: "ajuste" | "estrato";
  variable: string;
  etiqueta: string;
  /** `null` mientras se leen las categorías de la variable; `"error"` si la lectura falló. */
  categorias: readonly ValorColumna[] | null | "error";
  metas: MetasPorCategoria;
  /** De dónde vienen las metas cuando no se teclearon. */
  fuente?: string | null;
  /** Lo que el motor devuelve por categoría para esta variable. */
  comparacion?: readonly PonderMarginCompare[];
  onMetas: (metas: MetasPorCategoria) => void;
  onQuitar: () => void;
};

export function GrupoDeMetas({
  modo, variable, etiqueta, categorias: lectura, metas, fuente, comparacion, onMetas, onQuitar,
}: GrupoDeMetasProps) {
  const categorias = lectura === "error" ? null : lectura;
  const esAjuste = modo === "ajuste";
  const enConteos = !esAjuste || metasEnConteos(metas);
  const escala = escalaDeBarras(comparacion);
  return (
    <div className="pond-metas-grupo" role="rowgroup" aria-label={etiqueta}>
      <div className="pond-metas-titulo" role="row">
        <span className="pond-metas-variable" role="rowheader">
          <strong>{etiqueta}</strong>
          {fuente ? (
            <span className="pond-metas-fuente" title="Población censada, sin la omisión censal. Editar una meta la deja como tecleada.">
              <Landmark size={12} aria-hidden="true" />{fuente}
            </span>
          ) : null}
          {esAjuste ? <small>{enConteos ? "Metas en conteo" : "Metas en porcentaje"}</small> : null}
        </span>
        <span className="pond-metas-acciones" role="cell">
          {esAjuste ? (
            <>
              <PulsoButton variant="link" size="sm" disabled={!categorias?.length || !comparacion?.length}
                title="Las metas toman la distribución de la muestra entre las categorías que ya tienen meta"
                onClick={() => onMetas(metasDesdeLaMuestra(categorias ?? [], comparacion))}>
                Usar muestra
              </PulsoButton>
              <PulsoButton variant="link" size="sm" disabled={!categorias?.length}
                title="El mismo porcentaje para cada categoría"
                onClick={() => onMetas(metasIguales(categorias ?? []))}>
                Igualar
              </PulsoButton>
            </>
          ) : null}
          <PulsoButton variant="icon" size="sm" intent="remove" aria-label={`Quitar ${etiqueta}`} onClick={onQuitar}>
            <X size={15} aria-hidden="true" />
          </PulsoButton>
        </span>
      </div>
      {lectura === null ? (
        <div className="pond-metas-nota" role="row"><span role="cell">Leyendo las categorías de {variable}</span></div>
      ) : null}
      {lectura === "error" ? (
        <div className="pond-metas-nota is-error" role="row">
          <span role="cell">No se pudieron leer las categorías de {variable}. Quita la variable y vuelve a agregarla para reintentar.</span>
        </div>
      ) : null}
      {categorias?.length === 0 ? (
        <div className="pond-metas-nota" role="row"><span role="cell">La variable {variable} no tiene categorías en la base.</span></div>
      ) : null}
      {(categorias ?? []).map((c) => {
        const fila = comparacionDe(comparacion, c.value);
        const nombre = c.label || c.value;
        const codigo = codigoVisible(c);
        return (
          <div key={c.value} className="pond-metas-fila" role="row" data-categoria={c.value}>
            <span className="pond-metas-categoria" role="cell">
              {codigo !== null ? <code className="pond-metas-codigo" title="Código en la base">{codigo}</code> : null}
              {nombre}
            </span>
            {esAjuste ? (
              <>
                <span className="pond-metas-barras" role="cell">
                  {fila ? <BarrasMuestraMeta muestra={fila.muestra} meta={fila.objetivo} escala={escala} /> : null}
                </span>
                <span className="pond-metas-cifra" role="cell">{fila ? porcentaje(fila.muestra) : SIN_CIFRA}</span>
              </>
            ) : null}
            <span className="pond-metas-campo" role="cell">
              <PulsoInput
                size="sm"
                numeric
                inputMode="decimal"
                value={metas[c.value] ?? ""}
                placeholder={enConteos ? "n" : "%"}
                aria-label={`${esAjuste ? "Meta" : "Población"} de ${nombre}`}
                onChange={(e) => onMetas(conMeta(metas, c.value, e.target.value))}
              />
            </span>
            {esAjuste ? (
              <span className="pond-metas-cifra is-resultado" role="cell">{fila ? porcentaje(fila.ponderado) : SIN_CIFRA}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
