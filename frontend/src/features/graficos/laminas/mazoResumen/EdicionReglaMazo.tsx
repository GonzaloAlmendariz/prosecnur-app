// La Regla de preguntas de una tarjeta del mazo, en un lateral DENTRO del diálogo (oleada M, paso 4). No es un Sideover
// ni lleva rol de diálogo: `?panel=` admite un solo valor y abrir otro panel cerraría el mazo. Es una columna más del
// cuerpo, con scroll propio; las tarjetas conservan su alto (antes la regla se desplegaba dentro de la tarjeta y las diez
// se estiraban a 880 px, C2). Escape cierra el lateral y no el diálogo mientras el foco esté dentro; al cerrar, el foco
// vuelve al «Editar» de la tarjeta (lo hace quien lo abre).

import { useEffect, useRef } from "react";
import type { ReglaPreguntas as Regla } from "../../../../api/graficosRegla";
import { X } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
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

  // Al abrir (o al pasar a otra tarjeta), el foco entra al lateral.
  useEffect(() => { titulo.current?.focus(); }, [p.id]);

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
      <div className="pulso-f6-mazo-lateral-cabeza">
        <span className="pulso-f6-mazo-lateral-texto">
          <span className="pulso-f6-mazo-lee">{listaPublicos(p.publicos)}</span>
          <h3 ref={titulo} id={`${id}-titulo`} className="pulso-f6-mazo-lateral-titulo" tabIndex={-1}>{p.nombre}</h3>
        </span>
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar la regla" onClick={onCerrar}>
          <X size={14} aria-hidden="true" />
        </PulsoButton>
      </div>
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
