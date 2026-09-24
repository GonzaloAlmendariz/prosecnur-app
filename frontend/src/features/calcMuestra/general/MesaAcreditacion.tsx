import type { CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import type { ComponentePatch } from "../sharedCore";
import { ActoresAcreditacion } from "./ActoresAcreditacion";
import { BandaDisenoAcreditacion } from "./BandaDisenoAcreditacion";
import { estadoMesaAcreditacion } from "./bandaDisenoModelo";
import { ContextoReporte } from "./ContextoReporte";
import { EncabezadoSeccion } from "./EncabezadoSeccion";
import { FichaEstudio } from "./FichaEstudio";
import { ResultadosComponentes } from "./ResultadosComponentes";
import { SalidaReporte, type ReporteEstudio } from "./SalidaReporte";
import { SeleccionActores } from "./SeleccionActores";
import { useDisenoVigente } from "./useDisenoVigente";
import "./mesa.css";

const SECCIONES = ["actores", "contexto", "seleccion", "resultados"];

/**
 * Acreditación (modo `acreditacion`): Actores, Contexto, Selección y
 * Resultados. Misma cabecera que Muestra general: estado de la mesa con su
 * siguiente condición y la banda «Diseño vigente» con totales y actores.
 */
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
  reporte,
  onCambiarTipo,
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
  reporte: ReporteEstudio;
  onCambiarTipo: () => void;
}) {
  const selectedSection = SECCIONES.includes(activeSection) ? activeSection : "actores";
  const { cargado, marcos, corridas } = useDisenoVigente();
  const estado = estadoMesaAcreditacion({ componentes: estudio.componentes, corridas, marcos, cargado });
  // Ningún botón hijo le pasa su evento a `calcular`: la página lo leería
  // como el estudio a calcular y fallaría antes de pedir nada.
  const calcular = () => onCalcular();
  return (
    <div className="cmv2-desk cmg-mesa">
      <div className="cmg-cabecera" data-qa-geometry-group="calc-muestra/acreditacion-cabecera" data-qa-geometry-contract="intrinsic">
        <EncabezadoSeccion
          modo="acreditacion"
          seccion={selectedSection}
          estado={estado}
          onCalcular={calcular}
          calculando={calculando}
        />
        <BandaDisenoAcreditacion componentes={estudio.componentes} corridas={corridas} marcos={marcos} seccion={selectedSection} />
      </div>
      <div className="cmv2-university-workbench" data-active-section={selectedSection}>
        {selectedSection === "actores" && (
          <section
            id="cmv2-section-acreditacion-actores"
            className="cmv2-tab-panel"
            aria-labelledby="cmg-seccion-titulo"
            data-qa-geometry-group="calc-muestra/acreditacion-marco-actores"
            data-qa-geometry-contract="intrinsic"
          >
            <ActoresAcreditacion componentes={estudio.componentes} onComponente={onComponente} />
          </section>
        )}
        {selectedSection === "contexto" && (
          <section
            id="cmv2-section-acreditacion-contexto"
            className="cmv2-tab-panel"
            aria-labelledby="cmg-seccion-titulo"
            data-audit-ready="true"
            data-qa-geometry-group="calc-muestra/acreditacion-contexto"
            data-qa-geometry-contract="intrinsic"
          >
            <div
              className="cmg-contexto-grid"
              data-qa-geometry-group="calc-muestra/acreditacion-contexto-columnas"
              data-qa-geometry-contract="intrinsic"
            >
              <div className="cmg-contexto-ficha" data-qa-geometry-member>
                <FichaEstudio variante="acreditacion" estudio={estudio} workspace={workspace} onTitulo={onTitulo} onContexto={onContexto} onWorkspace={onWorkspace} onCambiarTipo={onCambiarTipo} />
              </div>
              <ContextoReporte estudio={estudio} workspace={workspace} componentes={estudio.componentes} />
            </div>
          </section>
        )}
        {selectedSection === "seleccion" && <SeleccionActores componentes={estudio.componentes} />}
        {selectedSection === "resultados" && (
          <section
            id="cmv2-section-acreditacion-resultados"
            className="cmv2-tab-panel"
            aria-labelledby="cmg-seccion-titulo"
            data-audit-ready="true"
            data-qa-geometry-group="calc-muestra/acreditacion-resultados"
            data-qa-geometry-contract="intrinsic"
          >
            <ResultadosComponentes modo="acreditacion" componentes={estudio.componentes} calculando={calculando} onCalcular={calcular} />
            <section className="cmv2-panel cmg-salida-acreditacion" aria-label="Reporte del diseño" data-qa-geometry-member>
              <SalidaReporte reporte={reporte} />
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
