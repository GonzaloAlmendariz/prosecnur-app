/**
 * Command bar de módulo — patrón maestro #1 (ADR 0038, ratificado por el 0042).
 *
 * Una banda, tres zonas, UNA fila. Antes de este componente existía la clase
 * CSS `.pulso-command-bar` con su geometría bien centralizada, pero no el
 * componente: nueve módulos la aplicaban a mano sobre una clase propia, cinco
 * usaban otra base más baja y dos se habían escrito un lenguaje entero. Doce
 * nombres de clase para la misma banda, con cinco alturas distintas.
 *
 * Lo que este componente garantiza y una clase CSS no puede:
 *
 * - **Una fila.** Las tres zonas son celdas de un grid de una fila. No hay
 *   `children` libre donde meter una alerta o una segunda banda; lo que no es
 *   contexto, secciones o acciones no entra. Los avisos van al slot `notices`
 *   de `PageFrame`, que es una pila y está debajo.
 * - **Overflow con dignidad** (ADR 0042 §4). Las acciones declaran `rank` y la
 *   barra las degrada en dos peldaños —compactar el label, recoger en el menú—
 *   sin crecer nunca de alto. `rank: 1` no se recoge jamás.
 * - **Los chips de estado no desaparecen.** Si no caben, van al menú con su
 *   detalle; nunca se pierden en silencio, que es la regla del ADR 0042.
 *
 * Los elementos a los lados son bienvenidos: la uniformidad que pide el canon
 * es de geometría y material, no de contenido. Para eso están `contexto` y
 * `acciones`.
 *
 * El acento del módulo no se inyecta acá. Lo declara el frame del módulo en
 * theme.css y la barra lo hereda por CSS, que es el mecanismo único de paleta
 * ya establecido. Un `style` con el tono sería un segundo mecanismo.
 */

import { useMemo, type ReactNode } from "react";

import { ChromeOverflowMenu } from "./ChromeOverflowMenu";
import { PulsoButton } from "./PulsoButton";
import type { ProsecnurModuleSlug } from "../lib/modules";
import type { LucideIcon } from "../vendor/lucide-react";
import "./chrome.css";

/** Cuánto sobrevive una acción cuando el ancho aprieta. */
export type ChromeActionRank = 1 | 2 | 3;

export type ChromeAction = {
  id: string;
  label: string;
  /** Reemplaza al label al compactar. Sin él, se compacta a solo ícono. */
  shortLabel?: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  rank: ChromeActionRank;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
};

export type ChromeStatusTone = "neutral" | "info" | "success" | "warn" | "danger";

export type ChromeStatusChip = {
  id: string;
  label: string;
  tone: ChromeStatusTone;
  /** Lo que explica el chip. Va al `title` y al menú cuando se recoge. */
  detail?: string;
  onSelect?: () => void;
};

/** Cuántas acciones caben antes de recoger. Deriva del ancho, no del gusto. */
export type ChromeDensity = "normal" | "compact" | "tight";

export type ModuleCommandBarProps = {
  modulo: ProsecnurModuleSlug;
  /** Zona 1 — identidad del contexto: mesa, perfil, formulario, base activa. */
  contexto?: ReactNode;
  /** Zona 2 — navegación de sección. Normalmente un `<SectionPillbar>`. */
  secciones?: ReactNode;
  /** Zona 3 — acciones, en prioridad decreciente. */
  acciones?: readonly ChromeAction[];
  /**
   * Controles compuestos de la zona de acciones: un selector de base, un menú de
   * reportes, un toggle. `acciones` cubre botones simples y por eso puede ser
   * declarativo; esto es para lo que no es un botón.
   *
   * No es un `children` libre disfrazado: vive dentro de la celda de acciones, que
   * es `nowrap`, así que no puede crear una segunda fila. La uniformidad que pide
   * el canon es de geometría y material, no de contenido.
   */
  herramientas?: ReactNode;
  /** Chips de estado. Se compactan o se recogen, nunca se pierden. */
  estado?: readonly ChromeStatusChip[];
  /**
   * `none` quita material y borde. Variante DECLARADA para el canvas de
   * Gráficos, que necesita no poner un cristal encima del gráfico. Reemplaza a
   * los tres `!important` que hoy consiguen lo mismo a la fuerza.
   */
  material?: "glass" | "none";
  densidad?: ChromeDensity;
  ariaLabel: string;
  /** Solo para el QA visual. No para estilar. */
  className?: string;
};

