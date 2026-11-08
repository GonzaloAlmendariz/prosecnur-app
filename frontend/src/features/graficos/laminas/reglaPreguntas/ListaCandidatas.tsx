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
import type { MarcasCorte, Reparto } from "./repartoRegla";

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
  // inspector y la página).
  useEffect(() => {
    const ul = lista.current;
    if (!resaltada || resaltada.desde !== "reparto" || !ul) return;
    const fila = Array.from(ul.children).find((el) => el instanceof HTMLElement && el.dataset.tema === resaltada.tema);
    if (!(fila instanceof HTMLElement)) return;
    // La lista es `position: relative`: el offsetTop de la fila se mide desde ella.
    const arriba = fila.offsetTop;
    const abajo = arriba + fila.offsetHeight;
    if (arriba < ul.scrollTop) ul.scrollTop = arriba;
    else if (abajo > ul.scrollTop + ul.clientHeight) ul.scrollTop = abajo - ul.clientHeight;
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
