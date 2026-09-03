import type { ReactNode } from "react";

import {
  aulasFieldLabel,
  escalaDeProporciones,
  presentAulasRow,
  soloFacultad,
  summarizeAulasValidation,
} from "./aulasPresentation";
import { AulasCadenaDeFiltros } from "./AulasCadenaDeFiltros";
import { AulasControlDelLibro, type ResumenDeControl } from "./AulasControlDelLibro";
import { AulasControles } from "./AulasControles";
import { AulasFichaDeAula } from "./AulasFichaDeAula";
import { AulasLoQueFalta } from "./AulasLoQueFalta";
import { AulasObservacionesDeCampo } from "./AulasObservacionesDeCampo";
import { AulasParteContraPlataforma } from "./AulasParteContraPlataforma";
import { AulasTextoAbierto } from "./AulasTextoAbierto";
import { AulasTiemposDeRespuesta } from "./AulasTiemposDeRespuesta";
import { AulasTrabajoDeLosEquipos } from "./AulasTrabajoDeLosEquipos";
import { columnasDeLaTabla } from "./columnasDeLaTabla";
import { contar } from "../../fuentes/vocabulario";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * La sección «calidad» del perfil de aulas.
 *
 * Corte de `renderAulasView`, que repartía las cuatro secciones y las ocho
 * pestañas en una sola función. La sección es la unidad natural: las pestañas
 * de dentro comparten cabeceras y condiciones, y partirlas por separado rompe
 * el reparto.
 */
