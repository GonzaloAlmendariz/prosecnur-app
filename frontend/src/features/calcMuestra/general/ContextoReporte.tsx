import { CheckCircle2, CircleDot } from "lucide-react";
import { Link } from "react-router-dom";

import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../api/calcMuestra";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { BarraTasa } from "../universidad/shared/graficos/PrimitivasGrafico";
import { requisitosReporteAcreditacion } from "./bandaDisenoModelo";
import "./mesa.css";

/**
 * Acreditación › Contexto: lo que el reporte necesita y cuánto de eso ya está.
 * No repite los valores del formulario de al lado: dice qué falta y, cuando
 * se completa en otra sección, enlaza a ella.
 */
export function ContextoReporte({
  estudio,
  workspace,
  componentes,
}: {
  estudio: CalcMuestraEstudio;
  workspace: CalcMuestraWorkspace;
  componentes: readonly CalcMuestraComponente[];
}) {
  const nav = useSeccion("calc-muestra");
  const requisitos = requisitosReporteAcreditacion({
    titulo: estudio.titulo ?? "",
    institucion: estudio.contexto?.cliente ?? "",
    fuente: workspace.fuente_marco ?? "",
    alcance: estudio.contexto?.descripcion_libre ?? "",
    componentes,
  });
  const listos = requisitos.filter((r) => r.listo).length;

  return (
    <section className="cmv2-panel cmg-contexto-reporte" aria-labelledby="cmg-contexto-reporte-titulo" data-qa-geometry-member>
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Reporte</span>
          <h3 id="cmg-contexto-reporte-titulo" className="cmg-panel-titulo">Lo que el reporte necesita</h3>
        </div>
      </div>
      <BarraTasa
        label="Listo"
        detalle={`${listos} de ${requisitos.length}`}
        valor={requisitos.length > 0 ? listos / requisitos.length : null}
        tono="meta"
      />
      <ul
        className="cmg-requisitos"
        data-qa-geometry-group="calc-muestra/acreditacion-requisitos-reporte"
        data-qa-geometry-contract="equal"
      >
        {requisitos.map((r) => {
          const Icono = r.listo ? CheckCircle2 : CircleDot;
          return (
            <li key={r.clave} className="cmg-requisito" data-listo={r.listo ? "true" : "false"}>
              <Icono size={14} aria-hidden="true" />
              <span className="cmg-requisito-etiqueta">{r.etiqueta}</span>
              <span className="cmg-requisito-estado">{r.estado}</span>
              {!r.listo && r.seccion ? (
                <Link className="cmg-requisito-ir" to={nav.hrefDe("seccion", r.seccion)}>
                  {r.seccion === "actores" ? "Ir a Actores" : "Ir a Resultados"}
                </Link>
              ) : <span aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
