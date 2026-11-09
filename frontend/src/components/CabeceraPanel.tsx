import * as RadixDialog from "@radix-ui/react-dialog";
import { forwardRef, type ReactNode, type Ref } from "react";
import { BotonCerrar } from "./BotonCerrar";
import "./kit-cabecera-panel.css";

/** Atributos `data-*` que la cabecera pasa tal cual a su raíz (QA, geometría, auditoría). */
export type AtributosData = { [atributo: `data-${string}`]: string | undefined };

export type CabeceraPanelProps = AtributosData & {
  /**
   * Título de una línea; si no cabe se corta con elipsis y el texto completo va en `title`. Si no es texto (un nodo
   * con énfasis), el `title` sale de `tituloCompleto`.
   */
  titulo: ReactNode;
  /** Texto completo del título para el tooltip y la X cuando `titulo` no es texto. */
  tituloCompleto?: string;
  /**
   * Antetítulo sobre el título (contexto: «Insertar después de la lámina 22»). Va en `--pulso-text-faint`, nunca en
   * el acento (contrato D1). La X, el ícono y las acciones siguen alineados a la línea del TÍTULO, no a esta.
   */
  antetitulo?: ReactNode;
  /** Segunda línea opcional (contexto, base, conteo). */
  subtitulo?: ReactNode;
  /** Ícono opcional a la izquierda (16 px del shim, `aria-hidden`). */
  icono?: ReactNode;
  /** Acciones de la cabecera; como mucho UNA acción de texto (contrato B). */
  acciones?: ReactNode;
  /** Si se pasa, se pinta la X. Sin `onCerrar` no hay X (y entonces cabe un «Listo» en el pie). */
  onCerrar?: () => void;
  /** La X se pinta deshabilitada (p. ej. mientras se guarda y la superficie no se puede cerrar). */
  cerrarDeshabilitado?: boolean;
  /** Nombre accesible de la X. Por defecto «Cerrar <titulo>». */
  etiquetaCerrar?: `Cerrar ${string}`;
  /** Ref a la X, para quien gestiona el foco inicial de la superficie. */
  cerrarRef?: Ref<HTMLButtonElement>;
  /** Ref al título (el encabezado). */
  tituloRef?: Ref<HTMLHeadingElement>;
  /**
   * El título acepta foco por código (`tabIndex={-1}`): para la superficie que, al abrirse, lleva el foco a su
   * título en lugar de a un control. No entra en el orden de tabulación.
   */
  tituloEnfocable?: boolean;
  /** `id` del título, para el `aria-labelledby` del diálogo o panel. */
  tituloId?: string;
  /** Nivel del encabezado. Por defecto 2. */
  nivel?: 2 | 3;
  /**
   * Dentro de un diálogo de Radix: el título sale como `Dialog.Title` y el subtítulo como `Dialog.Description`, así
   * el diálogo toma de aquí su nombre y su descripción accesibles (`aria-labelledby` / `aria-describedby`).
   */
  enDialogo?: boolean;
  /** Elemento raíz. Por defecto `div`; `header` cuando la cabecera abre una superficie propia. */
  como?: "div" | "header";
  className?: string;
};

function etiquetaPorDefecto(titulo: ReactNode, tituloCompleto: string | undefined): `Cerrar ${string}` {
  const texto = typeof titulo === "string" ? titulo : tituloCompleto;
  return texto ? `Cerrar ${texto}` : "Cerrar panel";
}

/**
 * **La cabecera de toda superficie con X** (contrato B del acabado de Láminas).
 *
 * Rejilla `[ícono?] [antetítulo? + título + subtítulo 1fr] [acciones auto] [X]`, alto mínimo
 * `--pulso-panel-head-h`, filete inferior. El título va en `--pulso-type-title-*`, en una línea con elipsis. Ícono,
 * acciones y X ocupan la fila del TÍTULO, así que quedan alineados a él aunque haya antetítulo o subtítulo.
 *
 * **Escape NO es asunto de esta cabecera.** Cerrar con Escape y devolver el foco al disparador es de la superficie
 * (Dialog, Sideover, Popover, el hook del panel). La cabecera solo pinta la X que llama a `onCerrar`.
 *
 * Reglas: «Listo» y la X no conviven; una sola acción de texto en `acciones`.
 */
export const CabeceraPanel = forwardRef<HTMLDivElement, CabeceraPanelProps>(function CabeceraPanel(
  {
    titulo,
    tituloCompleto,
    antetitulo,
    subtitulo,
    icono,
    acciones,
    onCerrar,
    cerrarDeshabilitado = false,
    etiquetaCerrar,
    cerrarRef,
    tituloRef,
    tituloEnfocable = false,
    tituloId,
    nivel = 2,
    enDialogo = false,
    como = "div",
    className,
    ...datos
  },
  ref,
) {
  const Titulo = nivel === 3 ? "h3" : "h2";
  const Raiz = como;
  const textoTitulo = typeof titulo === "string" ? titulo : tituloCompleto;
  const encabezado = (
    <Titulo
      ref={tituloRef}
      // Un `id` indefinido pisaría el que pone Radix por el Slot (enDialogo): sólo se escribe si llega.
      {...(tituloId ? { id: tituloId } : {})}
      className="pulso-cabecera-panel__titulo"
      title={textoTitulo}
      {...(tituloEnfocable ? { tabIndex: -1 } : {})}
    >
      {titulo}
    </Titulo>
  );
  const bajada = subtitulo ? <p className="pulso-cabecera-panel__subtitulo">{subtitulo}</p> : null;
  return (
    <Raiz
      {...datos}
      ref={ref}
      className={[
        "pulso-cabecera-panel",
        subtitulo ? "pulso-cabecera-panel--con-subtitulo" : null,
        antetitulo ? "pulso-cabecera-panel--con-antetitulo" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icono ? (
        <span className="pulso-cabecera-panel__icono" aria-hidden="true">
          {icono}
        </span>
      ) : null}
      {antetitulo ? <div className="pulso-cabecera-panel__antetitulo">{antetitulo}</div> : null}
      {enDialogo ? <RadixDialog.Title asChild>{encabezado}</RadixDialog.Title> : encabezado}
      {bajada && enDialogo ? <RadixDialog.Description asChild>{bajada}</RadixDialog.Description> : bajada}
      {acciones ? <div className="pulso-cabecera-panel__acciones">{acciones}</div> : null}
      {onCerrar ? (
        <BotonCerrar
          ref={cerrarRef}
          className="pulso-cabecera-panel__cerrar"
          aria-label={etiquetaCerrar ?? etiquetaPorDefecto(titulo, tituloCompleto)}
          disabled={cerrarDeshabilitado}
          onClick={onCerrar}
        />
      ) : null}
    </Raiz>
  );
});
