// H4: una sección de la tarjeta del gráfico (Datos, Categorías y orden, Cifras, Diferencias entre grupos, Colores, En el
// Word) que se pliega. La cabecera es un botón con `aria-expanded`; abierta o cerrada se recuerda en el store de la
// vista (laminasStore). Cerrada, el cuerpo queda montado con `hidden="until-found"`: los mandos conservan su estado, el
// grupo sigue sabiendo si está vacío (`:has`, datosGrafico.css) y buscar en la página un mando escondido abre la
// sección sola (`beforematch`).

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "../../../../vendor/lucide-react";
import { useLaminasUi } from "../laminasStore";
import { seccionAbierta, TITULO_GRUPO, type SeccionTarjeta } from "../gruposTarjeta";

type Props = { seccion: SeccionTarjeta; children: ReactNode };

export function SeccionPlegable({ seccion, children }: Props) {
  const id = useId();
  const abierta = useLaminasUi((s) => seccionAbierta(s.seccionesTarjeta, seccion));
  const alternar = useLaminasUi((s) => s.alternarSeccionTarjeta);
  const abrir = useLaminasUi((s) => s.abrirSeccionTarjeta);
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
    const alEncontrar = () => abrir(seccion);
    el.addEventListener("beforematch", alEncontrar);
    return () => el.removeEventListener("beforematch", alEncontrar);
  }, [abrir, seccion]);

  return (
    <section className={`pulso-f6-grupo${abierta ? " is-abierta" : ""}`} data-seccion-tarjeta={seccion} aria-labelledby={`${id}-boton`}>
      <h4 className="pulso-f6-grupo-titulo">
        <button type="button" id={`${id}-boton`} className="pulso-f6-grupo-boton" aria-expanded={abierta} aria-controls={`${id}-cuerpo`}
          onClick={() => alternar(seccion)}>
          <span className="pulso-f6-grupo-rotulo">{TITULO_GRUPO[seccion]}</span>
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
