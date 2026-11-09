// La Regla de preguntas de una tarjeta del mazo, en un lateral DENTRO del diálogo (oleada M, paso 4). No es un Sideover
// ni lleva rol de diálogo: `?panel=` admite un solo valor y abrir otro panel cerraría el mazo. Es una columna más del
// cuerpo, con scroll propio; las tarjetas conservan su alto (antes la regla se desplegaba dentro de la tarjeta y las diez
// se estiraban a 880 px, C2). Escape cierra el lateral y no el diálogo mientras el foco esté dentro; al cerrar, el foco
// vuelve al «Editar» de la tarjeta (lo hace quien lo abre).

import { useEffect, useRef } from "react";
import type { ReglaPreguntas as Regla } from "../../../../api/graficosRegla";
import { CabeceraPanel } from "../../../../components/CabeceraPanel";
import { ReglaPreguntas } from "../reglaPreguntas/ReglaPreguntas";
import { listaPublicos, type PropuestaMazo } from "./modeloMazo";

type Props = {
  id: string;
  propuesta: PropuestaMazo & { graficador: string };
  scope: "active" | "consolidated";
  onRegla: (regla: Regla) => void;
  onCerrar: () => void;
};

export function EdicionReglaMazo({ id, propuesta: p, scope, onRegla, onCerrar }: Props) {
  const ref = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Al abrir (o al pasar a otra tarjeta), el foco entra al lateral: a su título, enfocable sólo por código (W3: la
  // cabecera del kit lo expone con `tituloRef` + `tituloEnfocable`; antes se buscaba por clase y se mutaba tabIndex).
  useEffect(() => {
    titulo.current?.focus();
  }, [p.id]);

  // Escape en captura sobre window: llega antes que el listener del diálogo (Radix escucha en document) y, si el foco
  // está dentro del lateral, lo consume. Un menú desplegado de la regla vive en un portal fuera del lateral: su Escape
  // lo cierra a él, no a esto.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !ref.current?.contains(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      onCerrar();
    };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [onCerrar]);

  return (
    <aside ref={ref} id={id} className="pulso-f6-mazo-lateral" aria-labelledby={`${id}-titulo`} data-qa-geometry-member
      data-qa-geometry-capacity="owned">
      {/* W2-B: la gramática única de cierre (CabeceraPanel + BotonCerrar); quién lee la lámina va de subtítulo. */}
      <CabeceraPanel tituloRef={titulo} tituloEnfocable className="pulso-f6-mazo-lateral-cabeza" nivel={3} tituloId={`${id}-titulo`}
        titulo={p.nombre} subtitulo={listaPublicos(p.publicos)} onCerrar={onCerrar} etiquetaCerrar="Cerrar la regla de preguntas" />
      <ReglaPreguntas
        rotulo="Regla de preguntas"
        ayuda="Cómo se eligen las preguntas de esta lámina. Se puede cambiar después en Datos."
        graficador={p.graficador}
        args={p.args}
        valor={p.args.regla}
        scope={scope}
        onCambio={onRegla}
      />
    </aside>
  );
}
