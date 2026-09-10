import { Fragment, useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { personasPorAula } from "./redondeoConservador";
import { MINIMO_PARA_COMPARAR, esCajonSinDato, partesSinCifraDeEfectivas, rendimientoPorFacultad } from "./rendimientoPorFacultad";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt, pctPerfil } from "./kpisDeAulas";
import { nombreDeAplicador } from "./nombreDeAplicador";
import { horasDeDoceHoras } from "./horaDeDoceHoras";
import "./aulasRendimientoCorte.css";

/**
 * Qué está rindiendo más y qué menos, facultad por facultad.
 *
 * Es el eje que sustituye a «aula válida / no válida». La unidad es la encuesta
 * conseguida, no un porcentaje contra un umbral: un aula grande a media
 * asistencia deja más que una pequeña que «cumple».
 */

/* El porcentaje del perfil. `toLocaleString` a secas no acota decimales: una
   tasa que llegue con tres los publicaba con tres, al lado de paneles que
   escriben uno. La ausencia sigue siendo «—», que es de este panel. */
const pct = (n: number | null) => (n == null ? "—" : pctPerfil(n));

export function AulasRendimientoPorFacultad({
  partes, plan, clave = "faculty", unidad = "Facultad", explicaLasColumnas = true,
  facultadEnFoco, onFoco,
}: {
  partes: ReadonlyArray<MonitoreoRow>;
  plan: ReadonlyArray<MonitoreoRow>;
  /** Por qué unidad de esfuerzo se agrupa: facultad, aplicador o franja. */
  clave?: "faculty" | "applied_by" | "franja" | "dia_semana";
  /** Cómo se llama esa unidad en la cabecera de la lista. */
  unidad?: string;
  /**
   * La facultad enfocada, si la hay. **No filtra: resalta.** `foco` viaja en la
   * URL y sólo lo obedecía la tabla de cuotas, teniendo el perfil seis listas de
   * las mismas veinte facultades. Filtrar destruiría el ranking, que es lo que
   * estas listas aportan; el detalle se filtra, el control no.
   */
  facultadEnFoco?: string;
  /** Pulsar un nombre pone el foco. Sin esto, los nombres son sólo texto. */
  onFoco?: (foco: FocoDeCuota) => void;

  /**
   * Si este panel lleva el pie que explica las cuatro columnas.
   *
   * Las tres vistas —facultad, aplicador, franja— comparten componente Y
   * columnas, y salen **una detrás de otra en la misma pantalla**: el pie se
   * repetía palabra por palabra tres veces, 191 de las 896 palabras de prosa de
   * la pestaña. Dentro de un panel ese pie NO sobra —nombra cuatro columnas que
   * no se explican en ningún otro sitio—; lo que sobra es decirlo tres veces.
   * Lo lleva el primero y los otros dos lo heredan por vecindad.
   */
  explicaLasColumnas?: boolean;
}) {
  const filas = useMemo(() => rendimientoPorFacultad(partes, plan, clave), [partes, plan, clave]);
  // Los que el ranking dejó fuera por venir sin cifra: se cuentan con la MISMA
  // regla que los descarta, y se dicen en la cabecera.
  const sinCifra = useMemo(() => partesSinCifraDeEfectivas(partes), [partes]);

  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay partes de campo con asistentes ni efectivas, así que no se puede decir
        qué rinde más.
      </p>
    );
  }

  const efectivas = filas.reduce((n, f) => n + f.efectivas, 0);
  const aulas = filas.reduce((n, f) => n + f.aulas, 0);
  const tope = Math.max(...filas.map((f) => f.porAula ?? 0), 1);
  // El umbral de color de la barra, en la MISMA magnitud que la barra: media
  // ponderada del potencial —efectivas de todos sobre elegibles de todos—, no
  // el promedio de los porcentajes, que le daría el mismo peso a una facultad
  // de un parte que a una de doce.
  const totalEfectivas = filas.reduce((n, f) => n + f.efectivas, 0);
  const totalElegibles = filas.reduce((n, f) => n + f.elegibles, 0);
  // Los dos grupos, para la frase de cabecera: la lista ya llega ordenada con
  // las comparables delante, pero la frase necesita nombrarlas por separado.
  // Los cajones de «no se sabe» quedan fuera de los dos: un «Sin aplicador» con
  // cinco partes tiene visitas de sobra y no es una facultad que rinda, así que
  // sin este filtro podía salir nombrado como la que más rinde de la tanda.
  // **El aviso de las horas de madrugada, sólo en la lente de horas.** Es la
  // única que las reparte, y en las demás sería ruido: el mismo parte cuenta
  // igual en su facultad tenga la hora bien o mal escrita.
  const doceHoras = clave === "franja" ? horasDeDoceHoras(partes, plan) : [];
  const cuadranDeTarde = doceHoras.filter((h) => h.cuadraDeTarde).length;

  // Facultad y aplicador juzgan a alguien; franja y día son cortes del tiempo.
  const juzgaAUnEjecutante = clave === "faculty" || clave === "applied_by";
  const conNombre = filas.filter((f) => !esCajonSinDato(f.facultad));
  const comparables = conNombre.filter((f) => f.aulas >= MINIMO_PARA_COMPARAR);
  const apartadas = conNombre.filter((f) => f.aulas < MINIMO_PARA_COMPARAR);
  const mediaPotencial = totalElegibles ? (100 * totalEfectivas) / totalElegibles : 0;
  const media = aulas ? Math.round((10 * efectivas) / aulas) / 10 : 0;

  return (
    <div className="aulas-rendimiento">
      {/* La lectura habla de ESTA agrupación, no del total.
          Las tres vistas —facultad, aplicador, franja— comparten componente, y
          con el total salía la MISMA frase palabra por palabra en los tres
          paneles seguidos: «4 863 encuestas en 210 aulas visitadas · 23,2 por
          aula de media», tres veces. Repetida así se lee como un fallo y
          desperdicia la única línea que puede decir qué enseña cada corte.
          El total sigue estando: es el «de media» del final. */}
      <p className="aulas-rendimiento-lectura">
        {/* Sin género: el mismo componente sirve a facultad, aplicador y franja,
            y «la que más rinde (Equipo 4)» no concuerda. «De X a Y» vale para
            los tres y además es más corto. */}
        {comparables.length > 1 ? (
          <>
            {/* La frase nombra lo que ORDENA la lista, que desde el
                2026-09-09 es el % del potencial y no lo que deja cada visita:
                si la cabecera dice una cosa y el orden obedece a otra, quien
                lee saca la conclusión contraria.

                **Y recorre sólo el grupo que se compara.** Tomaba la primera y
                la ÚLTIMA fila de la lista, y desde el corte de evidencia la
                última no es la que menos rinde: es la que menos visitas tiene.
                Con el operativo de hoy la frase habría dicho «del 74,5 % al
                100 %», que se lee como que el rango sube. */}
            Del <strong>{pct(comparables[0].delPotencial)}</strong> de su potencial
            ({comparables[0].facultad}) al{" "}
            <strong>{pct(comparables[comparables.length - 1].delPotencial)}</strong>{" "}
            ({comparables[comparables.length - 1].facultad})
            {apartadas.length > 0 ? (
              <>
                {" "}· {fmt(apartadas.length)} con menos de {MINIMO_PARA_COMPARAR}{" "}
                cursos-horario todavía no{" "}
                {apartadas.length === 1 ? "entra" : "entran"} en la comparación
              </>
            ) : null}
          </>
        ) : comparables.length === 1 ? (
          <>Sólo <strong>{comparables[0].facultad}</strong> lleva{" "}
          {MINIMO_PARA_COMPARAR} cursos-horario o más: todavía no hay con qué compararla</>
        ) : (
          <>Ninguna llega a {MINIMO_PARA_COMPARAR} cursos-horario visitados:
          todavía no hay rendimiento que comparar</>
        )}
        {" "}· <strong>{personasPorAula(media)}</strong> de media en{" "}
        {fmt(aulas)} {aulas === 1 ? "curso-horario visitado" : "cursos-horario visitados"}
        {/* **El descarte se DICE.** El ranking deja fuera los partes que vinieron
            sin su cifra de efectivas —una celda vacía no es un cero, y publicarla
            como tal ponía «0 efectivas · 0.0 %» junto al nombre de una persona—,
            pero callarlo cambia el denominador sin avisar: la cabecera diría «15
            cursos-horario» donde el resto del perfil cuenta 17 partes. */}
        {sinCifra > 0 ? (
          <em className="es-ausente">
            {" "}· {fmt(sinCifra)}{" "}
            {sinCifra === 1
              ? "parte más se aplicó y no trae su cifra de efectivas, así que no entra"
              : "partes más se aplicaron y no traen su cifra de efectivas, así que no entran"}
          </em>
        ) : null}
      </p>
      {/* SEMÁNTICA DE TABLA SOBRE LA REJILLA, no `<table>`.
          La cabecera iba con `aria-hidden="true"`, así que un lector de pantalla
          recibía 21 filas de cinco cifras SIN un solo nombre de columna —medido
          en vivo el 2026-08-26—. La reparación de la tabla de Efectividad fue
          volver a `<table>`; aquí no, y es una decisión, no un atajo: esta
          rejilla la comparten CUATRO instancias (facultad, aplicador, franja,
          día) y una variante compacta cuyos anchos están calculados desde la
          palabra más larga de cada cabecera. Reescribirla como tabla rehace esa
          geometría en dos regímenes a la vez, y el defecto que hay que reparar
          es de nombres, no de maquetación. Los roles ARIA dan los nombres sin
          tocar un píxel. */}
      <ul className="aulas-rendimiento-lista" role="table"
        aria-label={`Rendimiento por ${unidad.toLowerCase()}`}
        data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {/* **La explicación viaja con la columna.**
            El pie de abajo dice qué es cada una, pero sólo lo pinta el primero
            de los cuatro paneles que usan esta tabla: los otros tres —«Quién
            consigue más», «Franja horaria del operativo» y «Día de la semana»—
            llegan con `explicaLasColumnas={false}` para no repetir el párrafo
            cuatro veces, y publicaban «Ajustado» y «Del potencial» mudas.
            Comprobado en pantalla: uno con leyenda, tres sin ella.

            No se duplica el párrafo —sería el mismo ruido que se quiso evitar—:
            la definición va en el `title` de cada cabecera, que es como el
            perfil resuelve el detalle de los KPIs y no gasta un píxel. */}
        <li className="aulas-rendimiento-cabecera" role="row">
          <span role="columnheader">{unidad}</span>
          {/* **Los cuatro nombres decian el metodo, no el dato.**

              Gonzalo, sobre esta tabla: «no entiendo a que te refieres con
              ajustado, no se si asistentes efectivos o matriculados; no entiendo
              a que te refieres con "Del potencial"... son muchas jergas y no se
              entiende a que te refieres».

              Tenia razon en las cuatro. «Por visita» no decia de QUE cuenta
              hablaba —y en este perfil conviven las del parte y las de
              plataforma—; «Ajustado» no decia ajustado DE QUE; «De los
              asistentes» y «Del potencial» eran dos porcentajes sin
              denominador, que es justo lo que hay que saber para leerlos.

              Ahora cada cabecera nombra el DATO y su denominador. El `title`
              conserva el metodo para quien lo quiera. */}
          {/* «Efectivas por aula» NO: el ratchet de vocabulario lo caza y tiene
              razon —la unidad de este estudio es el curso-horario—. «Por visita»
              ya era el rotulo; lo que faltaba era decir DE QUE cuenta habla.
              El comentario va FUERA del span: dentro rompe el patron con el que
              `rendimientoPorFacultad.test.ts` comprueba que cada cabecera trae
              su `title`. */}
          {/* La cabecera nombra lo que la BARRA dibuja, que desde el
              2026-09-09 es el potencial: si dijera «Efectivas por visita»,
              seguiríamos con un rótulo que promete otro número. */}
          {/* **La barra dibuja lo OBSERVADO y el corte de evidencia hace el
              trabajo que el encogimiento no podía.** El potencial crudo normaliza
              el tamaño del aula pero no cuántas aulas hay detrás, y el 2026-09-10
              encabezaban la lista PSICOLOGÍA con el 100 % de UNO y LETRAS Y
              CIENCIAS HUMANAS con el 90 % de otro. Encoger hacia la media lo
              arreglaba en el papel y lo rompía en pantalla: las seis primeras
              barras salían a 69,0 · 66,5 · 65,1 · 64,8 · 63,8 · 62,7 %, seis
              barras del mismo largo. Ahora las facultades con menos de tres
              visitas se apartan a su propio grupo y la barra vuelve a dibujar lo
              que de verdad se midió. */}
          <span role="columnheader" title="Qué proporción de los alumnos elegibles se ha recogido ya: efectivas del parte de campo sobre elegibles. Es la única medida que no depende de cuántos alumnos tenga el curso-horario, y por eso ordena la lista. Las facultades con menos de tres cursos-horario visitados se apartan al final: con una o dos visitas, un curso-horario afortunado mueve el porcentaje treinta puntos.">
            Del potencial
          </span>
          <span role="columnheader" title="Efectivas del parte de campo conseguidas por cada curso-horario visitado: cuántas encuestas trae un viaje. Es logística, no rendimiento, y por eso no ordena.">
            Por visita
          </span>
          {/* «Ajustado por tamaño» a secas, con la barra ya ajustada al lado, era
              una palabra para dos cosas: ésta encoge las ENCUESTAS POR VISITA,
              la barra encoge el POTENCIAL. Cada una nombra su base. */}
          <span role="columnheader" title={`Las encuestas por visita corregidas por cuánta evidencia hay: equivale a sumarle a cada ${unidad.toLowerCase()} cinco cursos-horario con el rendimiento medio, así una con dos afortunadas no encabeza la lista.`}>
            Por visita, ajustado
          </span>
          {/* Las dos tasas nombran su NUMERADOR en el title —efectivas del
              parte—, como ya hacía «Efectivas por visita»: el ADR 0082 pide que
              cada tasa declare de qué cuenta sale, y en este perfil conviven
              las del parte y las de plataforma. */}
          <span role="columnheader" title="Qué proporción de quienes estaban en el aula acabó respondiendo: efectivas del parte de campo sobre asistentes. Mide el trabajo dentro del aula.">
            De los que asistieron
          </span>
          {/* La columna «De los elegibles» se retiró: es exactamente lo que
              dibuja la barra, y tenerla dos veces en la misma fila era pedirle
              al lector que comprobara que coinciden. */}
        </li>
        {filas.map((f, i) => {
          // **El corte se DIBUJA, no se deduce.** Sin una línea que lo diga, una
          // facultad con dos visitas al 100 % aparecería a media tabla y quien
          // lee concluiría que rinde peor que la de arriba, cuando lo que pasa
          // es que todavía no se compara. El separador va antes de la PRIMERA de
          // las apartadas y sólo si hay alguna comparable delante: una lista
          // entera de facultades con una visita no se encabeza con un aviso de
          // que no hay nada arriba.
          const anterior = filas[i - 1];
          const cajon = esCajonSinDato(f.facultad);
          const apartada = !cajon && f.aulas < MINIMO_PARA_COMPARAR;
          // **El corte de evidencia NO puede tragarse los cajones.** Visto en
          // pantalla el 2026-09-10: en «Día de la semana» lo único que quedaba
          // bajo la línea era «Sin fecha», y la línea dice «con menos de 3
          // cursos-horario visitados — todavía no se comparan». «Sin fecha» no
          // es un día con pocas visitas: son partes a los que les falta la
          // fecha. Cada frontera nombra lo suyo o miente sobre lo que separa.
          const abreElCorte = apartada && i > 0
            && !esCajonSinDato(anterior?.facultad ?? "")
            && (anterior?.aulas ?? 0) >= MINIMO_PARA_COMPARAR;
          const abreElCajon = cajon && i > 0 && !esCajonSinDato(anterior?.facultad ?? "");
          return (
          <Fragment key={f.facultad}>
          {abreElCorte ? (
            <li key="corte" role="row" className="aulas-rendimiento-corte">
              <span role="cell">
                Con menos de {MINIMO_PARA_COMPARAR} cursos-horario visitados —
                todavía no se comparan: con una o dos visitas, un curso-horario
                afortunado mueve el porcentaje treinta puntos
              </span>
            </li>
          ) : null}
          {abreElCajon ? (
            <li key="cajon" role="row" className="aulas-rendimiento-corte">
              <span role="cell">
                Partes a los que les falta el dato con el que agrupa esta lente —
                no son un nivel de rendimiento y por eso van fuera de la
                comparación
              </span>
            </li>
          ) : null}
          <li key={f.facultad} role="row"
            className={clave === "faculty" && f.facultad === facultadEnFoco ? "es-en-foco" : undefined}>
            {/* Sólo es control cuando agrupa POR FACULTAD: en las otras lentes
                la fila es una franja o un día, y poner el foco de facultad desde
                ahí pondría el nombre de una franja donde va una facultad. */}
            {/* `rowheader`: identifica la fila, igual que un `th scope="row"`. */}
            <NombreDeFacultad facultad={f.facultad} className="aulas-rendimiento-nombre"
              rol="rowheader"
              enFoco={clave === "faculty" && f.facultad === facultadEnFoco}>
              {/* Agrupando por APLICADOR la fila es una persona, y un nombre
                  se escribe como se escribe un nombre (dictado 2026-09-04).
                  Con las otras lentes la fila es una facultad, una franja o un
                  día, y normalizarlas mangaría rótulos que no son nombres. */}
              {clave === "applied_by" ? nombreDeAplicador(f.facultad) : f.facultad}
              {/* «encuestas» a secas obligaba a adivinar de que cuenta hablaba. */}
              {/* El AJUSTADO va aquí, pegado a la evidencia que lo explica: «2
                  cursos-horario · 35 efectivas · 69,0 % pesando la evidencia» dice
                  de un vistazo cuánto de ese 92,1 % es observación y cuánto es
                  suerte de dos aulas. Aparte de la barra porque no puede
                  ordenarla: aplasta la lista contra la media. */}
              <em>
                {fmt(f.aulas)} {f.aulas === 1 ? "curso-horario" : "cursos-horario"} ·{" "}
                {fmt(f.efectivas)} efectivas
                {/* **Sólo donde se juzga a alguien.** La línea vale para la
                    facultad y para el aplicador, que son las dos lentes en las
                    que una tanda corta puede hacer parecer bueno a quien no lo
                    es. Una franja horaria o un día de la semana no son un
                    ejecutante, y en la rejilla estrecha del trío —columnas de
                    105 y 112 px— esta línea se partía en TRES y CUATRO
                    renglones y subía cada fila a 61 px. Medido el 2026-09-10. */}
                {juzgaAUnEjecutante && f.delPotencialAjustado != null
                  ? <> · {pct(f.delPotencialAjustado)} pesando la evidencia</>
                  : null}
              </em>
            </NombreDeFacultad>
            {/* **La barra mide LO QUE ORDENA la lista: el % del potencial.**
                Medía «por visita» mientras el orden pasaba al potencial
                (`5a56f2c8`), y el resultado era una lista descendente con
                barras que subían y bajaban —17, 12, 9, 14, 29…—. Una lista
                ordenada por A con barras que dibujan B se lee como rota, y el
                ojo culpa al gráfico antes que al orden. Se vio en la captura el
                2026-09-09, justo después de arreglar el orden.

                La escala es 0–100 % y no el máximo observado: el potencial ya
                es una fracción de sí mismo, así que estirarlo al mayor de la
                tanda haría que el primero pareciera lleno aunque recogiera el
                40 %. «Por visita» sigue en la fila, como número. */}
            {/* La celda lleva el rol y la barra de dentro sigue siendo la
                imagen con su alternativa: si el `role="img"` se pusiera en la
                celda, el lector perdería la posición en la fila. */}
            <span role="cell" className="aulas-rendimiento-barra-celda">
            <span className="aulas-rendimiento-barra" role="img"
              aria-label={`Recogido de los alumnos elegibles: ${pct(f.delPotencial)}`}>
              {/* **Las apartadas se dibujan en pálido.** Visto en pantalla el
                  2026-09-10: bajo el corte quedaban las barras MÁS LARGAS del
                  panel —620, 571 y 558 px contra 437 de la primera comparable—
                  porque una facultad con una sola visita al 100 % dibuja el
                  carril entero. El ojo va al trazo largo antes que al rótulo, y
                  el panel decía con la tinta lo contrario de lo que decía con
                  las palabras. El largo NO se toca —el dato es el dato— y lo
                  que cambia es el peso del color. */}
              <i style={{
                width: `${Math.max(4, Math.min(100, f.delPotencial ?? 0))}%`,
                background: apartada
                  ? `color-mix(in srgb, ${(f.delPotencial ?? 0) >= mediaPotencial
                      ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.parcial} 32%, var(--pulso-surface))`
                  : (f.delPotencial ?? 0) >= mediaPotencial
                    ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.parcial,
                color: apartada ? "var(--pulso-text-soft)" : undefined,
              }}>{pct(f.delPotencial)}</i>
            </span>
            </span>
            {/* Las dos tasas conviven con la barra y NO la sustituyen: miden
                cosas distintas —el trabajo del aplicador y cuánto queda por
                exprimir— y cualquiera de ellas ordenaría mal la lista. */}
            {/* El AJUSTADO al lado del crudo, nunca en su lugar. En el estudio
                real las facultades van de 2 a 39 aulas, y una de dos aulas
                afortunadas encabeza la lista cruda sin merecerlo. */}
            {/* «Por visita» baja a columna: sigue haciendo falta —dice cuántas
                encuestas trae un viaje— pero ya no dibuja ni ordena. */}
            <span role="cell" className="aulas-rendimiento-tasa">
              {personasPorAula(f.porAula)}
            </span>
            <span role="cell" className="aulas-rendimiento-tasa">
              {personasPorAula(f.porAulaAjustado)}
            </span>
            <span role="cell" className="aulas-rendimiento-tasa">{pct(f.deLosAsistentes)}</span>

          </li>
          </Fragment>
          );
        })}
      </ul>
      {/* El pie explica las columnas EN SU ORDEN y con SU NOMBRE.
          Antes decía «ordenadas por lo que deja cada visita» —que es la columna
          «Por aula» llamada de otra forma, dos nombres para lo mismo dentro del
          mismo panel— y explicaba asistentes y potencial antes que «Ajustado»,
          que va en medio: quien lee tenía que saltar.

          Y el 2026-08-28 «Por aula» pasa a «Por visita». El motor llama «tasa
          del aula» a otra cosa: la fracción de elegibles que responde según el
          tamaño del salón, que es un PRONÓSTICO del diseño. Esta columna es un
          RESULTADO del campo, encuestas conseguidas por aula visitada. Eran dos
          números distintos con el mismo nombre dentro del mismo módulo. */}
      {doceHoras.length > 0 ? (
        /* **Se cuenta y se explica; no se corrige.** Sumarle doce horas a un
           dato del campo es inventarlo, y dos de los nueve casos reales no
           cuadran ni de tarde. El aviso da la evidencia —cuántos son y en
           cuántos la ventana del curso es de tarde— para que quien lleva la
           hoja decida; la lista de arriba los sigue contando tal como vinieron,
           en «Fuera de franja». */
        <p
          className="mon-profile-muted aulas-rendimiento-pie"
          /* El texto CRUDO de cada parte, con su código, para quien tenga que ir
             a buscar la fila en la hoja: en pantalla se enseña sólo la hora
             —repetir la fecha nueve veces no se lee— pero el dato entero tiene
             que estar a un hover de distancia. */
          title={doceHoras.map((h) => `${h.codigo}: ${h.cruda}${h.ventana ? ` · plan ${h.ventana}` : ""}`).join("\n")}
        >
          <strong>{fmt(doceHoras.length)}</strong>{" "}
          {doceHoras.length === 1 ? "parte trae" : "partes traen"} una hora
          anterior a las 7:00 —{doceHoras.slice(0, 6).map((h) => h.escrita).join(", ")}
          {doceHoras.length > 6 ? "…" : ""}— y por eso{" "}
          {doceHoras.length === 1 ? "cuenta" : "cuentan"} en «Fuera de franja».
          {cuadranDeTarde > 0 ? (
            <>
              {" "}En <strong>{fmt(cuadranDeTarde)}</strong> de{" "}
              {doceHoras.length === 1 ? "ese" : "esos"} el horario del curso es de
              tarde y la hora escrita cuadra sumándole doce, así que probablemente
              se anotó en formato de 12 horas sin AM/PM. La app no las corrige: el
              arreglo está en la hoja de campo.
            </>
          ) : null}
        </p>
      ) : null}
      <p className="mon-profile-muted aulas-rendimiento-pie">
        {explicaLasColumnas ? (
          <>
            <strong>Del potencial</strong> es qué parte de los alumnos elegibles se ha
            recogido, y es lo que dibuja la barra y ordena la lista. Debajo de cada
            nombre va el mismo porcentaje <strong>pesando la evidencia</strong>:
            acercado a la media del estudio según cuántos cursos-horario lo
            sostienen —equivale a sumarle a cada {unidad.toLowerCase()} cinco
            cursos-horario imaginarios al rendimiento medio—. No ordena nada; está
            para leer cuánto de un porcentaje alto es trabajo y cuánto es una tanda
            corta. <strong>Por visita</strong> es lo que deja cada curso-horario
            visitado —cuántas encuestas trae un viaje, que es logística y no
            rendimiento—, y lleva su propio <strong>ajustado</strong> por la misma
            regla. <strong>De los asistentes</strong> mide el trabajo dentro del
            curso-horario.
          </>
        ) : null}
        {/* **De dónde salen los tramos.** Sin decirlo, ver «7:00 – 9:00» con 26
            aulas junto a «9:01 – 19:00» con 161 se lee como un corte arbitrario
            y mal hecho. Son los del equipo —la hoja «planilla» del libro— y por
            eso no se retocan: usar otros haría que la app y su Excel hablaran de
            horarios distintos. */}
        {clave === "franja" ? (
          <> Los tramos son los del <strong>libro del operativo</strong>, no un corte de la
          app: por eso uno cubre dos horas y otro diez.</>
        ) : null}
      </p>
    </div>
  );
}
