// La lista de candidatas de la regla, en el orden de la lámina (la misma métrica, el mismo sentido), con la línea del
// corte entre las que entran por la regla y las que no, los empates en el corte rotulados, una mini barra por fila y el
// interruptor del ajuste a mano. Pasar el cursor (o el foco) por una fila la resalta también en el reparto. La lista es
// dueña de su scroll (C4); el orden y el corte salen de repartoRegla.ts.

import { Fragment, useEffect, useRef } from "react";
import type { CandidataRegla, ReglaPreguntas as Regla } from "../../../../api/graficosRegla";
import { Panel } from "../../../../components/Panel";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { MiniBarraMetrica } from "./MiniBarraMetrica";
import { alternarFila, filaBloqueada, textoMetrica } from "./modeloReglaPreguntas";
import { desplazamientoParaFila, type MarcasCorte, type Reparto } from "./repartoRegla";

/** Lo que la lista espera antes de volver a su sitio al salir del reparto. */
export const ESPERA_RETORNO_MS = 150;

export type Resaltada = { tema: string; desde: "lista" | "reparto" } | null;

type Props = {
  regla: Regla;
  filas: readonly CandidataRegla[];
  encendida: (tema: string) => boolean;
  marcas: MarcasCorte;
  reparto: Reparto | null;
  rotuloMetrica: string;
  etiquetaLista: string;
  resaltada: Resaltada;
  onResaltar: (r: Resaltada) => void;
  onAlternar: (tema: string, encendida: boolean, regla: Regla) => void;
};

export function ListaCandidatas({ regla, filas, encendida, marcas, reparto, rotuloMetrica, etiquetaLista, resaltada, onResaltar, onAlternar }: Props) {
  const lista = useRef<HTMLUListElement>(null);

  // Resaltada desde el reparto: la fila se trae a la vista moviendo SÓLO la lista (scrollIntoView desplazaba también el
  // inspector y la página), y sólo si no se ve entera. Al salir del reparto la lista vuelve a donde estaba (R4: el hover
  // la dejaba desplazada); si el cursor entra a la lista, se queda donde la dejó.
  const scrollPrevio = useRef<number | null>(null);
  useEffect(() => {
    const ul = lista.current;
    if (!ul) return;
    if (!resaltada || resaltada.desde !== "reparto") {
      if (resaltada || scrollPrevio.current === null) { scrollPrevio.current = null; return; }
      // Una espera breve: pasar de un punto al vecino es salir y entrar, y la lista no tiene que ir y volver en medio.
      const espera = setTimeout(() => {
        if (scrollPrevio.current !== null) ul.scrollTop = scrollPrevio.current;
        scrollPrevio.current = null;
      }, ESPERA_RETORNO_MS);
      return () => clearTimeout(espera);
    }
    const fila = Array.from(ul.children).find((el) => el instanceof HTMLElement && el.dataset.tema === resaltada.tema);
    if (!(fila instanceof HTMLElement)) return;
    // La lista es `position: relative`: el offsetTop de la fila se mide desde ella.
    const destino = desplazamientoParaFila({ arriba: fila.offsetTop, alto: fila.offsetHeight }, { scrollTop: ul.scrollTop, alto: ul.clientHeight });
    if (destino === null) return;
    if (scrollPrevio.current === null) scrollPrevio.current = ul.scrollTop;
    ul.scrollTop = destino;
  }, [resaltada]);

  return (
    <Panel variant="subtle" noPadding className="pulso-f6-regla-lista" data-qa-geometry-member>
      {/* Q2-12 (C4): la cifra va antes de la pregunta (a la derecha quedaba cortada en el inspector angosto) y la
          cabecera nombra su métrica a todo lo ancho, sin una columna que la parta. */}
      <div className="pulso-f6-regla-cabeza" aria-hidden="true">
        <span>{rotuloMetrica}</span>
      </div>
      <ul ref={lista} className="pulso-f6-regla-filas" data-qa-scroll-owner="regla-preguntas" aria-label={etiquetaLista}
        onMouseLeave={() => onResaltar(null)}>
        {filas.map((c) => {
          const on = encendida(c.tema);
          const empate = marcas.empates.has(c.tema);
          const clases = ["pulso-f6-regla-fila", reparto ? "con-barra" : "", resaltada?.tema === c.tema ? "is-resaltada" : "", on ? "is-entra" : ""]
            .filter(Boolean).join(" ");
          return (
            <Fragment key={c.tema}>
              {marcas.trasCorte.has(c.tema) && (
                <li className="pulso-f6-regla-linea-corte" aria-hidden="true"><span>Corte</span></li>
              )}
              <li className={clases} data-tema={c.tema}
                onMouseEnter={() => onResaltar({ tema: c.tema, desde: "lista" })}
                onFocus={() => onResaltar({ tema: c.tema, desde: "lista" })}>
                <span className="pulso-f6-regla-metrica">{textoMetrica(c.metrica)}</span>
                <PulsoSwitch size="sm" label={c.etiqueta} title={c.etiqueta} checked={on}
                  disabled={filaBloqueada(regla, c.tema, on)}
                  onCheckedChange={() => onAlternar(c.tema, on, alternarFila(regla, c.tema, on))} />
                {empate && <span className="pulso-f6-regla-empate">Empate</span>}
                {reparto && <MiniBarraMetrica metrica={c.metrica} escala={reparto.escala} cortes={reparto.cortesValor} entra={on} />}
              </li>
            </Fragment>
          );
        })}
        {marcas.alFinal && <li className="pulso-f6-regla-linea-corte" aria-hidden="true"><span>Corte</span></li>}
      </ul>
    </Panel>
  );
}
