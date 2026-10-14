// Contenido de «Listas de opciones» (H7). Didáctico: una línea dice para qué
// sirve unificar; cada escala repetida es una tarjeta con su nombre sugerido.
//
// Contrato de Superficie:
// - C1: `xlsform-listas-grupos`, `equal` —tarjetas de la misma variante—.
// - C2: las tarjetas pares comparten alto (`grid-auto-rows: 1fr`) y las
//   opciones se acotan a 8 chips; el marco no depende de cuántas haya.
// - C3: el vacío legítimo («No hay escalas repetidas») lo posee la sección.
// - C4: el scroll lo posee el cuerpo del diálogo, no este componente.

import { useState } from "react";
import { CheckCheck } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { ControlListasOpciones } from "./useListasOpciones";
import type { GrupoListasRepetidas } from "./listasModel";
import { GrupoListasCard } from "./GrupoListasCard";
import { ListaUnicaFila } from "./ListaUnicaFila";
import "./listas.css";

export const TEXTO_DIDACTICO_LISTAS =
  "Las escalas repetidas se pueden unificar en una sola lista con un nombre claro: así el formulario es más fácil de mantener y de leer.";

export function ListasOpcionesPanel({
  workbook,
  control,
}: {
  workbook: XlsformEditorWorkbook;
  control: ControlListasOpciones;
}) {
  const { analisis, aviso, unificar, renombrar } = control;
  const { grupos, unicas } = analisis;
  // Nombre pendiente por escala (lo que el analista escribió o la sugerencia):
  // vive aquí para validar cada escala contra las demás.
  const [editados, setEditados] = useState<Record<string, string>>({});
  const nombreDe = (grupo: GrupoListasRepetidas) => editados[claveGrupo(grupo)] ?? grupo.sugerencia;
  const pendientes = grupos.map((grupo) => nombreDe(grupo).trim());
  return (
    <div className="pulso-xf-listas">
      <p className="pulso-xf-listas-aviso" role="status" aria-live="polite">
        {aviso ?? ""}
      </p>
      <section className="pulso-xf-listas-seccion" aria-labelledby="xf-listas-repetidas">
        <h3 id="xf-listas-repetidas" className="pulso-xf-listas-subtitulo">
          Escalas repetidas
          <span className="pulso-xf-listas-contador">{grupos.length}</span>
        </h3>
        {grupos.length === 0 ? (
          <div className="pulso-xf-listas-vacio" data-qa-geometry-capacity="owned">
            <CheckCheck size={18} aria-hidden="true" />
            <p>
              <strong>No hay escalas repetidas.</strong>{" "}
              Cada lista de opciones del formulario es distinta de las demás.
            </p>
          </div>
        ) : (
          <div
            className="pulso-xf-listas-grupos"
            data-qa-geometry-group="xlsform-listas-grupos"
            data-qa-geometry-contract="equal"
          >
            {grupos.map((grupo, i) => (
              <GrupoListasCard
                key={claveGrupo(grupo)}
                grupo={grupo}
                workbook={workbook}
                nombre={nombreDe(grupo)}
                reservados={pendientes.filter((_, j) => j !== i)}
                onNombreChange={(valor) => setEditados((prev) => ({ ...prev, [claveGrupo(grupo)]: valor }))}
                onUnificar={unificar}
              />
            ))}
          </div>
        )}
      </section>
      <section className="pulso-xf-listas-seccion" aria-labelledby="xf-listas-unicas">
        <h3 id="xf-listas-unicas" className="pulso-xf-listas-subtitulo">
          Listas únicas
          <span className="pulso-xf-listas-contador">{unicas.length}</span>
        </h3>
        {unicas.length === 0 ? (
          <p className="pulso-xf-listas-nota">Todavía no hay listas sin repetir.</p>
        ) : (
          <ul className="pulso-xf-listas-unicas">
            {unicas.map((lista) => (
              <ListaUnicaFila
                key={lista.nombre}
                lista={lista}
                workbook={workbook}
                reservados={pendientes}
                onRenombrar={renombrar}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function claveGrupo(grupo: GrupoListasRepetidas): string {
  return `${grupo.firma}::${grupo.listas.join(",")}`;
}
