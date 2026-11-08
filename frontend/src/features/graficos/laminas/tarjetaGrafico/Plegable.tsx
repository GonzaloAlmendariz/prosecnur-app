// H4: una sección plegable del inspector (pestaña «Gráfico» y pestaña «Lámina»). La cabecera es un botón con
// `aria-expanded`; quien la usa decide si está abierta y la recuerda en el store de la vista (laminasStore). Cerrada, el
// cuerpo queda montado con `hidden="until-found"`: los mandos conservan su estado, el grupo sigue sabiendo si está vacío
// (`:has`, datosGrafico.css) y buscar en la página un mando escondido abre la sección sola (`beforematch`).

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "../../../../vendor/lucide-react";
import type { ResumenPlegado } from "./resumenPlegado";

type Props = {
  /** Clave de la sección: `data-seccion-tarjeta`, a la que salta el índice (irASeccion). */
  clave: string;
  titulo: string;
  abierta: boolean;
  onAlternar: () => void;
  onAbrir: () => void;
  /** Ítem 12: lo propio de adentro («2 propios»), que la cabecera dice mientras la sección está plegada. */
  resumen?: ResumenPlegado | null;
  children: ReactNode;
};

export function Plegable({ clave, titulo, abierta, onAlternar, onAbrir, resumen, children }: Props) {
  const id = useId();
  const cuerpo = useRef<HTMLDivElement>(null);

  // React 18 sólo escribe `hidden` como booleano: el valor «until-found» se pone a mano, antes de pintar.
  useLayoutEffect(() => {
    const el = cuerpo.current;
    if (!el) return;
    if (abierta) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "until-found");
  }, [abierta]);

  useEffect(() => {
    const el = cuerpo.current;
    if (!el) return;
    el.addEventListener("beforematch", onAbrir);
    return () => el.removeEventListener("beforematch", onAbrir);
  }, [onAbrir]);

  return (
    <section className={`pulso-f6-grupo${abierta ? " is-abierta" : ""}`} data-seccion-tarjeta={clave} aria-labelledby={`${id}-boton`}>
      <h4 className="pulso-f6-grupo-titulo">
        <button type="button" id={`${id}-boton`} className="pulso-f6-grupo-boton" aria-expanded={abierta} aria-controls={`${id}-cuerpo`}
          onClick={onAlternar}>
          <span className="pulso-f6-grupo-rotulo">{titulo}</span>
          {!abierta && resumen ? <span className="pulso-f6-grupo-resumen" title={resumen.detalle}>{resumen.texto}</span> : null}
          <ChevronDown size={16} aria-hidden="true" className="pulso-f6-grupo-chevron" />
        </button>
      </h4>
      <div ref={cuerpo} id={`${id}-cuerpo`} className="pulso-f6-grupo-cuerpo"
        data-qa-geometry-group="graficos/f6-grupo-cuerpo" data-qa-geometry-contract="intrinsic">
        {children}
      </div>
    </section>
  );
}
