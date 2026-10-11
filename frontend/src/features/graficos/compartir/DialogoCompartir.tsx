// Marco de los diálogos «Plan portátil» y «Secciones JSON» que abre el menú ⋯ de la barra de Láminas (decisión 10).
// Diálogo modal de Radix conectado a `?panel=`: Escape y el velo cierran, el foco entra en la primera acción y vuelve al
// botón ⋯ al cerrar. Se monta dentro de `.pulso-graficos-frame` para heredar los estilos del cuerpo compartido con el
// Editor anterior; el cuerpo es el único dueño del desplazamiento (C4).

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, RefObject } from "react";
import { AlertCircle, Check, X } from "../../../vendor/lucide-react";
import "./compartir.css";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  panelProps: { "data-pulso-panel": string };
  /** Clave de readiness y de superficie (`graficos/<clave>`). */
  clave: string;
  titulo: string;
  descripcion: string;
  /** Dónde se monta el portal (el marco de Gráficos); `null` lo monta en `body`. */
  contenedor: HTMLElement | null;
  /** Adónde vuelve el foco al cerrar (el disparador ⋯, que sobrevive al menú). */
  retornoRef: RefObject<HTMLElement>;
  mensaje: string;
  error: string;
  children: ReactNode;
};

export function DialogoCompartir({
  abierto, onCerrar, panelProps, clave, titulo, descripcion, contenedor, retornoRef, mensaje, error, children,
}: Props) {
  return (
    <Dialog.Root modal open={abierto} onOpenChange={(siguiente) => { if (!siguiente && abierto) onCerrar(); }}>
      <Dialog.Portal container={contenedor ?? undefined}>
        <Dialog.Overlay className="pulso-f6-compartir-velo" />
        <Dialog.Content
          {...panelProps}
          className="pulso-f6-compartir-dialogo"
          data-audit-ready={clave}
          data-qa-surface={`graficos/${clave}`}
          aria-modal="true"
          onCloseAutoFocus={(e) => {
            const destino = retornoRef.current;
            if (destino) {
              e.preventDefault();
              destino.focus();
            }
          }}
        >
          <header className="pulso-f6-compartir-cabecera">
            <div className="pulso-f6-compartir-titulos">
              <Dialog.Title className="pulso-f6-compartir-titulo">{titulo}</Dialog.Title>
              <Dialog.Description className="pulso-f6-compartir-descripcion">{descripcion}</Dialog.Description>
            </div>
            <Dialog.Close className="pulso-f6-icono-boton" aria-label="Cerrar">
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div
            className="pulso-f6-compartir-cuerpo"
            data-qa-scroll-owner={`${clave}-cuerpo`}
            data-qa-geometry-group={`graficos/${clave}-cuerpo`}
            data-qa-geometry-contract="intrinsic"
          >
            <div data-qa-geometry-member>{children}</div>
          </div>
          <footer className="pulso-f6-compartir-pie">
            <span role="status" className="pulso-f6-compartir-estado">
              {mensaje && <><Check size={12} aria-hidden="true" /> {mensaje}</>}
            </span>
            {error && (
              <span role="alert" className="pulso-f6-compartir-error">
                <AlertCircle size={12} aria-hidden="true" /> {error}
              </span>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
