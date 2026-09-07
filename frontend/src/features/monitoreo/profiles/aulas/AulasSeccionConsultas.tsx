import type { ReactNode } from "react";

import {
  apiMonitoreoAulasImportFromCalcMuestra,
  apiMonitoreoAulasConfig,
  apiMonitoreoAulasSync,
  apiMonitoreoState,
  type MonitoreoAulasConfig,
  type MonitoreoAulasDashboard,
  type MonitoreoAulasPlanRow,
  type MonitoreoRow,
  type MonitoreoSource,
  type MonitoreoState,
} from "../../../../api/client";
import { AulasAlcanceDelBanco } from "./AulasAlcanceDelBanco";
import { AulasBancoExtras } from "./AulasBancoExtras";
import { AulasCadenaChart } from "./AulasCadenaChart";
import { AulasCambioDeAula } from "./AulasCambioDeAula";
import { AulasColchonPorFacultad } from "./AulasColchonPorFacultad";
import { AulasConcentracionBrecha } from "./AulasConcentracionBrecha";
import { AulasEmbudoDelAula } from "./AulasEmbudoDelAula";
import { AulasHistoriaCadena } from "./AulasHistoriaCadena";
import { aulasKpis, fmt } from "./kpisDeAulas";
import { historiaDeCadena } from "./historiaDeCadena";
import { parteDeCampo } from "./parteDeCampo";
import { soloFacultad } from "./aulasPresentation";
import type { TablaDelPerfil } from "./tablaDelPerfil";

/**
 * La sección «consultas» del perfil de aulas.
 *
 * Corte de `renderAulasView`, que repartía las cuatro secciones y las ocho
 * pestañas en una sola función. La sección es la unidad natural: las pestañas
 * de dentro comparten cabeceras y condiciones, y partirlas por separado rompe
 * el reparto.
 */
