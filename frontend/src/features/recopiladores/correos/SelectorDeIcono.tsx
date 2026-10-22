import { useId, useRef, type KeyboardEvent } from "react";

import type { MailIcon } from "../../../api/materialMail";
import {
  Calendar,
  Check,
  Clock,
  Gift,
  Info,
  Link,
  Lock,
  Mail,
  MapPin,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "../../../vendor/lucide-react";
import { ICONOS_DE_PIEZA, ROTULO_DE_ICONO } from "./piezasGraficas";
import "./correosPiezas.css";

/**
 * Los 12 íconos de la casa, dibujados con lucide (vía el shim) para elegir.
 * En el correo salen como PNG cuadrados que genera el render
 * (collection_mail_iconos.R): la forma se parece, no es el mismo archivo.
 * «Regalo» usa la medalla hasta que el shim traiga `Gift`.
 */
export const DIBUJO_DE_ICONO: Record<MailIcon, LucideIcon> = {
  calendario: Calendar,
  reloj: Clock,
  candado: Lock,
  sobre: Mail,
  persona: User,
  grupo: Users,
  mapa: MapPin,
  check: Check,
  info: Info,
  alerta: TriangleAlert,
  regalo: Gift,
  enlace: Link,
};

type Props = {
  valor: MailIcon | undefined;
  onElegir: (icon: MailIcon) => void;
};

const PASO_DE_TECLA: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** `data-foco` del selector de ícono: a él lleva la Revisión (`missing_icon`, `icon_text_sm_icon`). */
export const FOCO_ICONO = "pieza-icono";

/**
 * Cuadrícula de íconos: un grupo de radios con su nombre accesible, flechas
 * para moverse y uno solo en el orden de tabulación (el elegido o el primero).
 */
export function SelectorDeIcono({ valor, onElegir }: Props) {
  const id = useId();
  const raiz = useRef<HTMLDivElement | null>(null);
  const activo = valor ?? ICONOS_DE_PIEZA[0];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const paso = PASO_DE_TECLA[event.key];
    if (!paso) return;
    event.preventDefault();
    const i = ICONOS_DE_PIEZA.indexOf(activo);
    const siguiente = ICONOS_DE_PIEZA[(i + paso + ICONOS_DE_PIEZA.length) % ICONOS_DE_PIEZA.length];
    onElegir(siguiente);
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLButtonElement>(`[data-icono="${siguiente}"]`)?.focus());
  };

  return (
    <div className="rec-pieza-iconos">
      <span className="rec-pieza-iconos-cabeza">
        <span id={`${id}-rotulo`}>Ícono</span>
        <span className="rec-pieza-iconos-elegido">{valor ? ROTULO_DE_ICONO[valor] : "Elige uno"}</span>
      </span>
      <div
        ref={raiz}
        role="radiogroup"
        aria-labelledby={`${id}-rotulo`}
        className="rec-pieza-iconos-rejilla"
        data-qa-geometry-group="material-campo/correo/iconos"
        data-qa-geometry-contract="equal"
        onKeyDown={onKeyDown}
      >
        {ICONOS_DE_PIEZA.map((icon) => {
          const Dibujo = DIBUJO_DE_ICONO[icon];
          const on = icon === valor;
          return (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={ROTULO_DE_ICONO[icon]}
              title={ROTULO_DE_ICONO[icon]}
              tabIndex={icon === activo ? 0 : -1}
              data-icono={icon}
              data-foco={icon === activo ? FOCO_ICONO : undefined}
              data-qa-geometry-member
              className={`rec-pieza-icono${on ? " is-on" : ""}`}
              onClick={() => onElegir(icon)}
            >
              <Dibujo size={18} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