/** Cuántas acciones se muestran sueltas antes de recoger, por densidad. */
const VISIBLES_POR_DENSIDAD: Record<ChromeDensity, number> = {
  normal: 4,
  compact: 2,
  tight: 1,
};

/** A partir de qué densidad el label de una acción se compacta. */
const COMPACTA_LABEL: Record<ChromeDensity, boolean> = {
  normal: false,
  compact: true,
  tight: true,
};

export function ModuleCommandBar({
  modulo,
  contexto,
  secciones,
  acciones = [],
  herramientas,
  estado = [],
  material = "glass",
  densidad = "normal",
  ariaLabel,
  className,
}: ModuleCommandBarProps) {
  const { visibles, recogidas } = useMemo(() => {
    // El orden de supervivencia es el rank, no el orden de declaración: así el
    // page-file puede listar las acciones como le resulte legible.
    const ordenadas = [...acciones].sort((a, b) => a.rank - b.rank);
    const cupo = VISIBLES_POR_DENSIDAD[densidad];
    const forzadas = ordenadas.filter((a) => a.rank === 1);
    const opcionales = ordenadas.filter((a) => a.rank !== 1);
    const libres = Math.max(0, cupo - forzadas.length);
    return {
      visibles: [...forzadas, ...opcionales.slice(0, libres)],
      recogidas: opcionales.slice(libres),
    };
  }, [acciones, densidad]);

  // Los chips se recogen todos juntos: media banda de chips y media en el menú
  // es peor que una regla clara.
  const chipsRecogidos = densidad === "tight" && estado.length > 1;

  const tieneMenu = recogidas.length > 0 || chipsRecogidos;

  return (
    <div
      className={["pulso-command-bar", "pulso-module-command-bar", className]
        .filter(Boolean)
        .join(" ")}
      data-modulo={modulo}
      data-chrome-rows="1"
      data-chrome-material={material}
      data-chrome-densidad={densidad}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {/* Las zonas viven dentro de una toolbar: el contrato de superficie las
          excluye de C1 a propósito, porque su geometría la fija el control que
          contienen. Declararlas metía sus botones al gate y el padding de un
          chip se leía como capacidad sin usar. */}
      <div className="pulso-command-bar-zone" data-zone="contexto">
        {contexto}
      </div>

      <div className="pulso-command-bar-zone" data-zone="secciones">
        {secciones}
      </div>

      <div className="pulso-command-bar-zone" data-zone="acciones">
        {herramientas}

        {!chipsRecogidos &&
          estado.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="pulso-chrome-status-chip"
              data-tone={chip.tone}
              title={chip.detail ?? chip.label}
              onClick={chip.onSelect}
              disabled={!chip.onSelect}
            >
              {chip.label}
            </button>
          ))}

        {visibles.map((accion) => {
          const Icono = accion.icon;
          const compacta = COMPACTA_LABEL[densidad];
          const texto = compacta ? accion.shortLabel : accion.label;
          // Sin ícono no se puede compactar a nada: el label se queda, porque
          // una acción sin nombre ni ícono es un botón invisible.
          const soloIcono = compacta && !texto && Boolean(Icono);
          if (soloIcono && Icono) {
            return (
              <PulsoButton
                key={accion.id}
                variant="icon"
                size="sm"
                onClick={accion.onSelect}
                disabled={accion.disabled || accion.busy}
                title={accion.title ?? accion.label}
                aria-label={accion.label}
              >
                <Icono size={16} aria-hidden />
              </PulsoButton>
            );
          }
          return (
            <PulsoButton
              key={accion.id}
              variant={accion.kind ?? "secondary"}
              size="sm"
              onClick={accion.onSelect}
              disabled={accion.disabled || accion.busy}
              title={accion.title ?? accion.label}
            >
              {Icono && <Icono size={16} aria-hidden />}
              {texto ?? accion.label}
            </PulsoButton>
          );
        })}

        {tieneMenu && (
          <ChromeOverflowMenu
            acciones={recogidas}
            estado={chipsRecogidos ? estado : []}
          />
        )}
      </div>
    </div>
  );
}