export function AulasSeccionConsultas({
  dashboard, Tabla, pestana, reemplazosEnOrdenDeCadena,
  facultadEnFoco = undefined,
}: {
  dashboard: MonitoreoAulasDashboard;
  Tabla: TablaDelPerfil;
  pestana: string;
  reemplazosEnOrdenDeCadena: (filas: ReadonlyArray<Record<string, unknown>>) => Array<Record<string, unknown>>;
  /** B77: la facultad en foco de la cabecera; corta las listas de la sección. */
  facultadEnFoco?: string;
}): ReactNode {
    // Las tres listas van en paneles propios. Concatenadas producian una tabla
    // donde la misma aula salia hasta tres veces sin que ninguna columna dijera
    // de cual lista venia cada fila: 7 aulas se veian como 15 filas.
    // B77: el foco de facultad corta las fuentes de filas de la sección; el
    // cuadre del parte se filtra en sus INSUMOS para que sus contadores y sus
    // filas hablen del mismo subconjunto.
    const reemplazos = soloFacultad(reemplazosEnOrdenDeCadena(dashboard.reemplazos), facultadEnFoco);
    const brechas = soloFacultad((dashboard.brechas ?? []) as Array<Record<string, unknown>>, facultadEnFoco);
    const cuadre = parteDeCampo(
      soloFacultad((dashboard.partes_campo ?? []) as Array<Record<string, unknown>>, facultadEnFoco) as unknown as MonitoreoRow[],
      soloFacultad((dashboard.agenda ?? []) as Array<Record<string, unknown>>, facultadEnFoco) as unknown as MonitoreoRow[],
    );
    // El PLAN entero, no `reemplazos`: la historia y el gráfico necesitan también
    // los titulares que nunca necesitaron reserva, porque «146 no necesitaron
    // reemplazo» es parte de la respuesta.
    // El BANCO fuera de la agenda. Las aulas extra no cuelgan de ningún titular,
    // no tienen fecha y no están agendadas: son respaldo del estrato para cerrar
    // la cuota, y desde hace poco tienen su propia pestaña. Metidas aquí añadían
    // 40 filas sin fecha a una tabla de 196 que sí importan, y hacían que el
    // panel dijera «236 cursos-horario» dos dedos debajo de un KPI que decía
    // 196: la misma palabra con dos cifras.
    const agendaFilas = (soloFacultad((dashboard.agenda ?? []) as Array<Record<string, unknown>>, facultadEnFoco) as unknown as MonitoreoAulasPlanRow[])
      .filter((f) => String((f as { sample_role?: unknown }).sample_role ?? "") !== "extra_reserve_pool");
    // La MISMA función que escribe la lectura: el contador de la cabecera y el
    // renglón de abajo no pueden salir de dos cuentas distintas.
    const cadenas = historiaDeCadena(agendaFilas);
    // Cada pestaña muestra SU panel, y el reparto es POSITIVO. Con dos bastaba
    // negar la otra; con tres hubo que negar dos; con la cuarta —Extras— la
    // negación volvía a fallar y la cadena se pintaba encima. Preguntar «¿es
    // esta pestaña?» en vez de «¿no es ninguna de las otras?» hace que la
    // siguiente pestaña que se añada no herede el panel de nadie.
    const enParte = pestana === "parte";
    const enBrechas = pestana === "brechas";
    const enExtras = pestana === "extras";
    const enCadena = !enParte && !enBrechas && !enExtras;
  return (
      <div className="mon-profile-stack aulas-tablas-apiladas">
        {enCadena ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* Se queda: el libro no tiene hoja de cadena, la expresa por
                bloques —«APLICACIÓN DE REEMPLAZO n»— y por el valor «EN RESERVA
                n» de STATUS MUESTRA. El nombre de la vista es nuestro. */}
            <h3>Cadena de reemplazos</h3>
            {/* En CADENAS, que es la unidad de la lectura de abajo. Decía «50
                filas» dos renglones encima de «3 con un reemplazo · 21 sin
                cerrar», que suman 24: el mismo panel daba dos números para lo
                que se lee como la misma cosa. La cuenta sale de la MISMA función
                que escribe la lectura. */}
            <span>{(() => {
              const n = cadenas.historias.length;
              return n === 1 ? "1 cadena" : `${fmt(n)} cadenas`;
            })()}</span>
          </div>
          {/* Primero CÓMO se llegó —titular, su reemplazo, cuál cerró—, que es
              lo que se pregunta al cerrar el operativo; después cuánta reserva
              se gastó. La tabla de abajo queda como el detalle fila a fila. */}
          <AulasHistoriaCadena filas={agendaFilas} />
          {/* Sale del PLAN entero, no de `reemplazos`: esa lista sólo trae
              reservas y caídas, así que un titular sin ninguna reserva —el caso
              de L54— no aparecería y el gráfico diría que el plan tiene un
              colchón que no tiene. */}
          <AulasCadenaChart filas={agendaFilas} />
          {/* Y DÓNDE aguanta. El consumo de arriba es del operativo entero; la
              cuota, en cambio, es por facultad: veinte reservas libres no
              sirven si la facultad que perdió un aula tiene cero. */}
          <AulasColchonPorFacultad filas={agendaFilas} />
          {/* La tabla cambia de unidad y lo dice: la lectura cuenta cadenas y
              aquí va cada aula de esas cadenas, la que cayó y sus reservas. Sin
              este renglón, 24 arriba y 50 abajo se leen como una contradicción. */}
          <p className="mon-profile-muted">
            Cada cadena, aula por aula: la que cayó y sus reservas.
          </p>
          <Tabla
            rows={reemplazos}
            empty="Ningún curso-horario ha necesitado reemplazo."
            // El ORDEN y el ESTADO van delante del rol: con seis reservas del
            // mismo titular, «reemplaza a CH 1» y «Reserva encadenada» se repiten
            // en las seis filas, y lo que hay que ver es cuál sigue y cuáles ya
            // se usaron.
            // `motivo` y no `replacement_reason`: el motivo vive en un campo
            // distinto según el papel de la fila —la que cae lo lleva en
            // `replacement_reason` y la que entra en `activation_reason`—, así
            // que sobre las 26 filas de reserva esa columna era estructuralmente
            // vacía. El motor lo resuelve en una sola columna.
            preferredColumns={["operational_code", "faculty", "replacement_for", "replacement_order", "sample_status", "sample_role", "motivo"]}
          />
        </section>
        ) : null}
        {enBrechas ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* Se queda: la brecha la calcula el motor contra la meta; ninguna
                columna del libro la trae escrita. */}
            <h3>Cursos-horario con brecha</h3>
            {/* «Cursos-horario», no «filas»: el subtítulo de un panel nombra lo
                que hay dentro, y aquí coincide con el KPI «Brechas» de la banda
                —98 y 98—, así que la cuenta es completa y no esconde un recorte.
                En Resumen sí lo escondía: la tabla decía «500 filas» de un
                payload de 1.424. */}
            <span>{fmt(brechas.length)} cursos-horario</span>
          </div>
          {/* ¿Hay atajo? Una lista ordenada por brecha SUGIERE que las primeras
              concentran lo que falta, y puede ser al revés. Esto lo dice. */}
          <AulasConcentracionBrecha filas={(dashboard.brechas ?? []) as MonitoreoRow[]} />
          <Tabla
            rows={brechas}
            empty="Ningún curso-horario tiene brecha abierta."
            // Siete y se declaran: la octava la rellenaba el payload con
            // `classroom_id`, que en las 86 filas vale lo mismo que
            // `operational_code`. `faculty` entra a mano porque es el corte con
            // el que se reparte el trabajo, no porque toque por orden.
            preferredColumns={["operational_code", "label", "faculty", "respuestas_validas", "expected_valid", "brecha", "operational_status"]}
            maxColumns={7}
          />
        </section>
        ) : null}
        {enParte ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* «Partes de campo» y no «Aulas aplicadas (campo)», que es como se
                llama el panel del registro en Agenda: son dos superficies
                distintas sobre la misma hoja —allí se llena un parte, aquí se
                leen todos— y el guard de títulos rechaza que compartan nombre.
                Lo pilló al escribirlo. */}
            <h3>Partes de campo</h3>
            <span>{cuadre.label}</span>
          </div>
          {/* De qué hoja sale. Las otras dos superficies del libro llevan el
              nombre EXACTO de la suya —«Aulas agendadas» y «Base de control»,
              que es a lo que el equipo va a buscarlas—; ésta se llama «partes de
              campo», que es como se dice, y la hoja se llama «Aulas Aplicadas
              (Campo)». Sin decirlo, quien busca en su libro no sabe cuál abrir. */}
          <p className="mon-profile-muted">
            De la hoja «Aulas Aplicadas (Campo)» del libro: lo que anotó quien
            estuvo en el aula.
          </p>
          {/* La cadena del parte, SUMADA. Fila a fila no se ve que los
              duplicados pesen más que los rechazos. */}
          <AulasEmbudoDelAula filas={(dashboard.partes_campo ?? []) as MonitoreoRow[]} />
          {/* La resta ya viene hecha del motor —el mismo helper que decide el
              descuadre—, así que esta línea y el aviso de Validación no pueden
              discrepar. Es el destino que le faltaba a «Cuadre del parte de
              campo», que nombraba las aulas sin dar dónde mirarlas. */}
          {cuadre.descuadrados ? (
            <p className="aulas-parte-aviso">
              <strong>{fmt(cuadre.descuadrados)}</strong>{" "}
              {cuadre.descuadrados === 1 ? "parte no cuadra" : "partes no cuadran"}: asistentes
              menos rechazos y duplicados no dan las encuestas aplicadas que declara el parte. Se ven primero.
            </p>
          ) : null}
          {/* El cambio de aula va DESPUÉS del descuadre, no en medio.
              Metido entre el embudo y esta frase, partía la narración: el
              lector iba «5 390 → 4 865 → el equipo declaró 4 863, DOS MENOS» y
              se cruzaba con «30 aulas en otro salón» antes de leer la frase que
              explica esos dos. Son dos hechos del mismo parte, pero uno explica
              al anterior y el otro no. */}
          <AulasCambioDeAula
            partes={cuadre.filas as MonitoreoRow[]}
            plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          />
          <Tabla
            rows={cuadre.filas}
            empty="Todavía no se ha registrado ningún parte de campo."
            // SÓLO las columnas del parte, más el código para saber de qué aula
            // es. Añadir facultad, curso u horario la convertiría en una segunda
            // Agenda, y de eso ya hay una.
            // Nueve y no ocho: `% Asistencia` va pegada a los asistentes que
            // califica. Es el único de los once campos de la hoja que se leía y
            // no llegaba a ninguna pantalla, y es el número que dice si el 70 %
            // del padrón era alcanzable —con 55 % de asistencia no se llega ni
            // respondiendo todos los presentes—.
            // El parte dice DOS cosas y la tabla solo enseñaba una: la
            // aritmetica del cuadre. Lo otro —si se aplico, en que aula de
            // verdad, que dia y quien estuvo— es lo que el aplicador reporta y
            // solo vive en esta hoja. Va primero porque es lo que se pregunta
            // antes de mirar si las cuentas cuadran.
            maxColumns={14}
            // `field_note` = lo que el aplicador comentó de SU aplicación
            // (B42): plegada en su botón, no ocupa espacio de fila.
            preferredColumns={["operational_code", "faculty", "application_status", "actual_room", "applied_date", "applied_by", "observed_students", "attendance_pct", "refusals", "duplicates", "effective_surveys", "esperado", "diferencia", "field_note"]}
          />
        </section>
        ) : null}
        {enExtras ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-extras"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            {/* «Extras» es el nombre del dato: el plan las trae con
                `wave = "Extra"`. La descripción dice para qué sirven, que es lo
                que no se deduce del nombre —y que yo tenía mal: no reemplazan
                a nadie—. */}
            {/* NO «… por facultad»: choca con «Cuota sexo por facultad» y el
                guard de títulos lo caza. Dos paneles que terminan igual se
                confunden en el rail y en el historial de navegación. */}
            <h3>Cursos-horario extra disponibles</h3>
            <span>{fmt(dashboard.banco_extras?.total ?? 0)} extras</span>
          </div>
          <p className="mon-profile-muted">
            No reemplazan a ningún curso-horario: son cursos-horario adicionales
            para cerrar la cuota de hombres y mujeres de cada facultad.
          </p>
          {/* **Antes del inventario, no después.** La frase de arriba dice que
              estas aulas existen para cerrar la cuota; lo primero que hay que
              saber es si la cierran. Puesto debajo quedaba tras una tabla de 73
              filas, y la respuesta se leía al final del catálogo —el mismo orden
              que la Base de control ya sigue: veredicto, después detalle—. En el
              mismo panel porque es una sola decisión. */}
          <AulasAlcanceDelBanco
            banco={dashboard.banco_extras ?? null}
            control={(dashboard.control_calidad ?? []) as Array<Record<string, unknown>>}
            quotas={(dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>}
            agenda={(dashboard.agenda ?? []) as MonitoreoRow[]}
            partes={(dashboard.partes_campo ?? []) as MonitoreoRow[]}
          />
          <AulasBancoExtras banco={dashboard.banco_extras ?? null} />
        </section>
        ) : null}
      </div>
  );
}
