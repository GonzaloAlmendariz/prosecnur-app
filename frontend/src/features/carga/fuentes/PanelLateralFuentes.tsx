// Marco lateral de los paneles de Carga › Fuentes («Ver armonización»,
// «Comparar fuentes»). Radix Dialog da nombre accesible, Esc, trampa de
// tabulador y foco inicial; al cerrar, el foco vuelve al botón que lo abrió
// (`[data-plf-abrir="<clave>"]`), que para entonces la dirección ya olvidó.
//
// C2: el panel mide el alto de la ventana y un ancho fijo por viewport.
// C4: un único dueño de scroll, `.pulso-plf-cuerpo`; la cabecera queda fuera.

import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { X } from "../../../vendor/lucide-react";
import "./panelLateralFuentes.css";

export type PanelLateralFuentesProps = {
  panel: ControlPanel;
  /** Rótulo pequeño sobre el título: el módulo o la superficie de origen. */
  antetitulo: string;
  titulo: string;
  descripcion?: ReactNode;
  /** Bajo la cabecera, fuera del scroll (selectores, leyenda). */
  barra?: ReactNode;
  /** `false` sólo mientras carga: un terminal sin contenido publica `vacio:<motivo>`. */
  auditReady: string;
  /** Clave del disparador al que vuelve el foco al cerrar («armonizacion:<base>», «comparar:<base>»). */
  claveDisparador: string | null;
  ancho?: "medio" | "ancho";
  onCerrar: () => void;
  children: ReactNode;
};

export function PanelLateralFuentes({
  panel,
  antetitulo,
  titulo,
  descripcion,
  barra,
  auditReady,
  claveDisparador,
  ancho = "medio",
  onCerrar,
  children,
}: PanelLateralFuentesProps) {
  const ultimaClave = useRef<string | null>(null);
  const estabaAbierto = useRef(false);
  if (panel.abierto && !estabaAbierto.current) {
    // Al abrir por click, el disparador es el elemento activo; por enlace, la clave.
    const activo = typeof document !== "undefined" ? document.activeElement : null;
    ultimaClave.current = (activo instanceof HTMLElement ? activo.dataset.plfAbrir : undefined) ?? claveDisparador;
  }
  estabaAbierto.current = panel.abierto;
  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-plf-velo" />
        <Dialog.Content
          className={ancho === "ancho" ? "pulso-plf is-ancho" : "pulso-plf"}
          {...panel.props}
          data-audit-ready={auditReady}
          // Sin descripción, Radix no debe apuntar a un id que no existe.
          {...(descripcion ? {} : { "aria-describedby": undefined })}
          onCloseAutoFocus={(event) => {
            const clave = ultimaClave.current;
            if (!clave) return;
            const candidatos = Array.from(document.querySelectorAll<HTMLElement>("[data-plf-abrir]"));
            // La clave exacta («comparar:<base>») y, si no está, su familia («comparar»).
            const familia = clave.split(":")[0];
            const disparador = candidatos.find((el) => el.dataset.plfAbrir === clave)
              ?? candidatos.find((el) => el.dataset.plfAbrir === familia);
            if (!disparador) return;
            event.preventDefault();
            disparador.focus();
          }}
        >
          <header className="pulso-plf-cabecera">
            <div className="pulso-plf-titular">
              <div className="pulso-plf-titulos">
                <p className="pulso-plf-antetitulo">{antetitulo}</p>
                <Dialog.Title className="pulso-plf-titulo">{titulo}</Dialog.Title>
              </div>
              <Dialog.Close className="pulso-plf-cerrar" aria-label="Cerrar">
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            {descripcion ? <Dialog.Description className="pulso-plf-descripcion">{descripcion}</Dialog.Description> : null}
            {barra}
          </header>
          <div className="pulso-plf-cuerpo">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
