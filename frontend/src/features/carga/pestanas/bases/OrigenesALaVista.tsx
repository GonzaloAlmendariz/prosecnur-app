// "Agregar una base desde" (prototipo "carga-bases"): los orígenes a la vista,
// bajo las bases. Cada uno abre el recorrido de alta ya en ese origen
// (`panel=agregar-base&foco=<origen>`). Sin bases son la pantalla entera
// (prototipo "carga-bases-vacio"). Con una base que ya tiene archivos, otra base
// pide elegir antes cómo se relacionan: el origen abre la relación entre bases.

import { useId } from "react";
import { Panel } from "../../../../components/Panel";
import { ClipboardCheck, CloudDownload, FileCheck2, FileUp, Layers, Upload, type LucideIcon } from "../../../../vendor/lucide-react";
import type { OpcionDeOrigen, OrigenDeAlta } from "./agregarBaseModel";

/** Los mismos íconos que el paso "Origen" del recorrido de alta. */
export const ICONO_DE_ALTA: Readonly<Record<OrigenDeAlta, LucideIcon>> = {
  formulario: FileCheck2,
  surveymonkey: CloudDownload,
  kobo: CloudDownload,
  archivos: Upload,
  sav: FileUp,
  monitoreo: ClipboardCheck,
  varias: Layers,
};

export function OrigenesALaVista({
  titulo,
  opciones,
  grandes,
  onElegir,
}: {
  /** "Agregar una base desde"; sin título cuando el panel ya lo dice. */
  titulo: string | null;
  opciones: readonly OpcionDeOrigen[];
  /** Sin bases: teselas grandes en tres columnas. */
  grandes: boolean;
  onElegir: (origen: OrigenDeAlta) => void;
}) {
  const id = useId();
  return (
    <section
      className="pulso-bases-agregar-desde"
      data-grandes={grandes ? "" : undefined}
      aria-labelledby={titulo ? id : undefined}
      aria-label={titulo ? undefined : "Orígenes de la base"}
    >
      {titulo ? <h4 id={id} className="pulso-bases-agregar-desde-titulo">{titulo}</h4> : null}
      <ul
        className="pulso-bases-origenes-vista"
        data-qa-geometry-group="carga/bases-origenes"
        data-qa-geometry-contract="equal"
      >
        {opciones.map((o) => {
          const Icono = ICONO_DE_ALTA[o.id];
          return (
            <li key={o.id} className="pulso-bases-origen-celda">
              <Panel noPadding className="pulso-bases-origen-tesela" data-qa-geometry-member="">
                <button
                  type="button"
                  className="pulso-bases-origen-vista"
                  data-origen={o.id}
                  aria-haspopup="dialog"
                  onClick={() => onElegir(o.id)}
                >
                  <Icono size={grandes ? 20 : 17} aria-hidden="true" />
                  <strong>{o.rotulo}</strong>
                  <small>{o.ayuda}</small>
                </button>
              </Panel>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
