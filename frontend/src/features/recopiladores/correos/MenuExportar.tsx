// «Exportar ▾» en la barra del correo (revisión de usabilidad, F7).
//
// Antes la salida era un pie fijo del inspector de ≈360 px que crecía al
// aparecer el ZIP: el alto del marco lo decidía el contenido (C2) y le quitaba
// alto a la pestaña abierta. Ahora vive en la barra, como las demás acciones
// del correo: la principal según la plataforma, una línea de para qué sirve
// cada salida, dónde se pega y el ZIP listo para descargar.
//
// Es un panel efímero (popover): no escribe la dirección. Al pedir un archivo
// el menú se cierra y la espera y el archivo quedan en el contenedor del kit de
// entregables, anclado bajo «Exportar» (ADR 0133, forma anclada, como el menú
// «Exportar» de Gráficos): el resultado se ve sin reabrir el menú.

import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import type { MailPlatform } from "../../../api/materialMail";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { Generacion } from "../../../components/entregables/useGeneracion";
import { ChevronDown, Upload } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA } from "./dialectos";
import "../styles/entregas.css";
import "./correosExportar.css";

type Props = {
  plataforma: MailPlatform;
  abierto: boolean;
  onAbierto: (abierto: boolean) => void;
  /** Hay un paquete armado en esta vista: el botón lo dice sin abrir el menú. */
  listo: boolean;
  /** La generación en curso o su archivo (`useGeneracion` del editor): se dibuja anclada al disparador. */
  generacion: Pick<Generacion, "estado" | "cerrar">;
  /** Lo que el archivo listo dice en palabras (p. ej. si trae datos personales). */
  pie?: ReactNode;
  children: ReactNode;
};

export function MenuExportar({ plataforma, abierto, onAbierto, listo, generacion, pie, children }: Props) {
  const generando = generacion.estado.fase === "en_curso";
  return (
    <span className="rec-entrega-anclaje">
      <Popover.Root open={abierto} onOpenChange={onAbierto}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`rec-barra-exportar${abierto ? " is-on" : ""}`}
            // Mientras se genera, el disparador sólo se deshabilita: la espera la dice el contenedor.
            disabled={generando}
            aria-label={`Exportar para ${NOMBRE_DE_PLATAFORMA[plataforma]}${listo ? " (paquete listo)" : ""}`}
            title={`Lo que se lleva a ${NOMBRE_DE_PLATAFORMA[plataforma]}`}
          >
            <Upload size={14} aria-hidden />
            <span className="rec-barra-exportar-rotulo">Exportar</span>
            {listo ? <span className="rec-barra-exportar-listo" aria-hidden /> : null}
            <ChevronDown size={14} aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="rec-exp"
            align="end"
            sideOffset={6}
            collisionPadding={12}
            aria-label={`Exportar para ${NOMBRE_DE_PLATAFORMA[plataforma]}`}
          >
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <ContenedorEntregable
        estado={generacion.estado}
        forma="anclada"
        onCerrar={generacion.cerrar}
        pie={generacion.estado.fase === "lista" ? pie : undefined}
      />
    </span>
  );
}
