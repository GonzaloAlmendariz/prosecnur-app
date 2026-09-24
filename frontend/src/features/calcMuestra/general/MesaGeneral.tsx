import { CheckCircle2, Route } from "lucide-react";

import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { defaultComponente, type ComponentePatch } from "../sharedCore";
import { ArchivoMarcoGeneral } from "./ArchivoMarcoGeneral";
import { EncabezadoSeccion } from "./EncabezadoSeccion";
import { FichaEstudio } from "./FichaEstudio";
import { MarcoShapeSelector } from "./MarcoShapeSelector";
import type { MarcoOcasional } from "./marcoOcasional";
import { MetodoGeneral } from "./MetodoGeneral";
import { ResultadosComponentes } from "./ResultadosComponentes";
import { hayResultado } from "./secciones";
import { SeleccionGeneral } from "./SeleccionGeneral";
import { VariablesControl } from "./VariablesControl";

const SECCIONES = ["marco", "metodo", "seleccion", "resultados"];

/** Muestra general (modo `marco-disponible`): Marco, Método, Selección y Resultados. */
export function MesaGeneral({
  estudio,
  workspace,
  activeSection,
  onTitulo,
  onContexto,
  onPatchEstudio,
  onWorkspace,
  onComponente,
  onReplaceComponente,
  onEnsureKind,
  onCalcular,
  onMonitoreo,
  calculando,
  reporteListo,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  activeSection: string;
  onTitulo: (titulo: string) => void;
  onContexto: (campo: "cliente" | "tipo_cliente" | "descripcion_libre", valor: string) => void;
  onPatchEstudio: (patch: Partial<CalcMuestraEstudio>) => void;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
  onComponente: (id: string, patch: ComponentePatch) => void;
  onReplaceComponente: (comp: CalcMuestraComponente) => void;
  onEnsureKind: (kind: MarcoOcasional) => void;
  onCalcular: () => void;
  onMonitoreo: () => void;
  calculando: boolean;
  reporteListo: boolean;
}) {
  const comp = estudio.componentes[0] ?? defaultComponente();
  const selectedSection = SECCIONES.includes(activeSection) ? activeSection : "marco";
  const monitoreoListo = reporteListo || hayResultado(estudio.componentes);

  return (
    <div className="cmv2-desk">
      <EncabezadoSeccion modo="marco_disponible" seccion={selectedSection} />
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "marco" && (
          <div id="cmv2-section-general-marco" className="cmv2-tab-panel" role="tabpanel" aria-label="Marco">
            <div className="cmv2-desk-grid">
              <div className="cmv2-stack" data-qa-geometry-group="calc-muestra/general-marco" data-qa-geometry-contract="intrinsic">
                <MarcoShapeSelector selected={workspace.marco_disponible} onSelect={onEnsureKind} />
                <ArchivoMarcoGeneral componente={estudio.componentes[0] ?? null} />
                <VariablesControl workspace={workspace} onWorkspace={onWorkspace} />
              </div>
              <aside className="cmv2-side">
                <FichaEstudio variante="general" estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
              </aside>
            </div>
          </div>
        )}

        {selectedSection === "metodo" && (
          <MetodoGeneral
            comp={comp}
            calculando={calculando}
            onCalcular={onCalcular}
            onComponente={onComponente}
            onReplaceComponente={onReplaceComponente}
          />
        )}

        {selectedSection === "seleccion" && <SeleccionGeneral componente={estudio.componentes[0] ?? null} />}
        {selectedSection === "resultados" && (
          <div id="cmv2-section-general-resultados" className="cmv2-tab-panel" role="tabpanel" aria-label="Resultados" data-qa-geometry-group="calc-muestra/general-resultados" data-qa-geometry-contract="intrinsic">
            <ResultadosComponentes modo="marco_disponible" componentes={estudio.componentes} calculando={calculando} onCalcular={onCalcular} />
            <section className="cmv2-panel" aria-labelledby="cmg-propuesta-titulo">
              <div className="cmv2-panel-head">
                <span className="cmv2-eyebrow">Salida</span>
                <strong id="cmg-propuesta-titulo">Propuesta y traspaso</strong>
              </div>
              <textarea
                aria-label="Notas de la propuesta"
                value={workspace.notas_diseno}
                onChange={(e) => onWorkspace({ ...workspace, notas_diseno: e.currentTarget.value })}
                rows={5}
              />
              <div className="cmv2-inline-actions">
                <button type="button" className="cmv2-ghost" onClick={() => onPatchEstudio({ modo_trabajo: "diseno_validado" })}>
                  <CheckCircle2 size={14} aria-hidden="true" /> Marcar propuesta cerrada
                </button>
                <button type="button" className="cmv2-ghost" onClick={onMonitoreo} disabled={!monitoreoListo} aria-describedby={monitoreoListo ? undefined : "cmg-monitoreo-motivo"}>
                  <Route size={14} aria-hidden="true" /> Enviar a Monitoreo
                </button>
                {!monitoreoListo && <small id="cmg-monitoreo-motivo" className="cmg-motivo">Se habilita con un n calculado.</small>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
