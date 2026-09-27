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
import { pestanaPorDefectoMarco } from "./modeloPestanas";
import { PestanasMesa } from "./PestanasMesa";
import { PropuestaTraspaso } from "./PropuestaTraspaso";
import { SalidaReporte, type ReporteEstudio } from "./SalidaReporte";
import { ResultadosComponentes } from "./ResultadosComponentes";
import { encabezadoDeSeccion, hayResultado } from "./secciones";
import { SeleccionGeneral } from "./SeleccionGeneral";
import { useDisenoVigente } from "./useDisenoVigente";
import { usePestanaMesa } from "./usePestanaMesa";
import { VariablesControl } from "./VariablesControl";
import "./mesa.css";
import "./escala.css";

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
  reporte,
  onCambiarTipo,
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
  reporte: ReporteEstudio;
  onCambiarTipo: () => void;
}) {
  const comp = estudio.componentes[0] ?? defaultComponente();
  const primero = estudio.componentes[0] ?? null;
  const selectedSection = SECCIONES.includes(activeSection) ? activeSection : "marco";
  const monitoreoListo = reporteListo || hayResultado(estudio.componentes);
  const { cargado, marcos, corridas } = useDisenoVigente();
  const marco = primero ? marcos[primero.id] ?? null : null;
  const corrida = primero ? corridas[primero.id] ?? null : null;
  const estado = estadoMesaGeneral({ comp: primero, marco, corrida, cargado });
  // La pestaña vive en la dirección; con el marco declarado, Marco abre en su
  // archivo (P3). Selección y Método abren en su primera pestaña.
  const pestanaMesa = usePestanaMesa(
    "marco_disponible",
    selectedSection,
    selectedSection === "marco" ? pestanaPorDefectoMarco(Boolean(marco)) : null,
  );
  const pestana = pestanaMesa.activa;
  // Ningún botón hijo le pasa su evento a `calcular`: la página lo leería
  // como el estudio a calcular y fallaría antes de pedir nada.
  const calcular = () => onCalcular();

  return (
    <div className="cmv2-desk cmg-mesa" data-seccion={selectedSection}>
      <div className="cmg-cabecera" data-qa-geometry-group="calc-muestra/general-cabecera" data-qa-geometry-contract="intrinsic">
        <EncabezadoSeccion
          modo="marco_disponible"
          seccion={selectedSection}
          pestana={pestana || null}
          estado={estado}
        />
        <BandaDisenoGeneral comp={primero} marco={marco} corrida={corrida} seccion={selectedSection} />
      </div>
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection !== "resultados" && (
          <PestanasMesa
            grupo="general"
            seccion={selectedSection}
            tituloSeccion={encabezadoDeSeccion("marco_disponible", selectedSection).titulo}
            pestanas={pestanaMesa.pestanas}
            activa={pestana}
            onElegir={pestanaMesa.elegir}
            listo={cargado}
          >
            {selectedSection === "marco" && (
              <section id="cmv2-section-general-marco" className="cmv2-tab-panel" aria-labelledby="cmg-seccion-titulo">
                <div className="cmv2-stack" data-qa-geometry-group="calc-muestra/general-marco" data-qa-geometry-contract="intrinsic">
                  {pestana === "marco-forma" && <MarcoShapeSelector selected={workspace.marco_disponible} onSelect={onEnsureKind} />}
                  {pestana === "marco-archivo" && <ArchivoMarcoGeneral componente={primero} />}
                  {pestana === "marco-ficha" && (
                    <div className="cmg-ficha-estudio" data-qa-geometry-group="calc-muestra/general-ficha-estudio" data-qa-geometry-contract="intrinsic">
                      <FichaEstudio variante="general" estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} onCambiarTipo={onCambiarTipo} />
                      <VariablesControl workspace={workspace} onWorkspace={onWorkspace} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {selectedSection === "metodo" && (
              <MetodoGeneral
                comp={comp}
                pestana={pestana}
                calculando={calculando}
                onCalcular={calcular}
                onComponente={onComponente}
                onReplaceComponente={onReplaceComponente}
              />
            )}

            {selectedSection === "seleccion" && <SeleccionGeneral componente={estudio.componentes[0] ?? null} pestana={pestana} />}
          </PestanasMesa>
        )}
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
              >
                <SalidaReporte reporte={reporte} />
              </PropuestaTraspaso>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
