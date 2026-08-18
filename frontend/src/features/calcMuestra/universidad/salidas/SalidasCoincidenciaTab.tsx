/**
 * Pestaña "Coincidencia" (id `salidas-coincidencia`), la primera de Entrega.
 *
 * Gonzalo la pidió acá y no en Marco, textual: «no sé si la información deba ser
 * mostrada en Marco, parece algo más apropiado al cierre en Entrega **para ver
 * si todo coincide**, no sé qué hace en Marco cuando aún ni definimos los
 * criterios de estudiantes o de cursos horarios». Tenía razón y estaba medido:
 * en Marco las fichas salían vacías porque las cuentas por facultad no existen
 * hasta que el motor resuelve los estratos.
 *
 * Acá sí existen, y la pregunta que contesta la pestaña es una sola: **¿esto
 * coincide con el estudio anterior, en números y en método?** Arriba lo que rige
 * para todas las facultades; debajo la ficha de cada una con sus criterios
 * propios y sus seis cuentas. Las dos con la columna de 2025 al lado.
 */
import type { CalcMuestraReferenciaCriterios } from "../../../../api/calcMuestra";
import { CriteriosGeneralesCard, type CriterioGeneralFila } from "../criterios/CriteriosGeneralesCard";
import { FichaPorFacultadCard } from "../criterios/FichaPorFacultadCard";
import type { FichaFacultad } from "../criterios/fichaFacultadModel";

export function SalidasCoincidenciaTab({
  criteriosGenerales,
  criteriosMarco,
  fichas,
  referencia,
}: {
  criteriosGenerales: CriterioGeneralFila[];
  criteriosMarco: CriterioGeneralFila[];
  fichas: FichaFacultad[];
  referencia: CalcMuestraReferenciaCriterios | null;
}) {
  // Sin encabezado propio: la barra de pestañas ya dice «Coincidencia · criterios
  // y cuentas contra el estudio anterior», y repetirlo debajo con un parrafo mas
  // largo es texto que nadie lee dos veces.
  return (
    <section className="cmv2-coincidencia" aria-label="Coincidencia con el estudio anterior">
      <CriteriosGeneralesCard filas={criteriosGenerales} referencia={referencia} />
      {/* Los criterios del MARCO, que son los que deciden qué aulas entran. La
          tarjeta de arriba compara el DISEÑO; esto es el método. */}
      <CriteriosGeneralesCard
        titulo="Los criterios que arman el marco"
        subtitulo="qué aulas entran: modalidad, sesión, nivel, mínimo y exclusiones"
        filas={criteriosMarco}
        referencia={referencia}
      />
      <FichaPorFacultadCard fichas={fichas} periodo={referencia?.periodo ?? ""} />
    </section>
  );
}
