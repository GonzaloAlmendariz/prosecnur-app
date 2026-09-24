import type { CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import type { ComponentePatch } from "../sharedCore";
import { ActoresAcreditacion } from "./ActoresAcreditacion";
import { EncabezadoSeccion } from "./EncabezadoSeccion";
import { FichaEstudio } from "./FichaEstudio";
import { ResultadosComponentes } from "./ResultadosComponentes";
import { SeleccionActores } from "./SeleccionActores";

const SECCIONES = ["actores", "contexto", "seleccion", "resultados"];

/** Acreditación (modo `acreditacion`): Actores, Contexto, Selección y Resultados. */
export function MesaAcreditacion({
  estudio,
  workspace,
  activeSection,
  onTitulo,
  onContexto,
  onWorkspace,
  onComponente,
  onCalcular,
  calculando,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  activeSection: string;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onCalcular: () => void;
  calculando: boolean;
}) {
  const selectedSection = SECCIONES.includes(activeSection) ? activeSection : "actores";
  return (
    <div className="cmv2-desk">
      <EncabezadoSeccion modo="acreditacion" seccion={selectedSection} />
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "actores" && (
          <div id="cmv2-section-acreditacion-actores" className="cmv2-tab-panel" role="tabpanel" aria-label="Actores" data-qa-geometry-group="calc-muestra/acreditacion-marco-actores" data-qa-geometry-contract="intrinsic">
            <ActoresAcreditacion componentes={estudio.componentes} onComponente={onComponente} />
          </div>
        )}
        {selectedSection === "contexto" && (
          <div id="cmv2-section-acreditacion-contexto" className="cmv2-tab-panel" role="tabpanel" aria-label="Contexto" data-qa-geometry-group="calc-muestra/acreditacion-contexto" data-qa-geometry-contract="intrinsic">
            <FichaEstudio variante="acreditacion" estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
          </div>
        )}
        {selectedSection === "seleccion" && <SeleccionActores componentes={estudio.componentes} />}
        {selectedSection === "resultados" && (
          <div id="cmv2-section-acreditacion-resultados" className="cmv2-tab-panel" role="tabpanel" aria-label="Resultados" data-qa-geometry-group="calc-muestra/acreditacion-resultados" data-qa-geometry-contract="intrinsic">
            <ResultadosComponentes modo="acreditacion" componentes={estudio.componentes} calculando={calculando} onCalcular={onCalcular} />
          </div>
        )}
      </div>
    </div>
  );
}
