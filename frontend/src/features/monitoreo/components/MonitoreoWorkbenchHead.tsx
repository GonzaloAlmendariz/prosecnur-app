import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ContextTabRailEstado } from "../../../components/ContextTabRail";

const ETIQUETA_ESTADO: Record<ContextTabRailEstado, string> = {
  "sin-configurar": "Sin configurar",
  "no-evaluado": "No evaluado",
  parcial: "Parcial",
  bloqueado: "Bloqueado",
  listo: "Listo",
};

type MonitoreoWorkbenchHeadProps = {
  icon: LucideIcon;
  eyebrow: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  pills?: readonly ReactNode[];
  pillsAriaLabel?: string;
  className?: string;
  /**
   * Nombre de la pestaña activa. El rail es icon-only y su cuadrante no lleva
   * rótulo, así que el nombre de dónde estás vive acá: sin esto, saber en qué
   * pestaña estás dependía del tooltip o de la memoria.
   */
  pestanaLabel?: ReactNode;
  /** Readiness de esa pestaña, dicha con palabras. */
  pestanaEstado?: ContextTabRailEstado;
  /**
   * Un control que manda sobre TODA la sección, no sobre un panel.
   *
   * Vive en la cabecera para que no se mueva con el scroll y para que exista en
   * todas las pestañas de la sección, no sólo en la que lo montaba. El caso que
   * lo trajo es el selector de facultad de Cursos-horario.
   */
  control?: ReactNode;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MonitoreoWorkbenchHead({
  icon: Icon,
  eyebrow,
  title,
  detail,
  pills = [],
  pillsAriaLabel = "Resumen operativo",
  className,
  pestanaLabel,
  pestanaEstado,
  control,
}: MonitoreoWorkbenchHeadProps) {
  const visiblePills = pills.filter((item) => item !== null && item !== undefined && item !== false);

  // El detalle de la sección no se repite si ya lo dice la pestaña activa.
  //
  // Medido en Telefónico › Fuentes: la cabecera decía «Fuentes / Universo y
  // barrido / Universo y barrido», porque el `desc` de la sección en el registro
  // es el nombre de una de sus pestañas. Cuando coinciden, el detalle no añade
  // nada y ocupa la línea donde debería ir otra cosa.
  // Solo se compara cuando ambos son texto: `detail` es un `ReactNode` y puede
  // traer marcado, y en ese caso no hay repetición literal que detectar.
  const normalizar = (valor: unknown) =>
    typeof valor === "string" ? valor.trim().toLocaleLowerCase("es") : null;
  const detalleTexto = normalizar(detail);
  const pestanaTexto = normalizar(pestanaLabel);
  const detalleUtil = detalleTexto !== null && pestanaTexto !== null && detalleTexto === pestanaTexto
    ? null
    : detail;

  return (
    <header className={joinClasses("mon-workbench-head", className)}>
      <span aria-hidden="true" className="mon-workbench-head-icon">
        <Icon size={17} />
      </span>
      <div className="mon-workbench-head-copy">
        <span className="pulso-section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {pestanaLabel ? (
          <p className="mon-workbench-head-tab">
            <strong>{pestanaLabel}</strong>
            {pestanaEstado && pestanaEstado !== "listo" ? (
              <em data-estado={pestanaEstado}>{ETIQUETA_ESTADO[pestanaEstado]}</em>
            ) : null}
          </p>
        ) : null}
        {detalleUtil ? <p>{detalleUtil}</p> : null}
      </div>
      {/* **El control que manda sobre toda la seccion vive AQUI.**

          Gonzalo, sobre el selector de facultad: «el selector deberia tener una
          vista privilegiada y permanente arriba y que no se mueva, como el
          titulo y el icono». Estaba dentro de uno de los paneles, asi que se
          movia con el scroll y solo existia en la pestaña que lo montaba,
          teniendo el perfil nueve listas de las mismas veinte facultades.

          Es opcional: los perfiles que no lo pasan pintan la cabecera igual. */}
      {control ? <div className="mon-workbench-head-control">{control}</div> : null}
      {visiblePills.length ? (
        <div className="mon-workbench-pills" aria-label={pillsAriaLabel}>
          {visiblePills.map((pill, index) => (
            <span key={index}>{pill}</span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
