/**
 * El bloque de las sugeridas de la base y el de las sugerencias para revisar
 * (ítem 40): un encabezado con su conteo y las tarjetas debajo. Mientras el
 * motor calcula, la misma geometría con siluetas y la carga del kit, que retiene
 * la readiness de la pestaña hasta que llega el dato o el error.
 */
import type { ReactNode } from "react";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { Panel } from "../../../../components/Panel";
import { Skeleton } from "../../../../components/Skeleton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import "./recomendador.css";

export function BloqueDelRecomendador({
  id,
  className,
  titulo,
  conteo,
  cargando,
  etiquetaDeCarga,
  grupo,
  avisos,
  estado,
  estadoEsAviso = false,
  children,
}: {
  id: string;
  className?: string;
  titulo: string;
  conteo?: number | null;
  cargando?: boolean;
  etiquetaDeCarga?: string;
  /** Grupo de geometría de las tarjetas. */
  grupo: string;
  avisos?: ReactNode;
  /** Texto en lugar de las tarjetas: el vacío o el error. */
  estado?: ReactNode;
  estadoEsAviso?: boolean;
  /** Las tarjetas (`li`). */
  children?: ReactNode;
}) {
  return (
    <section className={["pulso-rl-rec", className].filter(Boolean).join(" ")} aria-labelledby={id} aria-busy={cargando || undefined}>
      <h3 id={id} className="pulso-rl-rec-encabezado">
        <span>{titulo}</span>
        {typeof conteo === "number" && conteo > 0 ? (
          <span className="pulso-panel-de-mesa-conteo">{formatoConteo(conteo)}</span>
        ) : null}
      </h3>
      {avisos}
      {cargando ? (
        <>
          <CargaDeBloque label={etiquetaDeCarga ?? "Leyendo la base"} />
          <ul className="pulso-rl-rec-lista" aria-hidden="true">
            {[0, 1].map((i) => (
              <li key={i} className="pulso-rl-rec-item">
                <Panel noPadding className="pulso-rl-rec-tarjeta pulso-rl-rec-tarjeta--silueta">
                  <div className="pulso-rl-rec-cuerpo">
                    <Skeleton forma="titulo" ancho="46%" />
                    <Skeleton forma="texto" ancho="30%" />
                    <Skeleton forma="texto" ancho="92%" />
                    <Skeleton forma="texto" ancho="68%" />
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </>
      ) : estado ? (
        <p className="pulso-rl-rec-estado" data-tono={estadoEsAviso ? "aviso" : undefined}>{estado}</p>
      ) : children ? (
        <ul className="pulso-rl-rec-lista" data-qa-geometry-group={grupo} data-qa-geometry-contract="intrinsic">
          {children}
        </ul>
      ) : null}
    </section>
  );
}
