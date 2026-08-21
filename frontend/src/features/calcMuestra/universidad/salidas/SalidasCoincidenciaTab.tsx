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
import type {
  CalcMuestraAulasSelection,
  CalcMuestraCertificacionFacultad,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraReferenciaCriterios,
} from "../../../../api/calcMuestra";
import { CriteriosGeneralesCard, type CriterioGeneralFila } from "../criterios/CriteriosGeneralesCard";
import { EmbudoComparadoFacultades } from "./EmbudoComparadoFacultades";
import { pasosComparables } from "./embudoComparadoModel";
import { CertificacionFacultadCard } from "../aulas/CertificacionFacultadCard";
import { SeleccionComparadaCard } from "./SeleccionComparadaCard";
import { FichaPorFacultadCard } from "../criterios/FichaPorFacultadCard";
import type { FichaFacultad } from "../criterios/fichaFacultadModel";
import "./coincidencia.css";

export function SalidasCoincidenciaTab({
  criteriosGenerales,
  criteriosMarco,
  fichas,
  referencia,
  certificacion = null,
  referenciaAsistencia = null,
  seleccion = null,
}: {
  criteriosGenerales: CriterioGeneralFila[];
  criteriosMarco: CriterioGeneralFila[];
  fichas: FichaFacultad[];
  referencia: CalcMuestraReferenciaCriterios | null;
  /** El estudio anterior (asistencia), para el cumplimiento por sexo ref. */
  referenciaAsistencia?: CalcMuestraReferenciaAsistencia | null;
  /** El sello de la selección vigente, en modo lectura: la Entrega muestra
   *  la garantía junto a la coincidencia (la ACCIÓN vive en Selección). */
  certificacion?: CalcMuestraCertificacionFacultad | null;
  /** La selección vigente: alimenta «la selección nueva contra lo aplicado». */
  seleccion?: CalcMuestraAulasSelection | null;
}) {
  // ¿Las tres tarjetas del grupo del resultado van a devolver null? Se calcula
  // con las MISMAS condiciones con que ellas se rinden —fichas para el embudo,
  // filas para la certificación, selección para el rendimiento comparado— en
  // vez de adivinarlo: si alguna cambia su condición, este cálculo se queda
  // corto y el test de abajo lo dice.
  // Cada condición se toma de la MISMA función con que la tarjeta decide
  // rendirse, no de una paráfrasis: el embudo exige `pasosComparables`, no
  // sólo fichas —medido: con 17 fichas y sin selección seguía sin pintar—, y
  // una paráfrasis que dijera «hay fichas» dejaría el rótulo colgando igual.
  const grupoResultadoVacio =
    pasosComparables(fichas).length === 0 &&
    !(certificacion && Array.isArray(certificacion.filas) && certificacion.filas.length > 0) &&
    !(seleccion && Array.isArray(seleccion.selection) && seleccion.selection.length > 0);

  // Sin encabezado propio: la barra de pestañas ya dice «Coincidencia · criterios
  // y cuentas contra el estudio anterior», y repetirlo debajo con un parrafo mas
  // largo es texto que nadie lee dos veces.
  return (
    <section className="cmv2-coincidencia" aria-label="Coincidencia con el estudio anterior">
      {/* Tres grupos rotulados (revamp 2026-08-19): el método, el resultado y
          el detalle. Antes las seis tarjetas iban apiladas al mismo nivel y la
          página no tenía dónde apoyar la vista. */}
      <div className="cmv2-coincidencia-grupo" aria-label="El método">
        <h3 className="cmv2-coincidencia-rotulo">El método, contra el estudio anterior</h3>
        <CriteriosGeneralesCard filas={criteriosGenerales} referencia={referencia} />
        {/* Los criterios del MARCO, que son los que deciden qué aulas entran.
            La tarjeta de arriba compara el DISEÑO; esto es el método. */}
        <CriteriosGeneralesCard
          titulo="Los criterios que arman el marco"
          subtitulo="qué aulas entran: modalidad, sesión, nivel, mínimo y exclusiones"
          filas={criteriosMarco}
          referencia={referencia}
        />
      </div>
      <div className="cmv2-coincidencia-grupo" aria-label="El resultado">
        <h3 className="cmv2-coincidencia-rotulo">Lo que produce la selección</h3>
        {/* Medido en vivo con un proyecto sin selección: las tres tarjetas de
            abajo devuelven null y el grupo quedaba en 13 px de alto — un
            rótulo que anuncia contenido seguido de nada. Un vacío se declara,
            no se deja en blanco (C3). */}
        {grupoResultadoVacio && (
          <p className="cmv2-coincidencia-vacio" role="note">
            Todavía no hay nada que comparar acá: este bloque muestra el embudo por facultad, la
            garantía de la selección y su rendimiento esperado, y los tres se construyen sobre una
            selección corrida. Sale de <i>Selección → Cursos-horario titulares</i>.
          </p>
        )}
        {/* El gráfico que faltaba: las quince facultades, hoy contra 2025, a la
            misma escala y paso por paso. Va antes de las fichas porque es el
            vistazo; la ficha es el detalle de una facultad. */}
        <EmbudoComparadoFacultades fichas={fichas} periodo={referencia?.periodo ?? ""} />
        {/* La garantía de la selección vigente cierra el relato: coincide con
            2025 Y cumple sus propias metas. Solo lectura — la acción «+1 aula»
            vive en Selección, donde se decide. */}
        <CertificacionFacultadCard certificacion={certificacion} referencia={referenciaAsistencia} />
        {/* El rendimiento comparado: lo que la selección nueva ESPERA (con las
            tasas del año anterior) contra lo que el año anterior LOGRÓ. */}
        <SeleccionComparadaCard
          seleccion={seleccion}
          referencia={referenciaAsistencia}
          periodo={referencia?.periodo ?? ""}
        />
      </div>
      <div className="cmv2-coincidencia-grupo" aria-label="El detalle por facultad">
        <h3 className="cmv2-coincidencia-rotulo">El detalle, facultad por facultad</h3>
        <FichaPorFacultadCard fichas={fichas} periodo={referencia?.periodo ?? ""} />
      </div>
    </section>
  );
}
