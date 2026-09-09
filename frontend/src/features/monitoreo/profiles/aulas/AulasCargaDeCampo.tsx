import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MonitoreoAulasSincronizacion } from "../../../../api/monitoreo";

import { Check, Pencil } from "../../../../vendor/lucide-react";

import type {
  MonitoreoAulasDisponibilidad,
  MonitoreoAulasFranjas,
  MonitoreoAulasPlanRow,
  MonitoreoAulasReparto,
} from "../../../../api/monitoreo";
import {
  anchoMinimoDeMalla,
  calcularCarga,
  citasDeLaFila,
  comoHora,
  pabellonesDeLasCitas,
  ejeSugerido,
  hayHorarioDeCurso,
  facultadesDelPlan,
  lugaresDelPlan,
  porPabellon,
  ventanasDelMotor,
  type EjeDeCarga,
  type OcupanteDeCelda,
  type OpcionesDeCarga,
} from "./cargaDeCampo";
import { AulasAsignacionDeAplicadores } from "./AulasAsignacionDeAplicadores";
import { AulasDisponibilidadDeAplicadores } from "./AulasDisponibilidadDeAplicadores";
import { ChipDato, ChipHora, ChipLugar, ChipPrep } from "./AulasSistemaPabellon";
import { columnasVivas, mallaDeOferta } from "./disponibilidadDeAplicadores";
import type { DistribucionSheetsRecordada, DistribucionVigente } from "./distribucionDeAplicadores";
import { ventanasPorCita } from "./salidasDelReparto";
import { repartoDeAplicadores } from "./repartoDeAplicadores";
import { etiquetaDeFecha } from "./agendaPorDia";
import { hoyISO } from "./calendarioDeAgenda";
import { semanaInicial, semanasDeCarga } from "./semanasDeCarga";
import { fmt } from "./kpisDeAulas";

/**
 * Cuánta gente hace falta en campo, a qué hora y en qué edificio.
 *
 * La pregunta que contesta no la contesta ninguna otra pestaña: Agenda lista el
 * plan por curso-horario y Por facultad dice a dónde ir cada día, pero ninguna
 * dice **cuántos aplicadores tienen que estar a la vez**. Eso depende del RANGO
 * de cada clase, no de su hora de inicio: medido sobre el plan de HSVG 2026,
 * contar por hora de inicio daba un pico de 8 aulas simultáneas y contar el
 * rango real da 19.
 *
 * Y depende de cuánto dure la aplicación dentro del aula, que es una decisión
 * del operativo y no un dato del plan: con 30 minutos al inicio bastan 8
 * aplicadores; si el encuestador se queda toda la sesión hacen falta 19. Por eso
 * los dos parámetros son controles y no constantes — el mismo plan admite
 * operativos de tamaño muy distinto.
 *
 * ## Dos lecturas del mismo plan
 *
 * **Patrón semanal** —seis filas, lunes a sábado— dimensiona el equipo mientras
 * casi nada está agendado. **Calendario** pone una fila por fecha concreta, que
 * es lo que hace falta cuando el operativo ya está confirmado: el campo se
 * reparte en varias semanas, y sobre el patrón dos aulas del mismo día de la
 * semana en semanas distintas caen en la misma celda e inventan un pico.
 *
 * La vista abre con la que corresponde al estado del estudio —`ejeSugerido`— y
 * el usuario cambia cuando quiera.
 */
const DURACION_POR_DEFECTO = 30;

const tituloDeCelda = (fila: string, hora: string, firme: number, plausible: number, enCurso: number): string =>
  [
    `${fila} ${hora}`,
    `${fmt(firme)} confirmados`,
    plausible ? `hasta ${fmt(plausible)} por agendar` : "",
    `${fmt(enCurso)} cursos-horario en curso`,
  ]
    .filter(Boolean)
    .join(" · ");

/** «2026-09-12» → «sáb 12/09»: la fecha exacta, corta para una línea de detalle. */
const fechaCorta = (iso: string): string => {
  const etiqueta = etiquetaDeFecha(iso); // «Sábado 12/09», o el crudo si no parsea
  const m = /^(\p{L}+) (.+)$/u.exec(etiqueta);
  return m ? `${m[1].slice(0, 3).toLowerCase()} ${m[2]}` : etiqueta;
};

/** El momento pactado de la clase, en palabras del operativo. */
const MOMENTO_LEGIBLE = { inicio: "al inicio", intermedio: "en el receso", final: "al final" } as const;

/** El nombre accesible de una celda ocupada: sus dos capas, concordadas. */
const nombreDeCelda = (fila: string, hora: string, firme: number, plausible: number): string => {
  const partes = [
    firme ? `${fmt(firme)} ${firme === 1 ? "confirmado" : "confirmados"}` : "",
    plausible ? `hasta ${fmt(plausible)} por agendar` : "",
  ].filter(Boolean);
  return `${fila} ${hora}: ${partes.join(", ")}`;
};

/**
 * Las cuatro lecturas del panel (dictado 2026-09-02: «deben haber tres
 * cuadros/visualizaciones: Patrón semanal, Calendario y Disponibilidad de
 * aplicadores» más «una pestaña de asignación»). Las dos primeras son ejes de
 * la malla de DEMANDA; las otras dos leen los bloques `disponibilidad` y
 * `reparto` del dashboard (B29).
 */
export type VistaDeCarga = EjeDeCarga | "disponibilidad" | "asignacion";

/** Qué dice el subtítulo del panel en cada lectura. */
const SUBTITULO: Record<"disponibilidad" | "asignacion", string> = {
  disponibilidad:
    "Quiénes pueden estar en campo: la oferta declarada del equipo, por día y franja de 30 minutos.",
  asignacion:
    "Quién va a cada aplicación pactada: reparto parejo, sin solapes y repetible sobre la disponibilidad.",
};

