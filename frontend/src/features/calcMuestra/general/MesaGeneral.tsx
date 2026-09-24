import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { defaultComponente, type ComponentePatch } from "../sharedCore";
import { ArchivoMarcoGeneral } from "./ArchivoMarcoGeneral";
import { BandaDisenoGeneral } from "./BandaDisenoGeneral";
import { estadoMesaGeneral } from "./bandaDisenoModelo";
import { EncabezadoSeccion } from "./EncabezadoSeccion";
import { FichaEstudio } from "./FichaEstudio";
import { MarcoShapeSelector } from "./MarcoShapeSelector";
import type { MarcoOcasional } from "./marcoOcasional";
import { MetodoGeneral } from "./MetodoGeneral";
import { PropuestaTraspaso } from "./PropuestaTraspaso";
import { ResultadosComponentes } from "./ResultadosComponentes";
import { hayResultado } from "./secciones";
import { SeleccionGeneral } from "./SeleccionGeneral";
import { useDisenoVigente } from "./useDisenoVigente";
import { VariablesControl } from "./VariablesControl";
import "./mesa.css";

const SECCIONES = ["marco", "metodo", "seleccion", "resultados"];

/**
 * Muestra general (modo `marco-disponible`): Marco, Método, Selección y
 * Resultados. Arriba, una cabecera única: la sección con el estado de la mesa
 * y su siguiente condición, y la banda «Diseño vigente». Cada sección es una
 * región con nombre (su H2), no un `tabpanel` sin pestaña que lo controle.
 */
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
  const primero = estudio.componentes[0] ?? null;
  const selectedSection = SECCIONES.includes(activeSection) ? activeSection : "marco";
  const monitoreoListo = reporteListo || hayResultado(estudio.componentes);
  const { cargado, marcos, corridas } = useDisenoVigente();
  const marco = primero ? marcos[primero.id] ?? null : null;
  const corrida = primero ? corridas[primero.id] ?? null : null;
  const estado = estadoMesaGeneral({ comp: primero, marco, corrida, cargado });
  // Ningún botón hijo le pasa su evento a `calcular`: la página lo leería
  // como el estudio a calcular y fallaría antes de pedir nada.
  const calcular = () => onCalcular();

  return (
    <div className="cmv2-desk cmg-mesa">
      <div className="cmg-cabecera" data-qa-geometry-group="calc-muestra/general-cabecera" data-qa-geometry-contract="intrinsic">
        <EncabezadoSeccion
          modo="marco_disponible"
          seccion={selectedSection}
          estado={estado}
          onCalcular={calcular}
          calculando={calculando}
        />
        <BandaDisenoGeneral comp={primero} marco={marco} corrida={corrida} seccion={selectedSection} />
      </div>
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "marco" && (
          <section id="cmv2-section-general-marco" className="cmv2-tab-panel" aria-labelledby="cmg-seccion-titulo">
            <div className="cmv2-desk-grid">
              <div className="cmv2-stack" data-qa-geometry-group="calc-muestra/general-marco" data-qa-geometry-contract="intrinsic">
                <MarcoShapeSelector selected={workspace.marco_disponible} onSelect={onEnsureKind} />
                <ArchivoMarcoGeneral componente={primero} />
                <VariablesControl workspace={workspace} onWorkspace={onWorkspace} />
              </div>
              <aside className="cmv2-side" aria-label="Ficha del estudio">
                <FichaEstudio variante="general" estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} />
              </aside>
            </div>
          </section>
        )}

        {selectedSection === "metodo" && (
          <MetodoGeneral
            comp={comp}
            calculando={calculando}
            onCalcular={calcular}
            onComponente={onComponente}
            onReplaceComponente={onReplaceComponente}
          />
        )}

        {selectedSection === "seleccion" && <SeleccionGeneral componente={estudio.componentes[0] ?? null} />}
        {selectedSection === "resultados" && (
          <section
            id="cmv2-section-general-resultados"
            className="cmv2-tab-panel"
            aria-labelledby="cmg-seccion-titulo"
            data-audit-ready="true"
            data-qa-geometry-group="calc-muestra/general-resultados"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="cmg-resultados-grid" data-qa-geometry-group="calc-muestra/general-resultados-columnas" data-qa-geometry-contract="intrinsic">
              <ResultadosComponentes modo="marco_disponible" componentes={estudio.componentes} calculando={calculando} onCalcular={calcular} />
              <PropuestaTraspaso
                notas={workspace.notas_diseno}
                cerrada={estudio.modo_trabajo === "diseno_validado"}
                monitoreoListo={monitoreoListo}
                onNotas={(notas) => onWorkspace({ ...workspace, notas_diseno: notas })}
                onCerrar={() => onPatchEstudio({ modo_trabajo: "diseno_validado" })}
                onMonitoreo={onMonitoreo}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