export function AulasSeccionCalidad({
  dashboard, criterioDeAula, facultadEnFoco, foco, irAPestana, onDeclararUmbralDeDuracion, onFoco, pestana, registro,
}: {
  dashboard: MonitoreoAulasDashboard;
  criterioDeAula: ReactNode;
  facultadEnFoco: string | undefined;
  foco: FocoDeCuota;
  /** Nulo mientras la página no sepa a dónde llevar; el panel lo contempla. */
  irAPestana: ((clave: string) => void) | null;
  onDeclararUmbralDeDuracion: ((minutos: number) => void | Promise<void>) | null;
  onFoco: (foco: FocoDeCuota) => void;
  pestana: string;
  registro: ReactNode;
}): ReactNode {
    // **El registro de campo abre Validación.**
    //
    // Estaba en «Agenda de cursos-horario», que es otro trabajo: agendar es
    // conseguir la cita y el control de campo empieza cuando se sale. Y va
    // primero porque esta sección la usan dos personas —el jefe de campo, que
    // entra por lo que pasó en el aula, y el analista, que entra por los
    // controles— y lo que se registra viene antes de lo que se valida.
    if (pestana === "abiertas") {
  return (
        <div className="mon-profile-stack aulas-tablas-apiladas">
        {/* **La calidad de lo que se escribió a mano.** Capacidad que no
            existía en ningún perfil de Monitoreo. Es un visualizador: ordena
            por dónde empezar a leer y no esconde respuestas. Como el de
            tiempos, se muestra aunque este estudio no traiga instrumento.
            Tiene pestaña propia —«Respuestas abiertas»— porque leerlas es un
            trabajo entero y no algo que se mire de paso entre otros seis
            paneles. */}
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Lo que se escribió a mano</h3>
            <span>calidad de las respuestas abiertas</span>
          </div>
          <AulasTextoAbierto bloque={dashboard.texto_abierto} />
        </section>
        </div>
      );
    }
    if (pestana === "registro") {
      return (
        <div className="mon-profile-stack">
          {registro}
          {/* **Lo que el campo reportó, que hasta hoy no se leía en ninguna
              pantalla.** `field_note` tenía formulario de entrada y cero
              superficies de lectura: el aplicador anotaba lo que vio en el aula
              y eso no llegaba a nadie. Va aquí, debajo del registro, porque es
              la misma pestaña y la misma persona: quien registra y quien lee lo
              registrado son el jefe de campo. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Lo que reportó el campo</h3>
              <span>observaciones de partes y registros</span>
            </div>
            {/* Las DOS fuentes: el parte del libro y el registro de esta app,
                que guarda su `field_note` en la fila del plan. El panel leía
                sólo la primera mientras su vacío decía «se escriben al registrar
                un aula» — el camino que no miraba. */}
            <AulasObservacionesDeCampo
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
              registros={(dashboard.agenda ?? []) as Array<Record<string, unknown>>}
            />
          </section>
          {/* **Cómo trabaja cada equipo, en Validación y no enterrado en
              Avance.** Es lo que el jefe de campo viene a ver, y existía sólo
              como el cuarto de nueve paneles de otra sección midiendo encuestas
              por aula. Aquí va con su banda: se está juzgando el trabajo de
              personas y una diferencia de cinco encuestas entre el primero y el
              último cabe entera en el ruido. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Desempeño por equipo</h3>
              <span>producción y calidad por aplicador</span>
            </div>
            <AulasTrabajoDeLosEquipos
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
            />
          </section>
          {/* La pregunta del analista: ¿lo de plataforma coincide con lo que se
              vio en el aula? Va en la misma pestaña que el registro porque es el
              contraste de lo que ahí se anota. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>El parte contra la plataforma</h3>
              <span>lo declarado y lo que llegó</span>
            </div>
            <AulasParteContraPlataforma
              partes={(dashboard.partes_campo ?? []) as Array<Record<string, unknown>>}
              agenda={(dashboard.agenda ?? []) as Array<Record<string, unknown>>}
            />
          </section>
          {/* **El control de tiempos, que el Excel anterior tenía y la app no.**
              Va en Validación porque es pregunta del analista, y se muestra
              aunque este estudio no traiga marcas de tiempo: el panel dice que
              faltan. Un panel que desaparece cuando no hay dato deja al usuario
              sin saber que el dato existe. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Cuánto se tarda en responder</h3>
              <span>duración por respuesta y por curso-horario</span>
            </div>
            <AulasTiemposDeRespuesta tiempos={dashboard.tiempos}
              onDeclararUmbral={onDeclararUmbralDeDuracion ?? undefined} />
          </section>

          {/* **Qué descarta cada filtro.** Con sólo el total de válidas no se
              puede saber si el criterio trabaja: un filtro que acepta todos los
              valores da el mismo número que no tener filtro. Va en Validación
              porque es la pregunta del analista sobre su propio criterio. */}
          <section
            className="mon-profile-panel"
            data-qa-geometry-group="monitoring-aulas-table"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="mon-profile-panel-head">
              <h3>Qué descarta cada filtro</h3>
              <span>la cadena de validez, paso a paso</span>
            </div>
            <AulasCadenaDeFiltros bloque={dashboard.cadena_filtros} />
          </section>
        </div>
      );
    }
    // B77: el foco de facultad de la cabecera también corta aquí — con la
    // guardia del helper: una lista sin la dimensión queda intacta.
    const rows = soloFacultad(
      (dashboard.validation ?? []) as Array<Record<string, unknown>>, facultadEnFoco);
    const summary = summarizeAulasValidation(rows);
    const control = soloFacultad((dashboard.control_calidad ?? []) as Array<Record<string, unknown>>, facultadEnFoco);
    const controlResumen = (dashboard.control_calidad_resumen ?? null) as ResumenDeControl | null;
    // Cada pestaña muestra SU panel, y el reparto es POSITIVO —«¿es ésta?»— y no
    // por negación de la otra: con dos bastaría negar, pero en Consultas la
    // negación ya falló al llegar la cuarta y no hay razón para repetirla acá.
    const enBase = pestana === "base";
    return (
      <div className="mon-profile-stack aulas-tablas-apiladas">
      {/* **La ficha del aula en foco.** Va primero porque quien la abrió
          viene a verla, y se gobierna con `foco=aula:<codigo>`, igual que el
          detalle de facultad de esta misma sección. Cerrarla limpia el foco
          y la sección vuelve a su lectura completa. */}
      {foco?.tipo === "aula" ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Ficha del curso-horario</h3>
          <span>lo esperado, lo conseguido y lo que anotó el campo</span>
        </div>
        <AulasFichaDeAula
          codigo={foco.valor}
          fuentes={{
            agenda: (dashboard.agenda ?? []) as Array<Record<string, unknown>>,
            partes: (dashboard.partes_campo ?? []) as Array<Record<string, unknown>>,
            control: (dashboard.control_calidad ?? []) as Array<Record<string, unknown>>,
            brechas: (dashboard.brechas ?? []) as Array<Record<string, unknown>>,
            banco: dashboard.banco_extras?.por_facultad ?? [],
          }}
          onCerrar={() => onFoco(null)}
          // El foco viaja en la URL, así que el registro se abre ya sobre esta
          // aula: `codigoEnFoco` lo recoge del mismo `foco=aula:<codigo>`.
          onRegistrar={irAPestana ? () => irAPestana("registro") : undefined}
        />
      </section>
      ) : null}
      {enBase ? null : (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* Se queda: los controles los deriva el motor —el libro no trae hoja
              de validación—, así que no hay encabezado que copiar. */}
          <h3>Validación de cursos-horario</h3>
          {/* **De dónde sale esta lista, porque abajo hay otra.** Los dos
              paneles de esta sección son control de calidad y el comentario que
              los separa ya avisaba del riesgo —«que una fila parezca respaldar a
              la otra»— pero eso vivía en el código y no en la pantalla. Aquí es
              lo que la app deriva; abajo, lo que el equipo calcula en su Excel.
              Son dos medidas distintas del mismo operativo. */}
          <span>{summary.label} · lo que deriva la app</span>
        </div>
        {/* Avisos y no tabla: el detalle de un control es una frase entera y en
            una celda de tres columnas se lee mal. Es además el lenguaje que ya
            usa `CalidadDeCampo` justo arriba, en esta misma sección. */}
        <AulasControles filas={rows} plan={(dashboard.agenda ?? []) as Array<Record<string, unknown>>} />
      </section>
      )}
      {/* La tercera hoja del operativo. Los dos paneles son control de calidad y
          por eso comparten sección, pero no son la misma medida: arriba lo que
          deriva el motor, aquí lo que el equipo calcula en su Excel. Separarlos
          evita que una fila parezca respaldar a la otra, y ahora además cada uno
          recibe la vista entera en vez de competir por el alto. */}
      {enBase ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          {/* El nombre de la hoja, tal cual, porque es a lo que el equipo va a
              buscarlo en su libro. */}
          <h3>Base de control</h3>
          {/* «filas de la hoja» y no «aulas»: son las que trae el libro que llena
              el equipo, y no tienen por qué ser las del plan —aquí 210 contra
              196—. Llamarlas «aulas» ponía dos cifras con el mismo nombre en un
              perfil cuya unidad es el curso-horario. El recibo del libro ya usa
              este mismo lenguaje: «210 filas de control». */}
          {/* Y cuantas columnas: en 1440 solo caben nueve, asi que dos tercios
              de la tabla viven a la derecha del borde. La sombra de
              desplazamiento ensena que hay mas; el numero dice cuanto mas.
              «en la tabla» y no «columnas» a secas: pegado a «filas de la
              hoja», se leia como el ancho de la HOJA, que son 39. */}
          <span>
            {control.length
              ? `${contar(control.length, "fila de la hoja", "filas de la hoja")} · ${columnasDeLaTabla(controlResumen)} · lo que calcula el equipo`
              : dashboard.libro ? "Hoja de control sin filas" : "Libro sin importar"}
          </span>
        </div>
        {/* La vara, junto al veredicto que produce. Declararla en una pantalla
            de ajustes la dejaría lejos de su resultado, que es lo que hacía que
            nadie supiera cuál era. */}
        {criterioDeAula}
        {/* **El vacío dice cuál de las dos causas es.** Sin filas, esta sección
            pintaba la tabla con sus cabeceras y cero filas bajo un pie de dos
            palabras, «Sin datos», mientras el panel hermano de más abajo —«Lo
            que falta para cerrar»— comprobaba `control.length` y desaparecía
            entero: dos tratamientos del mismo vacío en la misma sección.

            Y el motor YA distingue las dos causas —`libro` llega `NULL` cuando
            el estudio nunca importó uno, «que es distinto de un libro sin
            hojas», dice su propio comentario—, pero ese campo sólo lo consumía
            la sección de Fuentes. Vacío por desconexión, que es la única
            categoría del triaje C5 que autoriza añadir.

            No es un caso de laboratorio: `control_calidad` sale de los partes
            de campo, así que éste es el estado del día 1 de cualquier estudio. */}
        {control.length ? (
          <AulasControlDelLibro
            filas={control}
            resumen={controlResumen}
            criterio={(dashboard.criterio_validez ?? null) as never}
          />
        ) : (
          <p
            className="mon-profile-muted"
            data-qa-geometry-capacity="owned"
            data-qa-geometry-member="true"
          >
            {dashboard.libro
              ? "El libro del operativo está importado, pero su hoja de control todavía no trae ninguna fila: la revisión aparece en cuanto el equipo registre la primera."
              : "Este estudio todavía no ha importado el libro del operativo, así que no hay hoja de control que revisar."}
          </p>
        )}
      </section>
      ) : null}
      {/* El precio de cerrar lo que no llegó. Va DESPUÉS de la tabla del libro
          —el veredicto primero, la cola de trabajo después— y en la misma
          pestaña porque sale del mismo dato: en una pestaña propia habría que
          saltar entre las dos para saber de qué aula se habla. */}
      {enBase && control.length ? (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Lo que falta para cerrar</h3>
          <span>
            en encuestas, sobre el umbral que la hoja calculó. Segunda lectura: un curso-horario corto
            no obliga a nada si su facultad cierra igual
          </span>
        </div>
        <AulasLoQueFalta filas={control} facultadEnFoco={facultadEnFoco} onFoco={onFoco} />
      </section>
      ) : null}
      </div>
  );
}
