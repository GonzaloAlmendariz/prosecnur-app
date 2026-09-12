import { useState, type ReactNode } from "react";

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
import { useMarcarRefuerzo } from "./useMarcarRefuerzo";
import "./aulasRefuerzosPedidos.css";
import { AulasEleccionPorFacultad } from "./AulasEleccionPorFacultad";
import { AulasRefuerzosPedidos } from "./AulasRefuerzosPedidos";
import { AulasRepartoDelTecho } from "./AulasRepartoDelTecho";
import { AulasBrechasDelCorte } from "./AulasBrechasDelCorte";
import { AulasLlamadaDeFacultad } from "./AulasLlamadaDeFacultad";
import { AulasComoVaCadaFacultad } from "./AulasComoVaCadaFacultad";
import { AulasPopoverReemplazo } from "./AulasPopoverReemplazo";
import { AulasPopoverRefuerzo } from "./AulasPopoverRefuerzo";
import { AulasTresCaminos } from "./AulasTresCaminos";
import { alertaDeAnticipacion } from "./alertaDeAnticipacion";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { brechaDeLaFacultad, cuotaDeLaFacultad } from "./brechaDeLaFacultad";
import { deficitOperativo } from "./deficitOperativo";
import { AulasCadenaChart } from "./AulasCadenaChart";
import { AulasCambioDeAula } from "./AulasCambioDeAula";
import { AulasColchonPorFacultad } from "./AulasColchonPorFacultad";
import { AulasEmbudoDelAula } from "./AulasEmbudoDelAula";
import { AulasFichaDeCursoHorario } from "./AulasFichaDeCursoHorario";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { AulasHistoriaCadena } from "./AulasHistoriaCadena";
import { AulasPartesQueNoCuadran } from "./AulasPartesQueNoCuadran";
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
  facultadEnFoco = undefined, onGuardado, foco = null, onFoco,
}: {
  dashboard: MonitoreoAulasDashboard;
  Tabla: TablaDelPerfil;
  pestana: string;
  reemplazosEnOrdenDeCadena: (filas: ReadonlyArray<Record<string, unknown>>) => Array<Record<string, unknown>>;
  /** B77: la facultad en foco de la cabecera; corta las listas de la sección. */
  facultadEnFoco?: string;
  /**
   * Recarga la vista tras marcar un complemento o un refuerzo. Sin esto, el
   * aula se queda en el plan con su estado nuevo y la pantalla sigue
   * ofreciéndola como disponible hasta el siguiente refresco.
   */
  onGuardado?: () => void;
  /**
   * El foco de la dirección (`?foco=aula:CH 21`). Aquí lo consume «Buscar por
   * código»: es el mismo mecanismo con el que la dirección abre el Registro de
   * campo sobre un aula, y la ficha era la única superficie del perfil que no
   * lo usaba.
   */
  foco?: FocoDeCuota;
  /** Para que la dirección siga al curso-horario que la ficha está enseñando. */
  onFoco?: (foco: FocoDeCuota) => void;
}): ReactNode {
  /**
   * **Marcar es de B y de C, nunca de A.** Gonzalo, 2026-09-11: «el popover
   * necesita operar sobre B y C porque A se aplica desde el mismo Sheets sin
   * ayuda de la app, la app solo lo lee».
   *
   * El aula queda en REFUERZO POR CONTACTAR —no en agendada— porque nadie la ha
   * llamado todavía. Ojo: hoy eso se ve SOLO aquí. El morado existe en la paleta
   * del Sheets, pero se pinta en «Aulas Agendadas» y «Aulas Aplicadas (Campo)»,
   * que son del equipo y la app no toca.
   */
  /**
   * **La llamada vive en `useMarcarRefuerzo` y no aquí.** La comparte con el
   * reparto del techo de la pestaña Refuerzos, y la copia que había en esta
   * hoja tenía un defecto que sólo se ve al buscarle el consumidor: guardaba el
   * mensaje del motor en un estado **que ningún JSX pintaba**. Quien marcaba
   * veía cerrarse el popover y nada más —ni confirmación, ni el motivo cuando
   * el motor la rechazaba—.
   */
  const marca = useMarcarRefuerzo(onGuardado);
  const marcar = marca.marcar;
    /**
     * **Qué curso-horario tiene el popover abierto.** Es estado de la sección y
     * no dirección: no abre una vista nueva ni cambia lo que se lee, elige a
     * quién se le está buscando relevo. Mismo trato que el mando de escenario de
     * Metas.
     *
     * El hook va ARRIBA del todo, antes de cualquier salida temprana: uno
     * colocado bajo la guarda de pestaña se llama en unos renders y no en
     * otros, y eso es el React #310 que ya tumbó este perfil una vez.
     */
    const [relevoDe, setRelevoDe] = useState<string>("");
    /**
     * **La segunda puerta del libro.** `relevoDe` abre el complemento (B) desde
     * un aula que se quedó corta; `refuerzoDe` abre el refuerzo (C) desde una
     * facultad que no va a cerrar su cuota. Son dos decisiones distintas con
     * criterios distintos —parecido contra cuota— y por eso dos superficies.
     */
    const [refuerzoDe, setRefuerzoDe] = useState<string>("");
    // Las tres listas van en paneles propios. Concatenadas producian una tabla
    // donde la misma aula salia hasta tres veces sin que ninguna columna dijera
    // de cual lista venia cada fila: 7 aulas se veian como 15 filas.
    // B77: el foco de facultad corta las fuentes de filas de la sección; el
    // cuadre del parte se filtra en sus INSUMOS para que sus contadores y sus
    // filas hablen del mismo subconjunto.
    const reemplazos = soloFacultad(reemplazosEnOrdenDeCadena(dashboard.reemplazos), facultadEnFoco);
    /**
     * **Las brechas, enriquecidas con su fila del plan.**
     *
     * `dashboard.brechas` publica doce columnas y le faltan justo las que esta
     * tabla necesita para decidir: `eligible_n`, el horario y las dos tasas. Sin
     * ellas, «Cuándo» y «Rinde» salían en «—» en las 136 filas —medido en
     * pantalla el 2026-09-11, «de — previsto» en todas—, y «Rinde» es la
     * columna que separa el curso-horario que se quedó corto del que es más
     * grande que el promedio de su facultad.
     *
     * Se enriquece en vez de sustituir la fuente: el criterio de qué entra en
     * la lista y cuántas son lo decide el motor, y cambiarlo por un filtro
     * propio sobre `agenda` daría otro recuento sin que nadie lo pidiera. Lo
     * que se añade son columnas de la MISMA fila, emparejada por su código.
     */
    const brechas = (() => {
      const plan = new Map<string, Record<string, unknown>>();
      for (const f of (dashboard.agenda ?? []) as Array<Record<string, unknown>>) {
        const c = String(f.operational_code ?? f.classroom_id ?? "").trim();
        if (c) plan.set(c, f);
      }
      const crudas = soloFacultad((dashboard.brechas ?? []) as Array<Record<string, unknown>>, facultadEnFoco);
      return crudas.map((b) => {
        const suya = plan.get(String(b.operational_code ?? b.classroom_id ?? "").trim());
        // La fila de brechas manda sobre la del plan: su `brecha` y su
        // `respuestas_validas` son las que el motor publicó para esta lista.
        return suya ? { ...suya, ...b } : b;
      });
    })();
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
    const enFicha = pestana === "ficha";
    const enParte = pestana === "parte";
    const enBrechas = pestana === "brechas";
    const enExtras = pestana === "extras";
    const enRefuerzos = pestana === "refuerzos";
    const enCadena = !enFicha && !enParte && !enBrechas && !enExtras && !enRefuerzos;
  return (
      <div className="mon-profile-stack aulas-tablas-apiladas">
        {enFicha ? (
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-consultas"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Buscar por código</h3>
              <span>un curso-horario del plan · su estado, sus encuestas y su efectividad</span>
            </div>
            {/* El PLAN entero y SIN el filtro de facultad en foco: quien busca un
                código quiere encontrarlo, y no hallarlo por un filtro puesto en
                otra pestaña se lee como «no existe». */}
            <AulasFichaDeCursoHorario
              // SIN el prefijo: el foco viaja como `aula:CH 1` y el
              // `operational_code` es `CH 1`. Pasarlo crudo no casa nunca —ya
              // pasó en `RegistroDeCampo`— y la ficha se queda vacía sin decir
              // por qué.
              codigoEnFoco={foco?.tipo === "aula" ? foco.valor : ""}
              onElegir={(codigo) => onFoco?.({ tipo: "aula", valor: codigo })}
              agenda={(dashboard.agenda ?? []) as Array<Record<string, unknown>>}
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
              bandas={(dashboard.dos_tasas?.aulas ?? []) as Array<Record<string, unknown>>}
              // La CUARTA fuente. Se llama `control_calidad` en el tablero, no
              // `control`: buscarla por el nombre de la hoja no la encuentra.
              control={(dashboard.control_calidad ?? []) as Array<Record<string, unknown>>}
            />
          </section>
        ) : null}
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
            {/* **De qué tipo es lo que se decide aquí.** Gonzalo, 2026-09-10:
                «en Consultas mapeamos las nuevas aulas a aplicar el ABC, aunque
                el A se hace más en el Sheets de agendación pero el B y el C
                desde la app».
                Esta pantalla es el camino del REEMPLAZO (A) —el titular cayó y
                entra su relevo— y del COMPLEMENTO (B) —el titular se queda y se
                le suma uno—. Sin nombrarlo, las tres superficies de Consultas
                se parecen y no se sabe cuál lleva a qué decisión. */}
            <span>
              {(() => {
                const n = cadenas.historias.length;
                return n === 1 ? "1 cadena" : `${fmt(n)} cadenas`;
              })()}
              {" · "}de aquí salen el reemplazo (A) y el complemento (B)
            </span>
          </div>
          {/* Primero CÓMO se llegó —titular, su reemplazo, cuál cerró—, que es
              lo que se pregunta al cerrar el operativo; después cuánta reserva
              se gastó. La tabla de abajo queda como el detalle fila a fila. */}
          <AulasHistoriaCadena filas={agendaFilas} onRelevo={(codigo) => setRelevoDe(codigo)} />
          {/* Sale del PLAN entero, no de `reemplazos`: esa lista sólo trae
              reservas y caídas, así que un titular sin ninguna reserva —el caso
              de L54— no aparecería y el gráfico diría que el plan tiene un
              colchón que no tiene. */}
          <AulasCadenaChart filas={agendaFilas} />
          {/* Y DÓNDE aguanta. El consumo de arriba es del operativo entero; la
              cuota, en cambio, es por facultad: veinte reservas libres no
              sirven si la facultad que perdió un aula tiene cero. */}
          <AulasColchonPorFacultad filas={agendaFilas} />
        </section>
        ) : null}
        {enBrechas ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-consultas"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Qué pasó, y por dónde se sale</h3>
            <span>el vocabulario del libro · reemplazo (A), complemento (B), refuerzo (C)</span>
          </div>
          {/* Cierra el circuito de la pestaña: arriba se decide a quién meter,
              aquí se ve qué dio meterlo. Y con las dos varas separadas, que era
              lo que faltaba: «hay que diferenciar qué tan bien nos fue en esa
              aula […] y cómo esa aula nos ayudó, porque esa aula no estaba
              prevista». */}
          <AulasTresCaminos
            filas={(dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[]}
            porTipo={(dashboard.reemplazos_por_tipo ?? null) as Record<string, unknown> | null}
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
            <h3>Deuda por sexo, facultad a facultad</h3>
            <span>el mapa de la deuda · pulsa una facultad para ver qué la hundió</span>
          </div>
          {/* **El contexto va ANTES de la tabla, no después.**

              Gonzalo, 2026-09-10, sobre lo que había aquí: «este embudo raro que
              has hecho de los cinco con más brecha, los diez, los veinte… eso ni
              siquiera estaba planteado en el artefacto; en el artefacto tenías un
              mapa de ejes de cuál faltaba más, si faltaba más en hombres o en
              mujeres».

              Tenía razón en las dos mitades. El embudo contestaba «¿hay atajo?»,
              que es una pregunta sobre la FORMA de la lista y no sobre el campo:
              saber que los diez peores concentran el 28 % no dice a quién llamar.
              El mapa sí: sitúa cada facultad en su cuadrante y separa la que debe
              en los dos sexos de la que sólo debe en uno —el caso que la cifra
              global esconde—, y al pulsarla abre su fila. Es el índice con el que
              se entra a la tabla que va debajo. */}
          <AulasComoVaCadaFacultad
            bloque={dashboard.efectividad_seguimiento}
            porSexo={(dashboard.efectividad_por_sexo ?? []) as Array<Record<string, unknown>>}
            facultadEnFoco={facultadEnFoco}
            onRefuerzo={(f) => setRefuerzoDe(f)}
            // La serie por jornada: «una foto no dice el rumbo».
            partes={(dashboard.partes_campo ?? []) as MonitoreoRow[]}
            plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
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
            <span>
              {fmt(brechas.length)} cursos-horario
              {" · "}el diagnóstico que decide si toca complemento (B) o refuerzo (C)
            </span>
          </div>
          {/* **La tabla genérica se fue el 2026-09-10.** Enseñaba siete columnas
              del payload —`operational_status`, `expected_valid`— y ninguna
              contestaba la pregunta con la que se entra: ¿esto es grave, y qué
              hago con ello? Gonzalo, sobre ella: «esas tablas de la aplicación
              se ven mal», y sobre el ensayo: «el diseño que tú has generado del
              artefacto es el que tiene que tener».

              Lo que cambia no es la pintura: la severidad se mide contra la
              tasa prevista de SU facultad, el aula sin aplicar deja de contarse
              como que rindió cero, y cada fila sale al popover con el verbo que
              le toca. `AulasAvancePorCurso` sigue siendo la tabla para buscar
              una fila concreta; ésta es para decidir. */}
          <AulasBrechasDelCorte
            filas={brechas as unknown as MonitoreoAulasPlanRow[]}
            onRelevo={(codigo) => setRelevoDe(codigo)}
          />
          {/* **El refuerzo no sale de una fila.** Es la nota del ensayo: cuando
              la brecha es de la facultad, ninguna aula la explica, y esa entrada
              va abajo y separada. Meterla dentro de la tabla pediría colgarle la
              acción a una fila arbitraria.

              Sin facultad en foco se elige la que más debe, que es de la que
              alguien querría salir a reforzar al mirar esta tabla. */}
          {(() => {
            const cuotas = (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>;
            const candidata = facultadEnFoco || (() => {
              let peor = "";
              let cuanto = 0;
              for (const f of new Set(brechas.map((b) => String((b as Record<string, unknown>).faculty ?? "")))) {
                if (!f) continue;
                const d = brechaDeLaFacultad(cuotas, f);
                const suma = d ? Math.max(0, d.mujeres) + Math.max(0, d.hombres) : 0;
                if (suma > cuanto) { cuanto = suma; peor = f; }
              }
              return peor;
            })();
            if (!candidata) return null;
            const suyas = brechas.filter(
              (b) => String((b as Record<string, unknown>).faculty ?? "") === candidata);
            const mayor = suyas.reduce(
              (n, b) => Math.max(n, Math.round(Number((b as Record<string, unknown>).brecha) || 0)), 0);
            return (
              <AulasLlamadaDeFacultad
                facultad={candidata}
                deuda={brechaDeLaFacultad(cuotas, candidata)}
                mayorBrecha={mayor}
                onRefuerzo={(f) => setRefuerzoDe(f)}
              />
            );
          })()}
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
          {/* El plan va con los partes para poder poner el escalón del PADRÓN
              encima del de asistencia: el parte trae `observed_students` pero no
              de cuántos había convocados, y eso vive en el plan. */}
          <AulasEmbudoDelAula
            filas={(dashboard.partes_campo ?? []) as MonitoreoRow[]}
            plan={(dashboard.agenda ?? []) as MonitoreoRow[]}
          />
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
          {/* **Los que no cuadran, antes del censo.** La frase de arriba dice
              cuántos son; esto dice CUÁLES y por cuánto, con la resta hecha. La
              tabla se queda debajo: noventa partes son un censo y para un censo
              sirve, pero la pregunta de la pestaña no se contesta leyendo
              catorce columnas. */}
          <AulasPartesQueNoCuadran filas={cuadre.filas as MonitoreoRow[]} />
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
            <span>
              {fmt(dashboard.banco_extras?.total ?? 0)} extras
              {" · "}de aquí sale el refuerzo (C)
            </span>
          </div>
          <p className="mon-profile-muted">
            No reemplazan a ningún curso-horario: son cursos-horario adicionales
            para cerrar la cuota de hombres y mujeres de cada facultad. Salir a
            uno es el <strong>refuerzo (C)</strong>, y esa decisión se toma
            aquí, en la app; el reemplazo (A) se resuelve en el Sheets de
            agendación.
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
          <AulasBancoExtras banco={dashboard.banco_extras ?? null} facultadEnFoco={facultadEnFoco} />
        </section>
        ) : null}

        {enRefuerzos ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-refuerzos"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Refuerzos dentro del techo</h3>
            <span>
              cuántos cursos-horario más se pueden agendar · a qué facultad va cada uno
            </span>
          </div>
          {/* **La continuación de Extras.** Allí está el inventario; aquí, qué
              conviene pedir de él. El reparto vivía en Resumen y Gonzalo lo
              movió el 2026-09-11: «los refuerzos deberían tener su propia
              pestaña en Consultas luego de la pestaña Extras». En Resumen
              competía con otros ocho paneles y, sobre todo, allí no cabían sus
              acciones: elegir el techo y marcar. */}
          <AulasRepartoDelTecho
            bloque={dashboard.efectividad_seguimiento}
            celdasDeCuota={(dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>}
            // El plan ENTERO, sin el filtro de facultad: el reparto compara
            // facultades entre sí para decidir a cuál le rinde más cada aula, y
            // con una sola en foco no habría reparto que hacer.
            plan={(dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[]}
            onGuardado={onGuardado}
          />
        </section>
        ) : null}
        {enRefuerzos ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-refuerzos-eleccion"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Tomar refuerzos de una en una</h3>
            <span>se entra por la facultad que peor está y la cola se rehace tras cada elección</span>
          </div>
          {/* **El otro modo de gastar el techo, y no sustituye al de arriba.**
              Gonzalo, 2026-09-11: «podemos ir seleccionando de uno en uno y el
              top se actualiza tomando en cuenta que si escogemos uno el
              traslape podría aumentar para el resto». El reparto propone un
              lote entero por utilidad; esto decide una a una, y tras cada
              elección la cola se rehace. Va DESPUÉS del reparto porque el
              reparto es la lectura con la que se entra: dónde rinde más el
              techo antes de repartirlo a mano. */}
          <AulasEleccionPorFacultad
            bloque={dashboard.efectividad_seguimiento}
            celdasDeCuota={(dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>}
            plan={(dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[]}
            onGuardado={onGuardado}
          />
        </section>
        ) : null}
        {enRefuerzos ? (
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-refuerzos-pedidos"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Refuerzos pedidos</h3>
            <span>a dónde fue lo marcado y en qué punto está su gestión</span>
          </div>
          {/* La respuesta a «qué pasa cuando ya selecciones uno, a dónde se va»
              (Gonzalo, 2026-09-11). En panel aparte del reparto y no dentro de
              él: uno decide y el otro rinde cuentas, y mezclarlos haría que la
              lista de candidatas y la de pedidas se lean como una sola. */}
          <AulasRefuerzosPedidos
            plan={(dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[]}
            onGuardado={onGuardado}
          />
        </section>
        ) : null}

        {/* **El acuse de la marca, que antes no se pintaba.** El popover se
            cierra al elegir, así que sin esto la única señal de que el motor
            contestó era que la fila cambiaba de sitio en otra pestaña. */}
        {marca.aviso || marca.fallos.length ? (
          <p className={`aulas-acuse-marca${marca.fallos.length ? " es-fallo" : ""}`} role="status">
            {marca.aviso}
            {marca.fallos.length ? (
              <>No se pudo marcar <b>{marca.fallos.map((f) => f.codigo).join(", ")}</b>:{" "}
                {marca.fallos[0]?.motivo}</>
            ) : null}
            {" "}<button type="button" onClick={marca.limpiar}>Entendido</button>
          </p>
        ) : null}

        {/* **El popover de candidatos, ahora también en Consultas.** Existía
            desde antes y sólo se abría al registrar lo que pasó en el aula
            —Modelo › Agenda—, que es donde se anota, no donde se decide.
            Gonzalo, 2026-09-10: «muéstrame la app donde tomo las decisiones por
            facultad para B y C». Aquí es.

            Recibe el plan ENTERO y no el recorte de la facultad en foco: los
            candidatos de un curso-horario son los de su cadena, y si el foco
            estuviera puesto en otra facultad no habría ninguno. El filtro por
            facultad ya lo hace el propio motor de candidatos, que nunca sale de
            la del aula que releva. */}
        {relevoDe ? (() => {
          const todas = (dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[];
          const caido = todas.find((f) =>
            String(f.operational_code ?? "").trim() === relevoDe
            || String(f.classroom_id ?? "").trim() === relevoDe);
          if (!caido) return null;
          return (
            <AulasPopoverReemplazo
              abierto
              caido={caido}
              filas={todas}
              // Lo que le falta a SU facultad, por sexo: es contra lo que se
              // elige, y el motor ya lo tiene por celda.
              // **`quotas_sex_faculty` y no `avance_sexo_facultad`.** El
              // segundo trae `brecha`, que es lo que faltará AL CIERRE
              // proyectando todo el plan: en este corte vale 0 en las treinta
              // celdas —«llega con todo el plan, con margen»— y con eso la
              // ayuda de cada candidato se apagaba entera. Lo que decide a
              // quién meter es lo que falta HOY, que es `missing`, y ése vive
              // en las cuotas. Es el mismo bloque que lee Registro de campo.
              brecha={brechaDeLaFacultad(
                (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                String(caido.faculty ?? ""),
              )}
              // El plazo sale del MISMO sitio que la tabla «Cuándo pedir aula
              // adicional» de Resumen y que el popover de refuerzo: dos fechas
              // distintas para el mismo día útil es la avería más cara de este
              // perfil.
              pedirAntesDe={alertaDeAnticipacion(
                proyeccionPorAgenda(
                  (dashboard.agenda ?? []) as MonitoreoRow[],
                  (dashboard.partes_campo ?? []) as MonitoreoRow[],
                  (dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[],
                ),
                dashboard.banco_extras?.por_facultad ?? [],
              ).find((a) => a.facultad === String(caido.faculty ?? ""))?.pedirAntesDe ?? null}
              // **Aquí conviven A y B, y sólo B se marca.** Si el titular cayó
              // —rechazo o reemplazada— esto es un reemplazo (A), y A se aplica
              // en el Sheets: la app sólo lo lee. Si el titular sigue en pie y
              // lo que se busca es sumar, es un complemento (B) y sí se marca.
              onElegir={(fila) => {
                const cayo = /^(rechaz|reemplazada)/.test(
                  String(caido.sample_status ?? "").trim().toLowerCase());
                if (!cayo) {
                  void marcar(String(fila.operational_code ?? ""), "complemento",
                              String(caido.operational_code ?? ""));
                }
                setRelevoDe("");
              }}
              onCerrar={() => setRelevoDe("")}
            />
          );
        })() : null}

        {/* **El refuerzo (C), abierto desde una facultad.** Toma el plan entero
            —el motor acota a la facultad por su cuenta, que es la frontera
            dura— y la deuda de esa facultad de las mismas cuotas que usa el
            complemento, para que las dos puertas midan contra el mismo número. */}
        {refuerzoDe ? (() => {
          // El plazo sale del mismo sitio que la tabla «Cuándo pedir aula
          // adicional» de Resumen, no de una segunda cuenta: dos fechas
          // distintas para el mismo día útil es la avería más cara del perfil.
          const alerta = alertaDeAnticipacion(
            proyeccionPorAgenda(
              (dashboard.agenda ?? []) as MonitoreoRow[],
              (dashboard.partes_campo ?? []) as MonitoreoRow[],
              (dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[],
            ),
            dashboard.banco_extras?.por_facultad ?? [],
          ).find((a) => a.facultad === refuerzoDe);
          return (
            <AulasPopoverRefuerzo
              facultad={refuerzoDe}
              filas={(dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[]}
              deuda={brechaDeLaFacultad(
                (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                refuerzoDe,
              ) ?? { mujeres: 0, hombres: 0 }}
              // La meta y lo logrado, para que la cifra se explique sola y no
              // parezca contradecir al ranking del que se viene.
              cuota={cuotaDeLaFacultad(
                (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                refuerzoDe,
              )}
              // **Lo que ya viene descontado, y el marco del plan.** El déficit
              // sin descontar lo agendado manda a reforzar facultades que ya
              // están cubiertas, y eso gasta una reserva que otra necesita.
              deficit={(() => {
                const c = cuotaDeLaFacultad(
                  (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                  refuerzoDe,
                );
                return c
                  ? deficitOperativo(
                    c,
                    (dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[],
                    refuerzoDe,
                  )
                  : undefined;
              })()}
              pedirAntesDe={alerta?.pedirAntesDe ?? null}
              // **C se marca desde aquí.** Antes sólo cerraba y la decisión se
              // perdía. Ahora el aula queda en REFUERZO POR CONTACTAR —no
              // agendada, que nadie la ha llamado—, visible en la app.
              onElegir={(fila) => {
                void marcar(String(fila.operational_code ?? ""), "refuerzo", refuerzoDe);
                setRefuerzoDe("");
              }}
              onCerrar={() => setRefuerzoDe("")}
            />
          );
        })() : null}
      </div>
  );
}
