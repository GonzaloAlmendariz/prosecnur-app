// Marco común de los diálogos «¿Qué lámina?» y «¿Qué gráfico?» (F6.2; dirección F6 §4.3–4.4): cabecera de 56 px y
// tres columnas —la pregunta, las tarjetas y el detalle— cada una con su propio desplazamiento (C4). Diálogo modal de
// Radix: Escape y el velo cierran, el foco entra en la primera opción y vuelve a quien lo abrió.

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef, type ReactNode, type RefObject } from "react";
import { X } from "../../../../vendor/lucide-react";
import { useLibraryDialogA11y } from "../../useLibraryDialogA11y";
import "./selectores.css";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  /** `data-pulso-panel` del panel direccionable. */
  panelProps: { "data-pulso-panel": string };
  auditReady: string;
  /**
   * Sobre el título. Con `fijo` (R5-11), esa parte no se recorta: a 1024 la línea va con elipsis y el número de la
   * lámina («lámina 22») se perdía; ahora cede el resto («Insertar después de la…»).
   */
  antetitulo: string | { texto: string; fijo: string };
  titulo: string;
  descripcion: string;
  /** Lo que recibe el foco al abrir (la opción elegida de la primera columna). */
  focoInicialRef: RefObject<HTMLInputElement>;
  /** Campo de búsqueda en la cabecera, entre el título y el botón de cerrar (opcional). */
  buscador?: ReactNode;
  /** Una acción de la cabecera, tras el buscador («Armar el resumen ejecutivo»). */
  accion?: ReactNode;
  /** Control de modo junto a los títulos («Insertar detrás / Cambiar esta lámina»; opcional). */
  modo?: ReactNode;
  pregunta: ReactNode;
  galeria: ReactNode;
  detalle: ReactNode;
  /** Vista partida «Comparar»: si llega, ocupa el lugar de la galería y el detalle (opcional). */
  comparacion?: ReactNode;
  /**
   * Adónde vuelve el foco si nadie lo abrió con un clic (se llegó por enlace) o si quien lo abrió ya no está: la lámina
   * o ranura del `foco` (`focoAlCerrar.ts`). Se resuelve al cerrar, con la lámina que quedó en pantalla.
   */
  destinoAlCerrar?: () => HTMLElement | null;
  className?: string;
};

export function DialogoSelector({
  abierto, onCerrar, panelProps, auditReady, antetitulo, titulo, descripcion, focoInicialRef, buscador, accion, modo, pregunta, galeria, detalle,
  comparacion, destinoAlCerrar, className,
}: Props) {
  const anclaRef = useRef<HTMLSpanElement>(null);
  const destinoRef = useRef(destinoAlCerrar);
  destinoRef.current = destinoAlCerrar;
  // Una ref que se lee al cerrar: el hook la consulta después de la navegación que cierra el panel.
  const retornoRef = useMemo<RefObject<HTMLElement>>(() => ({ get current() { return destinoRef.current?.() ?? null; } }), []);
  const a11y = useLibraryDialogA11y({ searchRef: focoInicialRef, returnFocusRef: retornoRef, fallbackFocusRef: anclaRef });
  return (
    <>
      <span ref={anclaRef} className="pulso-sr-only" tabIndex={-1}>Pestaña Láminas</span>
      <Dialog.Root modal open={abierto} onOpenChange={(siguiente) => { if (!siguiente && abierto) onCerrar(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="pulso-f6-selector-velo" />
          <Dialog.Content
            {...panelProps}
            {...a11y}
            className={["pulso-f6-selector", className].filter(Boolean).join(" ")}
            data-audit-ready={auditReady}
            data-qa-surface={`graficos/${auditReady}`}
            aria-modal="true"
          >
            <header className="pulso-f6-selector-cabecera">
              <div className="pulso-f6-selector-titulos">
                {typeof antetitulo === "string"
                  ? <span className="pulso-f6-selector-antetitulo">{antetitulo}</span>
                  : (
                    <span className="pulso-f6-selector-antetitulo is-partido">
                      <span className="pulso-f6-selector-antetitulo-cede">{antetitulo.texto}</span>{" "}
                      <span className="pulso-f6-selector-antetitulo-fijo">{antetitulo.fijo}</span>
                    </span>
                  )}
                <Dialog.Title className="pulso-f6-selector-titulo">{titulo}</Dialog.Title>
                <Dialog.Description className="pulso-f6-selector-descripcion">{descripcion}</Dialog.Description>
              </div>
              {modo && <div className="pulso-f6-selector-modo">{modo}</div>}
              {buscador && <div className="pulso-f6-selector-buscador">{buscador}</div>}
              {accion && <div className="pulso-f6-selector-accion">{accion}</div>}
              <Dialog.Close className="pulso-f6-icono-boton pulso-f6-selector-cerrar" aria-label="Cerrar sin cambiar">
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div className="pulso-f6-selector-cuerpo" data-qa-geometry-group={`graficos/${auditReady}-columnas`} data-qa-geometry-contract="intrinsic">
              {/* La pregunta es un carril: su alto lo fija el diálogo (no las opciones que tenga) y su material propio
                  (fondo y borde) lo hace visible de arriba abajo. Con pocas opciones el espacio bajo la última es de
                  este carril; con muchas, el mismo carril desplaza (C3/C4). */}
              <div
                className="pulso-f6-selector-col is-pregunta"
                data-qa-geometry-member
                data-qa-geometry-capacity="owned"
                data-qa-scroll-owner={`${auditReady}-pregunta`}
              >
                {pregunta}
              </div>
              {comparacion ? (
                <div className="pulso-f6-selector-col is-comparar" data-qa-geometry-member data-qa-scroll-owner={`${auditReady}-comparar`}>
                  {comparacion}
                </div>
              ) : (
                <>
                  <div className="pulso-f6-selector-col is-galeria" data-qa-geometry-member data-qa-scroll-owner={`${auditReady}-galeria`}>{galeria}</div>
                  <div className="pulso-f6-selector-col is-detalle" data-qa-geometry-member data-qa-scroll-owner={`${auditReady}-detalle`}>{detalle}</div>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
