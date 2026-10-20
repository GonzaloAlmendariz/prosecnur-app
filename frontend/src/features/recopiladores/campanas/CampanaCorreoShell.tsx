// La campaña de correo abierta (ADR 0111 §3): una sección —el correo— con su
// editor; identidad, destinatarios, plataforma, envíos, revisión e importar
// son paneles del editor. Una sección de una sola pestaña no dibuja rail ni
// selector de secciones: un ítem no es una elección. Tampoco lleva banda de
// módulo propia: la miga de la campaña vive en la única barra del correo, así
// el cuerpo del correo gana el alto (pedido de Gonzalo, 2026-10-20).

import { useState, type ReactNode } from "react";

import { PageFrame } from "../../../components/PageFrame";
import { CorreosEditor } from "../correos/CorreosEditor";
import type { AccionesDeCampanas } from "../correos/useCampanas";
import "../styles/recopiladores-shell.css";

type Props = {
  nombre: string;
  cabecera: ReactNode;
  campanasAcc: AccionesDeCampanas;
  onStateRefresh: () => void | Promise<void>;
};

export function CampanaCorreoShell({ nombre, cabecera, campanasAcc, onStateRefresh }: Props) {
  const [cargando, setCargando] = useState(true);
  return (
    <PageFrame
      title={`Correo · ${nombre}`}
      lead="El correo de la campaña, sus envíos y su salida para la plataforma."
      layout="workbench"
      scrollOwner="panels"
      bodyMode="fill"
      headerMode="sr-only"
      auditReady={cargando ? false : "material-campo/correo/editor"}
      className="rec-page"
    >
      <div className="rec-workbench">
        <section
          className="rec-tab-panel"
          aria-label={`Correo ${nombre}`}
          data-qa-geometry-group="material-campo/correo"
          data-qa-geometry-contract="intrinsic"
        >
          <CorreosEditor onCargando={setCargando} onStateRefresh={onStateRefresh} campanasAcc={campanasAcc} cabecera={cabecera} />
        </section>
      </div>
    </PageFrame>
  );
}