export function AulasCargaDeCampo({
  filas,
  franjas,
  disponibilidad,
  reparto,
  onExportar,
  onFijarReparto = null,
  onConfirmarDuracion = null,
  onImportarDisponibilidad = null,
  onDeclararRango = null,
  onResortear = null,
  onConcentrar = null,
  distribucion = null,
  onPublicarDistribucion = null,
  onSincronizarDistribucion = null,
  sincronizacion = null,
  hoy = hoyISO(),
}: {
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /**
   * El bloque `franjas` del dashboard: las ventanas confirmadas YA parseadas
   * por el motor. La malla posiciona los confirmados desde aquí y nunca desde
   * `scheduled_time` crudo — el bug del 2026-09-02: «8:00pm» re-parseado en
   * el cliente pintaba a las 08:00 y el pico quedaba mal contado.
   */
  franjas?: MonitoreoAulasFranjas | null;
  /**
   * La malla de OFERTA del dashboard (B29). Ausente cuando la sesión no cargó
   * la clave de disponibilidad: las vistas nuevas lo declaran, no lo esconden.
   */
  disponibilidad?: MonitoreoAulasDisponibilidad | null;
  /** El gemelo de `disponibilidad`: el reparto vigente, recomputado al conversar. */
  reparto?: MonitoreoAulasReparto | null;
  /**
   * El libro sale con lo que hay EN PANTALLA —eje y duración—, no con los
   * valores por defecto: la duración es un control y exportar 30 minutos
   * mientras el usuario mira 90 entrega un pico que no es el que decidió.
   */
  onExportar?: (opciones: OpcionesDeCarga) => void;
  /** Fijar/soltar el aplicador de una cita (B36); lo consume Asignación. */
  onFijarReparto?: ((mapa: Record<string, string>) => void | Promise<void>) | null;
  /**
   * B70: persistir la duración confirmada (config `duracion_aplicacion_min`).
   * Sin él, el slider vuelve a ser estado local que se pierde — el bug del
   * dictado 2026-09-03: el aviso salía con 20 mientras el slider decía 30.
   */
  onConfirmarDuracion?: ((min: number) => void | Promise<void>) | null;
  /** B74: importar el excel de disponibilidad; lo pinta la vista Disponibilidad. */
  onImportarDisponibilidad?: ((archivo: File) => void | Promise<void>) | null;
  /** B75: declarar/limpiar el rango de despliegue; lo pinta Asignación. */
  onDeclararRango?: ((rango: { desde: string; hasta: string } | null) => void | Promise<void>) | null;
  /** B67: pedir otro sorteo (persiste la semilla siguiente). */
  onResortear?: ((semillaSiguiente: number) => void | Promise<void>) | null;
  /** S7: el Sheets de los aplicadores (recordado + huella vigente) y su publicación. */
  distribucion?: { recordado?: DistribucionSheetsRecordada; vigente?: DistribucionVigente } | null;
  onPublicarDistribucion?: ((enlace?: string) => void | Promise<void>) | null;
  onSincronizarDistribucion?: ((aplicar: boolean) => void | Promise<void>) | null;
  sincronizacion?: MonitoreoAulasSincronizacion | null;
  /** Dictado 2026-09-04: encender/apagar la concentración por día; lo pinta Asignación. */
  onConcentrar?: ((valor: boolean) => void | Promise<void>) | null;
  /** El día del operativo (`YYYY-MM-DD`); inyectable para el test. */
  hoy?: string;
}) {
  // B70: la verdad inicial viene del MOTOR (eco `duracion_min` de franjas),
  // no de una constante local — el slider muestra la duración con la que el
  // backend armó las ventanas que esta vista pinta.
  const duracionDelMotor = Number.isFinite(franjas?.duracion_min)
    ? (franjas!.duracion_min as number)
    : null;
  const [duracionMin, setDuracion] = useState(duracionDelMotor ?? DURACION_POR_DEFECTO);
  const editandoDuracionRef = useRef(false);
  useEffect(() => {
    // Un Recargar puede traer otra duración (otro dispositivo la confirmó);
    // se adopta salvo que el usuario esté editando en este momento — pisarle
    // el slider a media edición sería el mismo roce que B35 vino a matar.
    if (duracionDelMotor !== null && !editandoDuracionRef.current) {
      setDuracion((previa) => previa === duracionDelMotor ? previa : duracionDelMotor);
    }
  }, [duracionDelMotor]);
  // El slider vive detrás de un lápiz (dictado 2026-09-02: «muy accesible
  // para editar… una vez confirmas que dura por ejemplo 30 se queda allí
  // hasta que lo edites»): confirmado el valor, el control se guarda y un
  // roce accidental ya no mueve toda la malla.
  const [editandoDuracion, setEditandoDuracion] = useState(false);
  // `null` = todavía no lo eligió nadie, así que manda la sugerencia. Fijar la
  // vista en el estado inicial la congelaría con el plan VACÍO del primer
  // render —el dashboard llega después— y abriría siempre en semanal por muy
  // agendado que estuviera el estudio.
  const [vistaElegida, setVista] = useState<VistaDeCarga | null>(null);
  const vista = vistaElegida ?? ejeSugerido(filas);
  const esDemanda = vista === "semana" || vista === "calendario";
  // El eje de la malla de DEMANDA. En las vistas de oferta y asignación no se
  // pinta, pero se calcula igual: sus columnas entran al eje compartido.
  const eje: EjeDeCarga = vista === "calendario" ? "calendario" : "semana";
  // La celda explorada (dictado en vivo 2026-09-02: «cada 30 mins con
  // hover»): hover o foco la asoman, un click la fija. Estado UI efímero de
  // esta superficie — no es un panel enlazable ni un foco de entidad, el
  // mismo criterio que el eslabón de la Agenda.
  const [celdaActiva, setCeldaActiva] = useState<{ d: number; j: number } | null>(null);
  const [fijada, setFijada] = useState(false);
  // B37 (dictado 2026-09-02: «el calendario se ve mejor»): click en la FECHA
  // deja el día entero en el detalle — el parte del día sin recorrer diez
  // celdas con el puntero. El hover de una celda lo tapa transitorio y al
  // salir el día vuelve; otro click en la fecha lo suelta.
  const [diaActivo, setDiaActivo] = useState<number | null>(null);
  // La semana visible del calendario. `null` = todas: paginar es un gesto del
  // usuario, no un recorte de apertura.
  const [semanaIdx, setSemanaIdx] = useState<number | null>(null);

  const ventanas = useMemo(() => ventanasDelMotor(franjas), [franjas]);
  // B71: los minutos del protocolo, del eco del motor (con el default del
  // operativo si el payload es viejo) — la malla cuenta la ocupación con los
  // MISMOS números que el reparto.
  const preparacionMin = Number.isFinite(franjas?.preparacion_min)
    ? (franjas!.preparacion_min as number) : 30;
  const salidaMin = Number.isFinite(franjas?.salida_min)
    ? (franjas!.salida_min as number) : 15;
  const malla = useMemo(
    () => calcularCarga(filas, { duracionMin, eje, ventanas, preparacionMin, salidaMin }),
    [filas, duracionMin, eje, ventanas, preparacionMin, salidaMin],
  );
  // Los bloques de B29, normalizados. `null` = la sesión no cargó la clave de
  // disponibilidad, y las vistas nuevas declaran qué falta y de dónde sale.
  const oferta = useMemo(() => mallaDeOferta(disponibilidad), [disponibilidad]);
  // Dictado 2026-09-04: la Asignación necesita la HORA de una cita
  // descubierta para poder decir quién tendría ese horario; el reparto trae
  // el código pelado y la hora vive en el bloque `franjas`. Es otra lectura
  // del MISMO bloque que `ventanasDelMotor` —no otra verdad—: aquella indexa
  // por código para posicionar la malla de demanda y sólo guarda el inicio;
  // ésta indexa por fecha y código y conserva las dos puntas, que es lo que
  // pide el solape contra la oferta.
  const ventanasDeCita = useMemo(() => ventanasPorCita(franjas), [franjas]);
  const repartoVista = useMemo(() => repartoDeAplicadores(reparto), [reparto]);
  // El bloque `reparto` viaja sin lugares: la tabla de Asignación los busca en
  // el plan, con la MISMA regla que el detalle (lugar confirmado del libro
  // primero — dictado «LUGAR DE APLICACIÓN», 2026-09-02).
  const lugares = useMemo(() => lugaresDelPlan(filas), [filas]);
  // Dictado 2026-09-04: «el cuadro no muestra la facultad». Sale del plan,
  // como el lugar: el bloque `reparto` no la trae.
  const facultades = useMemo(() => facultadesDelPlan(filas), [filas]);
  const pabellones = useMemo(() => porPabellon(filas), [filas]);
  const { semanas, sinSemana } = useMemo(() => semanasDeCarga(malla.filas), [malla]);
  // Qué filas de fecha están en pantalla. `null` = todas; las fechas sin
  // semana legible se pintan SIEMPRE — recortarlas al paginar sería perder
  // filas que la malla completa sí enseña.
  const visibles = useMemo(() => {
    if (eje !== "calendario" || semanaIdx === null || !semanas[semanaIdx]) return null;
    return new Set([...semanas[semanaIdx].indices, ...sinSemana]);
  }, [eje, semanaIdx, semanas, sinSemana]);

  const cambiarVista = (valor: VistaDeCarga) => {
    // Los índices de celda y semana son de la malla del eje: al cambiarlo se
    // sueltan, o apuntarían a otra fila con el mismo número.
    setVista(valor);
    setCeldaActiva(null);
    setFijada(false);
    setSemanaIdx(null);
  };
  const paginar = (delta: number) => {
    setSemanaIdx((prev) => {
      const base = prev ?? (delta > 0 ? -1 : semanas.length);
      return Math.min(semanas.length - 1, Math.max(0, base + delta));
    });
  };

  // Sólo se pintan las franjas donde ocurre algo: de 07:00 a 22:00 hay treinta
  // columnas y más de un tercio están siempre vacías. Con la oferta cargada,
  // «algo» incluye SUS columnas: demanda y oferta comparten juego de columnas
  // para que conmutar entre las vistas compare posiciones y no un espejismo.
  const vivas = useMemo(
    () =>
      columnasVivas(
        malla.franjas.length,
        oferta ? [malla.aulas, oferta.disponibles] : [malla.aulas],
      ),
    [malla, oferta],
  );
  // B38 (dictado 2026-09-02: «disponibilidad se ve mejor»): la demanda
  // CONFIRMADA entra a la malla de oferta, alineada por día — la vista
  // contestaba «conmuta con el patrón semanal para ver si la gente alcanza»,
  // que es confesar que sola no podía. Mismo eje de franjas y columnas
  // compartidas; el día casa por etiqueta (las filas semanales SON los DIAS).
  const demandaFirme = useMemo(() => {
    if (!oferta || eje !== "semana") return null;
    const porEtiqueta = new Map(malla.filas.map((f, d) => [f.etiqueta, malla.firmes[d]]));
    return oferta.filas.map((f) => porEtiqueta.get(f.etiqueta) ?? null);
  }, [oferta, malla, eje]);
  // Una escala por capa. Con un tope unico, el carril —que suma todas las
  // semanas— marcaba el maximo y las fechas quedaban todas en el tono mas
  // palido: 15 dias de operativo se veian como un lavado uniforme.
  // El suelo es 2, no 1. Con un maximo de 1 aula simultanea, dividir por el
  // maximo pinta TODA celda ocupada al 100% y la malla dice «pico en todas
  // partes» donde en realidad no se solapa nada: un aplicador a la vez no es
  // carga maxima. Con el suelo, 1 se lee palido y el color solo se satura
  // cuando de verdad hay concurrencia.
  const escala = (matriz: number[][]) => Math.max(2, ...malla.filas.map((_, d) => Math.max(...matriz[d])));
  const topeFirme = escala(malla.firmes);
  const topePlausible = escala(malla.plausibles);
  // Cuántas aulas SÍ entran en la malla. La usa el aviso del pie, y la rama
  // vacía se decide con `hayHorarioDeCurso()`, que es la misma pregunta que hace
  // quien envuelve este panel para decidir si le da el alto de la pantalla.
  // Son dos expresiones del mismo número —`titulares − sinHorario` es por
  // definición `unidades.length`— y `cargaDeCampo.test.ts` fija que no se
  // separen.
  const conHorario = filas.filter((f) => !f.sample_role || f.sample_role === "titular").length
    - malla.sinHorario;

  const hayMalla = hayHorarioDeCurso(filas);
  // El atajo compacto queda para el caso común: ni plan con horario ni bloques
  // de B29. Con la oferta o el reparto cargados, esconderlos detrás de este
  // párrafo sería dejar datos inalcanzables (C4): se pinta el marco completo y
  // cada vista declara su propio vacío.
  if (!hayMalla && !oferta && !repartoVista) {
    return (
      <section className="aulas-carga" data-qa-geometry-group="aulas-carga" data-qa-geometry-contract="intrinsic">
        <header className="aulas-carga-cab">
          <h3>Carga de campo</h3>
          {/* «Según el horario» admite justo la lectura que esta pantalla
              existe para corregir: la de contar por hora de INICIO, que sobre
              el plan de HSVG 2026 da un pico de 8 y el rango real da 19. La
              rama con datos ya lo dice con precisión y el Excel también; ésta,
              que es la que se ve mientras el plan no trae horarios, era la
              única de las tres que se prestaba al malentendido. */}
          <p>Cuántos aplicadores hacen falta a la vez, sobre el rango horario de cada curso.</p>
        </header>
        {/* La rama vacía declara lo mismo que la de datos: es donde el grupo
            se quedaba sin contenedor declarado y el `header` entraba en la
            medida con sus 4 px. */}
        <p className="aulas-carga-vacio" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
          El plan no trae el horario de los cursos-horario. Se completa al construir el marco desde el catálogo
          de Cursos-Horarios, que es de donde sale el rango de cada sesión.
        </p>
      </section>
    );
  }

  /**
   * Dos escalas de color, no una: lo CONFIRMADO en verde y lo que falta agendar
   * en el tono del módulo. Un solo degradado hacía pasar por lo mismo un hecho
   * —el docente ya dio hora— y un techo —cualquier tramo de su clase es
   * posible—, que es justo la distinción que esta vista existe para mostrar.
   */
  const celda = (firme: number, plausible: number) => {
    // La celda vacía NO se pinta: transparente deja pasar la regla de la hora
    // que lleva el `td`, y así la estructura de la malla la dan las horas y no
    // un campo de bloques grises compitiendo con los ocupados.
    if (firme + plausible === 0) return { background: "transparent", color: "var(--pulso-text-faint)" };
    if (firme > 0) {
      const t = firme / topeFirme;
      return {
        background: `color-mix(in srgb, var(--pulso-success-fg) ${Math.round(22 + t * 78)}%, var(--pulso-surface-2))`,
        color: t > 0.45 ? "var(--pulso-surface)" : "var(--pulso-text)",
      };
    }
    const t = plausible / topePlausible;
    return {
      color: "var(--pulso-text-soft)",
      background: `color-mix(in srgb, var(--pulso-module-monitoring) ${Math.round(8 + t * 30)}%, var(--pulso-surface))`,
      boxShadow: "inset 0 0 0 1px var(--pulso-border)",
    };
  };

  // El carril «por agendar» NO se pinta en el calendario (dictado en vivo
  // 2026-09-02: «el por agendar ya está en patrón semanal, no lo necesitas en
  // calendario»): es el patrón de lo pendiente y su sitio es el eje semanal.
  // El KPI «Por agendar, en el pico del patrón» queda declarando dónde vive.
  /**
   * Qué filas abren una semana nueva, para separarlas con una regla.
   *
   * Quince fechas seguidas se leen como una lista plana; en semanas se leen como
   * el operativo que son. Se detecta por el día de la semana yendo hacia atrás o
   * repitiéndose —las fechas vienen ordenadas—, y no por «es lunes»: un campo
   * que arranca un miércoles no tiene lunes en su primera semana.
   */
  const abreSemana = useMemo(() => {
    const marcas = new Set<string>();
    let previo = -Infinity;
    for (const fila of malla.filas) {
      if (fila.porAgendar || fila.fecha === undefined) continue;
      if (previo !== -Infinity && fila.dia <= previo) marcas.add(fila.clave);
      previo = fila.dia;
    }
    return marcas;
  }, [malla]);
  const cuando = malla.pico ? `${malla.pico.fila.etiqueta} ${comoHora(malla.pico.franja)}` : "—";

  return (
    <section className="aulas-carga" data-qa-geometry-group="aulas-carga" data-qa-geometry-contract="intrinsic">
      <header className="aulas-carga-cab">
        <div>
          <h3>Carga de campo</h3>
          {/* El subtítulo dice lo que la LECTURA activa enseña (C1): con la
              oferta o el reparto en pantalla, hablar de «lo confirmado» sería
              rotular una cosa con la promesa de otra. */}
          {esDemanda ? (
            <p>
              Cuántos aplicadores hacen falta a la vez. Lo confirmado se cuenta en su hora;
              lo que falta agendar, como rango posible sobre la clase entera.
            </p>
          ) : (
            <p>{SUBTITULO[vista as "disponibilidad" | "asignacion"]}</p>
          )}
        </div>
        <div className="aulas-carga-acciones">
          {/* Cuatro LECTURAS del mismo operativo, no un filtro: por eso es un
              segmentado y no un desplegable. Las dos primeras son la demanda
              (dos ejes de la misma malla); las otras dos, la oferta y su
              reparto. Los botones están SIEMPRE: sin datos, cada vista declara
              qué falta — esconder el botón escondería también la explicación. */}
          <div className="aulas-carga-eje" role="group" aria-label="Qué lectura de la carga se muestra">
            {([
              ["semana", "Patrón semanal", "Lunes a sábado, sobre el horario del curso"],
              ["calendario", "Calendario", "Una fila por fecha agendada"],
              ["disponibilidad", "Disponibilidad", "Quiénes pueden estar en campo, por día y franja"],
              ["asignacion", "Asignación", "El reparto vigente: quién va a cada cita"],
            ] as const).map(([valor, rotulo, ayuda]) => (
              <button
                key={valor}
                type="button"
                className={vista === valor ? "es-activo" : ""}
                aria-pressed={vista === valor}
                title={ayuda}
                onClick={() => cambiarVista(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {onExportar && esDemanda && hayMalla ? (
            /* El Excel sale con las MISMAS ventanas del motor que la vista:
               exportar con el texto crudo re-parsearía el «8:00pm». Solo en la
               demanda: es el libro de ESA malla, y ofrecerlo delante de la
               oferta prometería un contenido que no trae. */
            <button type="button" className="aulas-carga-exportar" onClick={() => onExportar({ duracionMin, eje, ventanas, preparacionMin, salidaMin })}>
              Descargar Excel
            </button>
          ) : null}
        </div>
      </header>

      {vista === "disponibilidad" ? (
        <AulasDisponibilidadDeAplicadores
          oferta={oferta}
          vivas={vivas}
          demandaFirme={demandaFirme}
          // El despliegue inminente sella su fila de semana (hermano de
          // B43/B46): la oferta de ESE día es la que alimenta el próximo
          // día de campo.
          fechaQueToca={repartoVista?.dias.find((x) => x.fecha >= hoy)?.fecha ?? null}
          onImportar={onImportarDisponibilidad}
        />
      ) : null}
      {vista === "asignacion" ? (
        <AulasAsignacionDeAplicadores
          reparto={repartoVista}
          lugares={lugares}
          facultades={facultades}
          oferta={oferta}
          ventanas={ventanasDeCita}
          onFijar={onFijarReparto}
          onDeclararRango={onDeclararRango}
          onResortear={onResortear}
          onConcentrar={onConcentrar}
          distribucion={distribucion}
          onPublicarDistribucion={onPublicarDistribucion}
          onSincronizarDistribucion={onSincronizarDistribucion}
          sincronizacion={sincronizacion}
        />
      ) : null}
      {esDemanda && !hayMalla ? (
        // El mismo vacío declarado del atajo compacto, dentro del marco
        // completo: la demanda no tiene malla, pero la oferta cargada sigue a
        // un click en su botón.
        <p className="aulas-carga-vacio" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
          El plan no trae el horario de los cursos-horario. Se completa al construir el marco
          desde el catálogo de Cursos-Horarios, que es de donde sale el rango de cada sesión.
        </p>
      ) : null}
      {esDemanda && hayMalla ? (<>
      <div className="aulas-carga-controles" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        <label>
          <span className="aulas-carga-duracion-cab">
            Duración de la aplicación: <strong>{fmt(duracionMin)} min</strong>
            {editandoDuracion ? (
              <button
                type="button"
                className="aulas-carga-duracion-boton"
                onClick={() => {
                  setEditandoDuracion(false);
                  editandoDuracionRef.current = false;
                  // B70: confirmar PERSISTE — la duración deja de ser estado
                  // local y rige ventanas, reparto y aviso del backend.
                  void onConfirmarDuracion?.(duracionMin);
                }}
                aria-label={`Confirmar la duración de ${fmt(duracionMin)} minutos`}
              >
                <Check size={13} aria-hidden="true" /> Confirmar
              </button>
            ) : (
              <button
                type="button"
                className="aulas-carga-duracion-boton"
                onClick={() => {
                  setEditandoDuracion(true);
                  editandoDuracionRef.current = true;
                }}
                aria-label="Editar la duración de la aplicación"
              >
                <Pencil size={13} aria-hidden="true" /> Editar
              </button>
            )}
            <em>{onConfirmarDuracion
              ? "se guarda en el estudio y rige ventanas, reparto y aviso"
              : "sólo afecta a los cursos-horario ya agendados"}</em>
          </span>
          {editandoDuracion ? (
            <input
              type="range"
              min={10}
              max={180}
              step={5}
              value={duracionMin}
              onChange={(e) => setDuracion(Number(e.target.value))}
              aria-label="Duración de la aplicación dentro del aula, en minutos"
            />
          ) : null}
        </label>
        <dl className="aulas-carga-kpis">
          <div>
            {/* B71: la banda firme cuenta la hora COMPLETA del aplicador
                (recojo incluido) — el rótulo dice ocupados, no confirmados. */}
            {/* Dictado 2026-09-03 («este KPI no aporta mucho y no se
                entiende»): los cuatro rótulos del racimo se reescriben en
                castellano llano, cada uno con su title que lo explica. */}
            <dt title="Cuántos aplicadores están tomados a la vez en el peor momento, contando la hora completa de cada cita confirmada (recojo incluido)">
              Aplicadores ocupados a la vez
            </dt>
            <dd>{fmt(malla.pico?.firmes ?? 0)}</dd>
          </div>
          {/* El segundo indicador NO puede sumar el carril al pico de una fecha:
              son dos denominadores distintos —un día concreto contra el patrón
              de todas las semanas— y sumarlos da un número que no ocurre nunca.
              Por eso cada lectura tiene los suyos. */}
          {eje === "calendario" ? (
            <>
              <div>
                <dt>El momento más cargado</dt>
                <dd className="es-texto">{cuando}</dd>
              </div>
              <div>
                <dt title="Cursos-horario sin hora pactada cuya clase cruza ese momento, según el patrón semanal: podrían caer ahí al agendarse">
                  Podrían sumarse (aún sin hora)
                </dt>
                <dd>{fmt(malla.picoPorAgendar?.plausibles ?? 0)}</dd>
              </div>
              <div>
                <dt title="Fechas distintas con al menos una cita agendada">
                  Días de campo
                </dt>
                <dd>{fmt(malla.fechas)}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt title="Si todos los cursos-horario pendientes se agendaran en su franja posible, este sería el máximo de aplicadores a la vez">
                  Techo si se agenda todo lo pendiente
                </dt>
                <dd>{fmt((malla.pico?.firmes ?? 0) + (malla.pico?.plausibles ?? 0))}</dd>
              </div>
              <div>
                <dt>El momento más cargado</dt>
                <dd className="es-texto">{cuando}</dd>
              </div>
              <div>
                <dt title="Cuántas clases se están dictando en ese momento según el catálogo de sesiones">
                  Clases en aula a esa hora
                </dt>
                <dd>{fmt(malla.pico?.aulas ?? 0)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {eje === "calendario" && malla.fechas === 0 ? (
        <p className="aulas-carga-aviso">
          Ningún curso-horario tiene fecha todavía, así que el calendario no tiene filas que
          mostrar. El patrón semanal es la lectura que dimensiona el equipo mientras tanto — y es
          donde vive lo que falta agendar.
        </p>
      ) : null}

      {/* El pager por semana (dictado en vivo 2026-09-02: «scrolleable por
          semana»). Abre en «todas»: paginar es un gesto del usuario, no un
          recorte de apertura. «Hoy» salta a la semana del reloj del usuario. */}
      {eje === "calendario" && semanas.length > 1 ? (
        <div className="aulas-carga-semana" role="group" aria-label="Semana visible">
          <button type="button" onClick={() => paginar(-1)} aria-label="Semana anterior">‹</button>
          <strong>
            {semanaIdx === null || !semanas[semanaIdx]
              ? `Todas las semanas · ${fmt(semanas.length)}`
              : `Semana ${fmt(semanaIdx + 1)} de ${fmt(semanas.length)} · ${semanas[semanaIdx].etiqueta}`}
          </strong>
          <button type="button" onClick={() => paginar(1)} aria-label="Semana siguiente">›</button>
          <button type="button" onClick={() => setSemanaIdx(semanaInicial(semanas, hoyISO()))}>Hoy</button>
          {semanaIdx !== null ? (
            <button type="button" onClick={() => setSemanaIdx(null)}>Todas</button>
          ) : null}
        </div>
      ) : null}

      <div className="aulas-carga-malla-scroll" data-qa-geometry-member data-qa-geometry-capacity="owned">
        <table
          className="aulas-carga-malla"
          /* El piso de ancho crece con las columnas (`anchoMinimoDeMalla`): el
             fijo de la hoja recortaba los rótulos de hora en cuanto el eje
             compartido con la oferta sumó columnas. */
          style={{ minWidth: anchoMinimoDeMalla(vivas.length) }}
          onMouseLeave={() => { if (!fijada) setCeldaActiva(null); }}
        >
          <caption className="pulso-sr-only">
            Aplicadores ocupados por {eje === "calendario" ? "fecha" : "día"} y franja horaria, con{" "}
            {fmt(duracionMin)} minutos de aplicación
          </caption>
          <thead>
            <tr>
              <th scope="col">{eje === "calendario" ? "Fecha" : "Día"}</th>
              {vivas.map((j) => {
                const enPunto = malla.franjas[j] % 60 === 0;
                return (
                  <th key={j} scope="col" className={enPunto ? "es-hora" : "es-media"}>
                    {/* La media hora no se rotula: 25 etiquetas de 30 en 30 son
                        el mismo dato repetido. La regla vertical de `es-hora`
                        basta para saber en qué hora cae cada celda. */}
                    {enPunto ? comoHora(malla.franjas[j]) : <span className="pulso-sr-only">{comoHora(malla.franjas[j])}</span>}
                  </th>
                );
              })}
              {/* El total de la fila: cuántos cursos-horario DISTINTOS pisan
                  ese día — no la suma de celdas, que repetiría cada banda. */}
              <th scope="col" className="aulas-carga-total-cab" title="Cursos-horario distintos del día">CH</th>
            </tr>
          </thead>
          <tbody>
            {/* B46, hermano de B43: en el eje calendario, la fila del día que
                toca lleva su sello y lo pasado se atenúa — la misma lectura de
                despliegue que la Asignación, en la malla. */}
            {(() => {
              const proximaFecha = eje === "calendario"
                ? malla.filas.find((f) => f.fecha && f.fecha >= hoy)?.fecha ?? null
                : null;
              return malla.filas.map((fila, d) => ({ fila, d, proximaFecha }));
            })().map(({ fila, d, proximaFecha }) => (
              <Fragment key={fila.clave}>
                {fila.porAgendar || (visibles !== null && !visibles.has(d)) ? null : (
                <tr
                  className={[
                    abreSemana.has(fila.clave) ? "abre-semana" : "",
                    proximaFecha !== null && fila.fecha === proximaFecha ? "es-el-que-toca" : "",
                    proximaFecha !== null && fila.fecha !== undefined && fila.fecha < hoy ? "es-pasado" : "",
                  ].filter(Boolean).join(" ") || undefined}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className={`aulas-carga-dia${diaActivo === d ? " es-activo" : ""}`}
                      aria-pressed={diaActivo === d}
                      aria-label={`${fila.etiqueta}: ver todas sus citas en el detalle`}
                      title={`Ver todas las citas de ${fila.etiqueta}`}
                      onClick={() => {
                        setDiaActivo(diaActivo === d ? null : d);
                        setCeldaActiva(null);
                        setFijada(false);
                      }}
                    >
                      {fila.etiqueta}
                    </button>
                    {proximaFecha !== null && fila.fecha === proximaFecha ? (
                      <span className="aulas-carga-toca">{fila.fecha === hoy ? "hoy" : "próxima salida"}</span>
                    ) : null}
                  </th>
                  {vivas.map((j) => {
                    const firme = malla.firmes[d][j];
                    const plausible = malla.plausibles[d][j];
                    const n = firme + plausible;
                    // El pico del operativo se marca EN la malla, no sólo en el
                    // KPI.
                    const esPico = Boolean(malla.pico && malla.pico.dia === d && malla.pico.franja === malla.franjas[j]);
                    const activa = celdaActiva?.d === d && celdaActiva?.j === j;
                    const titulo = tituloDeCelda(fila.etiqueta, comoHora(malla.franjas[j]), firme, plausible, malla.aulas[d][j])
                      + (esPico ? " · pico del operativo" : "");
                    return (
                      <td key={j} className={malla.franjas[j] % 60 === 0 ? "es-hora" : undefined}>
                        {n ? (
                          /* Ocupada = botón: hover o foco asoman su detalle en el
                             panel de abajo y el click la fija — el equivalente
                             accesible del hover pedido. Las vacías quedan como
                             span: cien tab-stops muertos no son acceso. */
                          <button
                            type="button"
                            className={`aulas-carga-celda${firme === 0 && plausible > 0 ? " es-plausible" : ""}${esPico ? " es-pico" : ""}${activa ? " es-activa" : ""}`}
                            style={celda(firme, plausible)}
                            title={titulo}
                            aria-label={nombreDeCelda(fila.etiqueta, comoHora(malla.franjas[j]), firme, plausible)
                              + (esPico ? ". Pico del operativo" : "")}
                            aria-pressed={fijada && activa}
                            onMouseEnter={() => { if (!fijada) setCeldaActiva({ d, j }); }}
                            onFocus={() => { if (!fijada) setCeldaActiva({ d, j }); }}
                            onClick={() => {
                              if (fijada && activa) { setFijada(false); return; }
                              setCeldaActiva({ d, j });
                              setFijada(true);
                            }}
                          >
                            {/* B39, segunda ronda (veredicto de Gonzalo
                                2026-09-02 mirando el «+N»: «no se ve…
                                francamente mal… estás combinando más cosas a
                                la vez»): la celda con confirmados dice SOLO el
                                confirmado — al confirmarse, el curso deja la
                                banda rosa y es únicamente verde. El techo de
                                los que faltan no se mezcla en el número: vive
                                en el hover, el nombre accesible y el detalle.
                                Primera ronda: la suma pintaba «12» donde el
                                cruce real era 1. */}
                            {firme > 0 ? firme : n}
                          </button>
                        ) : (
                          <span className="aulas-carga-celda" style={celda(firme, plausible)} title={titulo} />
                        )}
                      </td>
                    );
                  })}
                  <td className="aulas-carga-total">
                    {(() => {
                      const distintos = new Set<string>();
                      for (const c of malla.quienes[d]) for (const o of c) distintos.add(o.codigo);
                      return distintos.size ? fmt(distintos.size) : "";
                    })()}
                  </td>
                </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* El detalle de la celda explorada: QUIÉNES caen en esa franja. Región
          fija bajo la malla y no un tooltip flotante: no pelea con el scroll
          horizontal, la lee el teclado igual que el puntero y el gate puede
          medirla. */}
      <div className="aulas-carga-detalle" role="status" data-qa-geometry-member data-qa-geometry-capacity="owned">
        {(() => {
          const activa = celdaActiva && malla.quienes[celdaActiva.d]?.[celdaActiva.j]?.length
            ? celdaActiva
            : null;
          // COMPLETO, sin techo (dictado 2026-09-02: «no pones las cosas
          // completas y actúas como si no tuvieras espacio cuando la pestaña
          // puede darle más espacio sin problema»). El recorte de 8 con «y N
          // más» quedó revocado: la lista larga se reparte en columnas
          // (flex-wrap) y crece hacia abajo — el panel es intrínseco y el
          // scroll lo tiene mon-workbench-content.
          const grupo = (lista: OcupanteDeCelda[], rotulo: string) => (lista.length ? (
            <div className="aulas-carga-detalle-grupo">
              <h4>{rotulo} · {fmt(lista.length)}</h4>
              <ul>
                {/* Las tres señas de la cita (dictado: «ni la fecha exacta ni
                    la hora en la que se acordó ir ni qué etapa de la clase»):
                    fecha exacta —en el patrón semanal la fila «sábado» agrega
                    varios sábados—, hora pactada textual y momento acordado.
                    Lo no acordado se omite, no se inventa. */}
                {/* Jerarquizada, no prosa con puntos medios (dictado
                    2026-09-02: «el formato y la estructura puede verse mucho
                    mejor»): código fuerte, docente en su línea y las señas
                    como fila de chips — el lugar con el color de su letra, la
                    hora en su cuadrito. */}
                {lista.map((o) => (
                  <li key={o.codigo} className="aulas-carga-cita">
                    <span className="aulas-carga-cita-cab">
                      <strong className="aulas-carga-cita-codigo">{o.codigo}</strong>
                      {o.docente ? <span className="aulas-carga-cita-docente">{o.docente}</span> : null}
                    </span>
                    {o.lugar || o.facultad || o.fecha || o.hora || o.momento ? (
                      <span className="aulas-carga-cita-chips">
                        {o.lugar ? <ChipLugar lugar={o.lugar} /> : null}
                        {/* La facultad tambien es seña del box (dictado
                            2026-09-02): quien reparte piensa por facultad. */}
                        {o.facultad ? <ChipDato>{o.facultad}</ChipDato> : null}
                        {o.fecha ? <ChipDato>{fechaCorta(o.fecha)}</ChipDato> : null}
                        {/* B73 (dictado 2026-09-03): «toda la secuencia y de
                            qué hora a qué hora… cuándo finaliza». La
                            preparación en tenue, la aplicación con su FIN. */}
                        {o.recojo ? (
                          /* Como BOX del sistema (dictado 2026-09-03: «esto
                             debería salir como un box como el resto»). */
                          <ChipPrep>
                            recojo {o.recojo}{o.salida ? ` · sale ${o.salida}` : ""}
                          </ChipPrep>
                        ) : null}
                        {o.rango
                          ? <ChipHora>{o.rango}</ChipHora>
                          : o.hora ? <ChipHora>{o.hora}</ChipHora> : null}
                        {o.momento ? <ChipDato>{MOMENTO_LEGIBLE[o.momento]}</ChipDato> : null}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null);
          if (activa) {
            const ocupantes = malla.quienes[activa.d][activa.j];
            return (
              <>
                <p className="aulas-carga-detalle-titulo">
                  <strong>{malla.filas[activa.d].etiqueta}</strong>{" "}
                  <ChipHora>{comoHora(malla.franjas[activa.j])}–{comoHora(malla.franjas[activa.j] + 30)}</ChipHora>
                  {fijada ? <em> · fijada; otro click la suelta</em> : null}
                </p>
                {grupo(ocupantes.filter((o) => o.confirmada), "Confirmados")}
                {grupo(ocupantes.filter((o) => !o.confirmada), "Por agendar (toda su clase es posible)")}
              </>
            );
          }
          // B37: el parte del día — click en la fecha, todas sus citas de
          // una vez, cada curso UNA vez y en orden de arranque.
          if (diaActivo !== null && malla.filas[diaActivo]) {
            const delDia = citasDeLaFila(malla, diaActivo);
            if (delDia.length) {
              return (
                <>
                  <p className="aulas-carga-detalle-titulo">
                    <strong>{malla.filas[diaActivo].etiqueta}</strong>{" "}
                    <ChipDato>día completo · {fmt(delDia.length)} cursos-horario</ChipDato>
                    {/* A qué edificios se va ese día — en palabras del lector
                        (dictado 2026-09-03: «no me gusta el A×3, debe ser
                        3 aplicaciones en A»): la primera entrada lleva la
                        palabra completa y las siguientes la abrevian sin
                        perder el número. */}
                    {pabellonesDeLasCitas(delDia).map((p, k) => (
                      <span key={p.pabellon} className="aulas-carga-detalle-pabellon">
                        {p.pabellon === "otros"
                          ? <ChipDato>{fmt(p.aulas)} en otros edificios</ChipDato>
                          : <>
                              <em>{k === 0
                                ? (p.aulas === 1 ? "1 aplicación en" : `${fmt(p.aulas)} aplicaciones en`)
                                : `${fmt(p.aulas)} en`}</em>
                              <ChipLugar lugar={p.pabellon} />
                            </>}
                      </span>
                    ))}
                    <em> · otro click en la fecha lo suelta</em>
                  </p>
                  {grupo(delDia.filter((o) => o.confirmada), "Confirmados")}
                  {grupo(delDia.filter((o) => !o.confirmada), "Por agendar (toda su clase es posible)")}
                </>
              );
            }
          }
          // «La malla» y no «una celda»: el guard del perfil reserva esa
          // palabra para la hoja de cálculo del equipo.
          return (
            <p className="aulas-carga-detalle-vacio">
              Pasa el puntero o el foco por la malla para ver qué cursos-horario caen en cada
              franja de 30 minutos; un click deja la franja fijada. Click en una fecha deja su
              día completo.
            </p>
          );
        })()}
      </div>

      <div className="aulas-carga-pie">
        <ul className="aulas-carga-leyenda">
          <li><i style={celda(topeFirme, 0)} aria-hidden="true" />Confirmado · su hora completa, del recojo de materiales al fin de la aplicación</li>
          <li><i style={celda(0, topePlausible)} aria-hidden="true" />Por agendar · toda su clase es posible; sobre una franja verde se ve al pasar el puntero</li>
          {eje === "calendario" ? (
            <li><span className="aulas-carga-toca">próxima salida</span> el primer día de campo que viene: ahí se despliega el equipo</li>
          ) : null}
          <li className="aulas-carga-estado">
            {fmt(malla.agendadas)} de {fmt(malla.agendadas + malla.porAgendar)} cursos-horario ya tienen hora
          </li>
        </ul>
        <p className="aulas-carga-pabellones">
          <span>Por pabellón:</span>
          {/* Todos, sin recorte: el techo de 9 era el mismo gemelo que el
              dictado 2026-09-02 revocó. La línea envuelve y crece. Cada letra
              lleva SU chip —el mismo color que el A703 del detalle— y las dos
              bolsas sin edificio van en chip neutro: pintarlas como un
              pabellón inventaría uno. */}
          {pabellones.map((p) => (
            <span key={p.pabellon} className="aulas-carga-pabellon">
              {/^[A-ZÁÉÍÓÚÑ]$/u.test(p.pabellon)
                ? <ChipLugar lugar={p.pabellon} />
                : <ChipDato>{p.pabellon}</ChipDato>}
              {" "}{fmt(p.aulas)}
            </span>
          ))}
        </p>
      </div>

      {eje === "calendario" && malla.agendadasSinFecha > 0 ? (
        <p className="aulas-carga-aviso">
          {malla.agendadasSinFecha === 1
            ? "1 curso-horario tiene hora acordada pero no fecha, así que no cabe"
            : `${fmt(malla.agendadasSinFecha)} cursos-horario tienen hora acordada pero no fecha, así que no caben`}{" "}
          en el calendario. {malla.agendadasSinFecha === 1 ? "Aparece" : "Aparecen"} en el patrón semanal.
        </p>
      ) : null}

      {malla.sinHorario > 0 ? (
        <p className="aulas-carga-aviso">
          {fmt(malla.sinHorario)} de {fmt(malla.sinHorario + conHorario)} cursos-horario no declaran horario en el
          catálogo y no entran en este cálculo.
        </p>
      ) : null}
      </>) : null}
    </section>
  );
}
