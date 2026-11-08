import { forwardRef, type ReactNode, type Ref } from "react";
import { BotonCerrar } from "./BotonCerrar";
import "./kit-cabecera-panel.css";

export type CabeceraPanelProps = {
  /** Título de una línea; si no cabe se corta con elipsis y el texto completo va en `title`. */
  titulo: string;
  /** Segunda línea opcional (contexto, base, conteo). */
  subtitulo?: ReactNode;
  /** Ícono opcional a la izquierda (16 px del shim, `aria-hidden`). */
  icono?: ReactNode;
  /** Acciones de la cabecera; como mucho UNA acción de texto (contrato B). */
  acciones?: ReactNode;
  /** Si se pasa, se pinta la X. Sin `onCerrar` no hay X (y entonces cabe un «Listo» en el pie). */
  onCerrar?: () => void;
  /** Nombre accesible de la X. Por defecto «Cerrar <titulo>». */
  etiquetaCerrar?: `Cerrar ${string}`;
  /** Ref a la X, para quien gestiona el foco inicial de la superficie. */
  cerrarRef?: Ref<HTMLButtonElement>;
  /** `id` del título, para el `aria-labelledby` del diálogo o panel. */
  tituloId?: string;
  /** Nivel del encabezado. Por defecto 2. */
  nivel?: 2 | 3;
  className?: string;
};

/**
 * **La cabecera de toda superficie con X** (contrato B del acabado de Láminas).
 *
 * Rejilla `[ícono?] [título + subtítulo 1fr] [acciones auto] [X]`, alto mínimo
 * `--pulso-panel-head-h`, filete inferior. El título va en `--pulso-type-title-*`,
 * en una línea con elipsis. Ícono, acciones y X ocupan la PRIMERA fila de la
 * rejilla, así que quedan alineados al título aunque haya subtítulo.
 *
 * **Escape NO es asunto de esta cabecera.** Cerrar con Escape y devolver el foco
 * al disparador es de la superficie (Dialog, Sideover, Popover, el hook del
 * panel). La cabecera solo pinta la X que llama a `onCerrar`.
 *
 * Reglas: «Listo» y la X no conviven; una sola acción de texto en `acciones`.
 */
export const CabeceraPanel = forwardRef<HTMLDivElement, CabeceraPanelProps>(function CabeceraPanel(
  {
    titulo,
    subtitulo,
    icono,
    acciones,
    onCerrar,
    etiquetaCerrar,
    cerrarRef,
    tituloId,
    nivel = 2,
    className,
  },
  ref,
) {
  const Titulo = nivel === 3 ? "h3" : "h2";
  return (
    <div
      ref={ref}
      className={["pulso-cabecera-panel", subtitulo ? "pulso-cabecera-panel--con-subtitulo" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {icono ? (
        <span className="pulso-cabecera-panel__icono" aria-hidden="true">
          {icono}
        </span>
      ) : null}
      <Titulo id={tituloId} className="pulso-cabecera-panel__titulo" title={titulo}>
        {titulo}
      </Titulo>
      {subtitulo ? <p className="pulso-cabecera-panel__subtitulo">{subtitulo}</p> : null}
      {acciones ? <div className="pulso-cabecera-panel__acciones">{acciones}</div> : null}
      {onCerrar ? (
        <BotonCerrar
          ref={cerrarRef}
          className="pulso-cabecera-panel__cerrar"
          aria-label={etiquetaCerrar ?? `Cerrar ${titulo}`}
          onClick={onCerrar}
        />
      ) : null}
    </div>
  );
});
