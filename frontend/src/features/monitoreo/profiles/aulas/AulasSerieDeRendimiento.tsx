import { useMemo, useState } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { sexSeriesKind, sexSeriesLabel } from "../../../calcMuestra/sexoPalette";
import { personasPorAula, personasProyectadas } from "./redondeoConservador";
import { serieDeRendimiento, veredictoDeCeldaDeCuota } from "./serieDeRendimiento";
import { fmt } from "./kpisDeAulas";
import { anchoDeBarraDelDia } from "./anchoDeBarra";

/**
 * El rendimiento diario de cada facultad, y el que cabe esperar de la próxima
 * aula suya.
 *
 * Gonzalo lo pidió así y hay que leerlo entero: «no veo los gráficos de línea
 * separados por facultades que vayan midiendo el rendimiento diario y el cálculo
 * inferencial de aquel rendimiento»; y sobre la idea de recortar el número de
 * líneas: «no entiendo por qué veinte gráficos no entrarían, y en todo caso, si
 * veinte no entran, no se puede tener como una especie de botón o slider que
 * permita ir de facultad en facultad, y un gráfico también general».
 *
 * Así que son las dos vistas, no una:
 *
 * - **Todas**: una línea fina por facultad, para ver la dispersión de un golpe.
 *   Veinte líneas en un gráfico de líneas es lo que un gráfico de líneas hace.
 * - **Una**: su serie en grueso, **su esperado en punteado gris** y la media del
 *   estudio de referencia, que es cuando se puede leer de verdad.
 *
 * El esperado no es un suavizado: es la media posterior Gamma-Poisson de
 * `serieDeRendimiento`, o sea cuánto cabe esperar de la SIGUIENTE aula de esa
 * facultad dado lo que lleva. Por eso va en punteado y en gris: no es lo que
 * pasó.
 */

const MARGEN = 4;
const UTIL = 100 - MARGEN * 2;
const dm = (fecha: string) => {
  const m = fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : fecha;
};

/**
 * La escala del eje vertical: un paso REDONDO y el tope que le corresponde.
 *
 * Dos arreglos en el mismo sitio, porque son el mismo problema.
 *
 * 1. Eran tres escalones —tope, mitad y cero— y con eso no se puede situar un
 *    punto a ojo: entre dos referencias hay 160 px y hay que interpolar.
 * 2. Y salían de multiplicar el tope por 0,75 · 0,5 · 0,25, así que un tope de
 *    45 daba **34 · 23 · 11**. Gonzalo: «los ticks del eje y pueden tener saltos
 *    más lógicos, como cada 20 o cada 10». Un eje se lee por su paso, no por sus
 *    fracciones: nadie interpola sobre 11,25.
 *
 * El paso sale de la serie 1 · 2 · 2,5 · 5 · 10 por la potencia de diez que toque,
 * eligiendo el más fino que deje cinco divisiones o menos, y el tope se redondea
 * hacia arriba a un múltiplo de ese paso. 45 → paso 10 y tope 50; 240 → paso 50 y
 * tope 250; 4 400 → paso 1 000 y tope 5 000.
 */
/**
 * Todos los días de calendario entre dos fechas, ambas incluidas.
 *
 * El eje pintaba sólo los días CON dato y los repartía por índice, así que el
 * salto del viernes al lunes ocupaba lo mismo que un día: el gráfico mentía
 * sobre el ritmo. Un día vacío en el eje es información —un fin de semana, un
 * feriado, tres días parados—, no un hueco que sobra.
 */
export function diasDelRango(desde: string, hasta: string): string[] {
  if (!desde || !hasta) return [desde, hasta].filter(Boolean);
  const dias: string[] = [];
  // En UTC: `new Date("2026-08-10")` ya es medianoche UTC, y sumar días con
  // `setUTCDate` no se rompe con el horario de verano de ninguna zona.
  const fin = new Date(`${hasta}T00:00:00Z`).getTime();
  const cursor = new Date(`${desde}T00:00:00Z`);
  // Tope de seguridad: un `hasta` corrupto no debe colgar la vista.
  for (let i = 0; cursor.getTime() <= fin && i < 400; i += 1) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias.length ? dias : [desde];
}

/** Domingo, que no es día de campo. Se marca en el eje para que el hueco se lea. */
/** Alto del lienzo del acumulado, en px. Igual que `.aulas-serie-grafico`. */
const ALTO_DEL_LIENZO = 368;
/** Alto de una etiqueta de meta más su aire: 11 px de texto y 3 de respiro. */
const ALTO_DE_LA_META = 14;

/**
 * Aparta las etiquetas de meta que caerían una encima de otra.
 *
 * Cada una se coloca en `top: y(valor)%`, o sea que su posición sale SOLO del
 * valor. Con el fixture actual —meta de mujeres 2 089 y de hombres 1 654— hay
 * 7 px entre ellas y no se nota, pero **nada lo impide**: en un estudio con la
 * cuota repartida mitad y mitad, que es el caso más común, las dos metas son
 * casi el mismo número y sus etiquetas se montan una sobre otra hasta quedar
 * ilegibles. Es el mismo choque que los chips de cruce ya resuelven fundiéndose,
 * en la única capa del gráfico que no lo tenía.
 *
 * No se fusionan como aquellos: dos metas del mismo valor siguen siendo dos
 * cuotas distintas y decir «las dos, 1 870» perdería de cuál es cada línea. Se
 * separan lo justo, de arriba abajo, conservando el orden por valor para que
 * cada etiqueta siga al lado de su línea.
 */
export function separaLasMetas<T extends { y: number }>(metas: ReadonlyArray<T>): T[] {
  const minimo = (100 * ALTO_DE_LA_META) / ALTO_DEL_LIENZO;
  // De arriba abajo: `y` en porcentaje crece hacia abajo, como el `top` del CSS.
  const orden = [...metas].sort((a, b) => a.y - b.y);
  let ultima = -Infinity;
  return orden.map((m) => {
    const y = Math.max(m.y, ultima + minimo);
    ultima = y;
    return { ...m, y };
  });
}

export function esDomingo(fecha: string): boolean {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * Un trozo del globo del hover.
 *
 * Era una lista de cadenas y salian cinco lineas de texto plano. Gonzalo: «el
 * hover puede ser mas minimalista y hacer uso de los colores para referenciar
 * hombres y mujeres». Con un punto del color de la serie, la cifra ya dice de
 * quien es y la palabra sobra —y con ella, la linea entera—.
 */
type TrozoDePista =
  | string
  /** Una fila de cifras con su color: `● 1 366   ● 995`. */
  | { cifras: Array<{ valor: string; color: string; de: string }> }
  /** Texto secundario, mas tenue y mas pequeño. */
  | { tenue: string }
  /** La cifra que la tarjeta viene a dar, con su unidad. Ver `lineasDelDia`. */
  | { titular: string; unidad: string };

/** Lo que lee un lector de pantalla: el globo pintado, en palabras. */
function pistaEnPalabras(trozos: ReadonlyArray<TrozoDePista>): string {
  return trozos.map((t) => {
    if (typeof t === "string") return t;
    if ("tenue" in t) return t.tenue;
    // El titular se lee con su unidad: «18 efectivas del parte», no «18».
    if ("titular" in t) return `${t.titular} ${t.unidad}`;
    return t.cifras.map((c) => `${c.valor} ${c.de}`).join(" · ");
  }).join(", ");
}

/**
 * Separa las metas que caben en el eje de las que no.
 *
 * Vive fuera del componente para poder probarse: el invariante es que **toda
 * meta acaba en exactamente uno de los dos lados**, porque el lado «fuera» es
 * el que se declara en pantalla y el lado «cabe» es el que se dibuja. Si una se
 * perdiera entre los dos, volvería el silencio que este arreglo vino a quitar.
 */
export function repartirMetasPorEscala<T extends { meta: number }>(
  metas: ReadonlyArray<T>, tope: number,
): { caben: T[]; fuera: T[] } {
  const caben: T[] = [];
  const fuera: T[] = [];
  for (const m of metas) {
    // Un tope no finito o cero no autoriza a dibujar: sin escala no hay sitio
    // donde poner la línea, y suponer que cabe la manda al infinito.
    (Number.isFinite(tope) && tope > 0 && m.meta <= tope ? caben : fuera).push(m);
  }
  return { caben, fuera };
}

export function escalaDeEje(maximo: number): { tope: number; escalones: number[] } {
  const bruto = Math.max(1, maximo);
  const magnitud = Math.pow(10, Math.floor(Math.log10(bruto / 4)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((c) => bruto / c <= 5)
    ?? 10 * magnitud;
  const tope = Math.ceil(bruto / paso) * paso;
  const escalones: number[] = [];
  for (let v = tope; v > -paso / 2; v -= paso) escalones.push(Math.round(v));
  return { tope, escalones };
}

export function AulasSerieDeRendimiento({ partes, agenda = [], cuotas = [], plan = [], control = [], sobremuestra = null, jornadas = [], facultadEnFoco, onFoco }: {
  partes: ReadonlyArray<MonitoreoRow>;
  /** La facultad elegida, si viene de la URL. Manda sobre el estado local. */
  facultadEnFoco?: string;
  /** Para escribirla en la URL cuando alguien elige otra. */
  onFoco?: (foco: { tipo: "facultad"; valor: string }) => void;
  agenda?: ReadonlyArray<MonitoreoRow>;
  cuotas?: ReadonlyArray<MonitoreoRow>;
  /** El plan, sólo para los elegibles de cada aula ya aplicada. */
  plan?: ReadonlyArray<MonitoreoRow>;
  /** La Base de control del libro, que trae el reparto por sexo de cada aula. */
  control?: ReadonlyArray<MonitoreoRow>;
  /**
   * La sobremuestra del diseño, si el estudio la declara.
   *
   * Existe en Cálculo de muestra —`oversample_pct` como parámetro y
   * `oversample_n` en el resumen de `calc_muestra_aulas`— pero **no viaja al
   * monitoreo**: la config de aulas trae `selection_run_id` y `frame_hash`, o sea
   * el enlace a la corrida, y ninguna cifra de diseño. Hasta que viaje, esto
   * llega en `null` y la pantalla lo dice en vez de suponerlo.
   *
   * Y cuando llegue, se lee como lo que es: **la meta manda y la sobremuestra es
   * referencia**. Gonzalo: «sobrellegar a la muestra no es una necesidad [...]
   * la sobremuestra podría servir como un valor referencial».
   */
  sobremuestra?: number | null;
  /**
   * **El día como unidad**, calculado por el motor (tabla «Avance diario»).
   *
   * Gonzalo, 2026-09-08: «estas dimensiones por curso-horario, a mí no me
   * importa eso; me importa cuántas efectivas se hicieron en el día y cuántas se
   * tenían mapeadas». Y sobre este mismo gráfico: «el día a día ya tiene la
   * forma, le falta el fondo: la barra gris es lo que se espera del día y la
   * línea verde es lo que se tuvo».
   *
   * O sea, la forma estaba bien y lo que medía no. La barra medía los elegibles
   * POR curso-horario —el aforo de un aula media— y la línea, la mediana de las
   * facultades en esa misma unidad. Con estas jornadas la barra pasa a ser las
   * efectivas ESPERADAS del día y la línea, las conseguidas, que es la lectura
   * que se hace por la tarde.
   *
   * Vienen del motor y no se recalculan: son las mismas cifras que el libro y el
   * Sheets, así que el gráfico y la tabla no pueden discrepar.
   */
  jornadas?: ReadonlyArray<{ fecha: string; conseguidas: number; esperadas: number; diferencia: number }>;
}) {
  const modelo = useMemo(() => serieDeRendimiento(partes, plan, control), [partes, plan, control]);
  const proyeccion = useMemo(
    () => proyeccionPorAgenda(agenda, partes, cuotas),
    [agenda, partes, cuotas],
  );
  // **La facultad elegida viaja en la URL.**
  //
  // Era un `useState` suelto, y eso rompe la regla de la casa —«toda vista es
  // enlazable»— con una consecuencia práctica: no se puede mandar el enlace de
  // la serie de una facultad, ni capturarla para revisarla. La pirámide de
  // Cuotas ya lo resuelve con `?foco=facultad:X` y esta pestaña YA recibe ese
  // foco para otro panel; sólo faltaba usarlo aquí.
  //
  // El estado local se conserva como respaldo para cuando el padre no pasa
  // `onFoco`: la serie se monta en más de un sitio y quedarse sin selector
  // sería peor que no ser enlazable.
  const [focoLocal, setFocoLocal] = useState("");
  const foco = facultadEnFoco ?? focoLocal;
  const setFoco = (valor: string) => {
    setFocoLocal(valor);
    if (onFoco) onFoco({ tipo: "facultad", valor });
  };
  // El hover de verdad. El `title` nativo tarda un segundo, no se puede estilar y
  // en un punto de 7 px es casi imposible de acertar: «el hover tiene que
  // funcionar en los gráficos».
  const [pista, setPista] = useState<
    { x: number; y: number; lineas: TrozoDePista[]; bloque: "acumulado" | "diario" } | null
  >(null);

  if (!modelo.fechas.length || !modelo.facultades.length) {
  return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        Todavía no hay partes de campo con fecha: sin ellos no se puede medir
        cuánto deja cada visita.
      </p>
    );
  }

  const { fechas: aplicadas, facultades, mediaDelEstudio } = modelo;
  const elegida = facultades.find((f) => f.facultad === foco) ?? null;
  const dibujadas = elegida ? [elegida] : facultades;
  const proyectada = elegida ? proyeccion.find((p) => p.facultad === elegida.facultad) ?? null : null;

  /**
   * **Las barras del «Día a día», también sin facultad en foco.**
   *
   * Gonzalo, 2026-09-08: «no entiendo por qué se quitó; en el día a día tenía
   * una barra por día que representaba lo que se esperaba tener según las aulas
   * agendadas y lo que se va teniendo día a día».
   *
   * No se quitó: estaba condicionada a `elegida`, así que con «Todas las
   * facultades» —que es la vista por defecto— el `map` no se ejecutaba y el
   * gráfico se quedaba en líneas sobre un fondo vacío. La capacidad existía y
   * no se consumía en el caso más frecuente, que es el mismo modo de fallo que
   * ya se reparó en el acumulado con la franja de lo agendado.
   *
   * Se agrega por ÍNDICE de día, igual que el acumulado del estudio: `dias[i]`
   * de cada facultad corresponde a `aplicadas[i]`. Los elegibles y las aulas se
   * suman, y la vara del diseño se pondera por aulas — promediar las varas de
   * quince facultades daría un número que no es de ninguna, que es la misma
   * trampa de `rendimiento_ref` que la sesión del Sheets midió el mismo día.
   */
  // La jornada de cada fecha, para leerla por índice del eje.
  const jornadaDe = useMemo(() => {
    const m = new Map<string, { conseguidas: number; esperadas: number; diferencia: number }>();
    for (const j of jornadas) m.set(j.fecha, j);
    return m;
  }, [jornadas]);

  const diasConBarra = useMemo(() => {
    if (elegida) return elegida.dias;
    return aplicadas.map((fecha, i) => {
      let aulas = 0;
      let elegibles = 0;
      let efectivas = 0;
      let disenoPonderado = 0;
      let aulasConDiseno = 0;
      for (const f of facultades) {
        const d = f.dias[i];
        if (!d) continue;
        aulas += d.aulas ?? 0;
        elegibles += d.elegibles ?? 0;
        efectivas += d.efectivas ?? 0;
        const vara = d.esperadoPorAulaDelDiseno;
        if (vara != null && vara > 0 && d.aulas) {
          disenoPonderado += vara * d.aulas;
          aulasConDiseno += d.aulas;
        }
      }
      return {
        ...(facultades[0]?.dias[i] ?? {}),
        fecha,
        aulas,
        elegibles,
        efectivas,
        // El punto del día se dibuja a esta altura, y es la cifra que el eje
        // mide: encuestas POR curso-horario.
        porAula: aulas > 0 ? efectivas / aulas : null,
        esperadoPorAulaDelDiseno: aulasConDiseno > 0 ? disenoPonderado / aulasConDiseno : null,
      } as typeof elegida extends null ? never : (typeof facultades)[number]["dias"][number];
    });
  }, [elegida, facultades, aplicadas]);



  // Los días de la AGENDA que vienen después del último con parte. Sólo esos: la
  // inferencia no pasa de donde llega lo agendado, y donde no hay agenda no hay
  // línea —que es información, no un hueco: significa que no queda nada que
  // aplicar y hay que salir a agendar—.
  //
  // En la vista GENERAL los días agendados son los de TODO el estudio, no los de
  // ninguna facultad. Antes esta lista quedaba vacía cuando no había facultad
  // elegida y el pie afirmaba **«sin días agendados por delante»** con el estudio
  // teniendo aulas agendadas: la frase sólo era cierta bajo un supuesto que no
  // enunciaba —«de la facultad que tengas elegida»— y en esa vista no hay
  // ninguna. Un rótulo que vale igual para «no queda nada agendado» y para «no
  // estoy mirando una facultad» esconde justo el que decide si hay que salir a
  // agendar.
  const porVenir = proyectada
    ? proyectada.dias.map((d) => d.fecha)
    : [...new Set(proyeccion.flatMap((p) => p.dias.map((d) => d.fecha)))].sort();
  const fechas = [...aplicadas, ...porVenir];

  /** Lo mismo para los días por venir: el techo de lo ya agendado. */
  const diasProyectadosConBarra = useMemo(() => {
    if (proyectada) return proyectada.dias;
    return porVenir.map((fecha) => {
      let aulas = 0;
      let elegibles = 0;
      let esperadas = 0;
      for (const f of proyeccion) {
        const d = f.dias.find((x) => x.fecha === fecha);
        if (!d) continue;
        aulas += d.aulas ?? 0;
        elegibles += d.elegibles ?? 0;
        esperadas += d.esperadas ?? 0;
      }
      return { fecha, aulas, elegibles, esperadas };
    });
  }, [proyectada, proyeccion, porVenir]);

  // El techo del eje: lo más alto que se llega a dibujar, con un respiro. Se
  // calcula sobre lo que SE VE, no sobre todo el modelo, para que al elegir una
  // facultad la escala se ajuste a ella.
  const valores = dibujadas.flatMap((f) => [
    ...f.dias.map((d) => d.porAula ?? 0),
    ...(elegida ? f.dias.map((d) => d.esperado) : []),
    // **Las barras cuentan para el techo del eje.** Sin ellas el `tope` salía de
    // las líneas y las barras se dibujaban por encima del área útil: `y` daba
    // 0.93 con el margen en 4, o sea el rectángulo empezaba fuera del gráfico y
    // se veía cortado contra el borde del panel. Un elemento que no cabe en su
    // eje no es un elemento mal pintado: es un eje mal calculado.
    ...(elegida ? f.dias.map((d) => (d.aulas ? d.elegibles / d.aulas : 0)) : []),
    // **Y el borde ALTO de la banda de credibilidad**, que también se dibuja
    // (línea ~1249) y no estaba aquí. Es el mismo defecto que el comentario de
    // arriba cuenta de las barras y el que se acaba de reparar en el gráfico de
    // acumulado: un elemento que no cabe en su eje es un eje mal calculado. La
    // banda es del mismo orden que la serie, así que incluirla no aplasta nada.
    ...f.dias.map((d) => d.esperadoBanda?.alto ?? 0),
  ]);
  // **Y las barras que se dibujan SIN foco.** Desde que el «Día a día» las
  // enseña también con «Todas las facultades» —Gonzalo: «no entiendo por qué se
  // quitó»— el techo tenía que contarlas, y no lo hacía: el eje se quedaba en 30
  // y las barras salían cortadas contra el borde. Gonzalo lo cazó a la primera:
  // «parece que el límite de 30 no es suficiente». Es exactamente el defecto que
  // el comentario de arriba cuenta de las barras con foco, repetido por no haber
  // seguido su propia lección al añadir el caso nuevo.
  // **Con jornadas, el eje mide TOTALES del día**: si siguiera saliendo de las
  // medias por curso-horario, la barra de 297 esperadas se dibujaría veinte
  // veces por encima del área útil. La unidad del eje sigue a la del dato.
  const techosDeJornada = jornadas.flatMap((j) => [j.conseguidas, j.esperadas]);
  const techosDeBarra = techosDeJornada.length ? [] : [
    ...diasConBarra.map((d) => (d.aulas ? d.elegibles / d.aulas : 0)),
    ...diasProyectadosConBarra.map((d) => (d.aulas ? d.elegibles / d.aulas : 0)),
  ];
  const techosDeAgenda = proyectada
    ? proyectada.dias.map((d) => (d.aulas ? d.elegibles / d.aulas : 0))
    : [];
  const { tope, escalones } = escalaDeEje(
    techosDeJornada.length
      // Con la unidad en totales, las medias por curso-horario no entran en la
      // escala: un eje que tuviera que albergar 297 y 17 a la vez aplastaría el
      // segundo contra el suelo.
      ? Math.max(...techosDeJornada, ...diasProyectadosConBarra.map((d) => d.esperadas ?? 0), 1)
      : Math.max(...valores, ...techosDeAgenda, ...techosDeBarra, mediaDelEstudio),
  );
  // **EL EJE ES UN CALENDARIO, no una lista de días con datos.** Gonzalo: «cada
  // tick del eje x debe ser un día de calendario sí o sí, ahora veo saltos de
  // varios días entre tick y tick». Y era literal: las fechas se repartían por
  // ÍNDICE, así que del 14/08 se pasaba al 17/08 sin que se notara que en medio
  // hay un sábado y un domingo. Con el eje ordinal, un fin de semana, un feriado
  // o tres días parados se dibujan como si fueran un día: **el gráfico mentía
  // sobre el ritmo**, que es justo lo que viene a medir.
  //
  // Ahora se pintan todos los días entre el primero con parte y el último
  // agendado. Un día sin actividad queda como hueco, y eso es información: es un
  // día que no se aprovechó, o un domingo, que no se aplica.
  const calendario = diasDelRango(fechas[0], fechas[fechas.length - 1]);
  /** Dónde cae una fecha en el eje. -1 si no está, que no debería pasar. */
  const enElEje = (fecha: string) => calendario.indexOf(fecha);
  const x = (i: number) => (calendario.length > 1 ? MARGEN + (UTIL * i) / (calendario.length - 1) : 50);
  const y = (v: number) => MARGEN + UTIL - (UTIL * v) / tope;
  /** Índice en las series, que siguen ordenadas por día CON parte. */
  const corte = aplicadas.length - 1;
  /** Y su sitio en el eje de calendario, que es donde se dibuja la frontera. */
  const corteX = aplicadas.length ? enElEje(aplicadas[corte]) : 0;

    /**
   * **El eje de días, uno solo para los dos gráficos** (Gonzalo, 2026-09-08:
   * «no veo el eje x que está alineado al gráfico de abajo»).
   *
   * Lo tenía sólo el «Día a día». El acumulado compartía la escala horizontal
   * —los dos lienzos empiezan y acaban en la misma abscisa, medido en pantalla—
   * pero no enseñaba las fechas, así que no se podía saber a qué día
   * correspondía cada punto sin bajar al gráfico de abajo y contar.
   *
   * Es el MISMO cálculo y no una copia: comparten `calendario`, `x()` y el corte
   * entre lo aplicado y lo agendado, así que las dos rejillas no pueden
   * separarse. Este panel ya aprendió que tres etiquetas en los extremos no
   * contestan «qué días aplicó» —Gonzalo, sobre la primera versión: «el eje que
   * es importantísimo, porque yo tengo que saber qué días aplicó»—: las marcas
   * están todas y las etiquetas se reservan para los días que dicen algo.
   */
  const ejeDeDias = (
      <ol className="aulas-serie-dias" aria-hidden="true">
        {calendario.map((f, i) => {
          const conDato = fechas.includes(f);
          const clases = [
            i > corteX ? "es-agenda" : "",
            esDomingo(f) ? "es-domingo" : "",
            conDato ? "" : "es-vacio",
          ].filter(Boolean).join(" ");
          // Con el eje en calendario hay más ticks que antes, así que la etiqueta
          // se reserva para los días que dicen algo: los que tienen dato, y los
          // extremos. El domingo se marca aunque esté vacío —es la razón del
          // hueco, y callarla deja el hueco sin explicar.
          const rotula = conDato || esDomingo(f) || i === 0 || i === calendario.length - 1;
          return (
            <li key={f} className={clases} style={{ left: `${x(i)}%` }}>
              <i />
              {rotula && (calendario.length <= 16 || conDato || esDomingo(f)) ? <span>{dm(f)}</span> : null}
            </li>
          );
        })}
      </ol>
  );

  /** El sitio en el eje del día `i` de las series aplicadas / agendadas. */
  const xa = (i: number) => x(enElEje(aplicadas[i]));
  const xp = (i: number) => x(enElEje(porVenir[i]));

  /** Las jornadas colocadas en el eje, en el orden de los días con parte. */
  const jornadasEnElEje = useMemo(
    () => aplicadas
      .map((fecha, i) => {
        const j = jornadaDe.get(fecha);
        return j ? { x: xa(i), conseguidas: j.conseguidas, esperadas: j.esperadas } : null;
      })
      .filter((v): v is { x: number; conseguidas: number; esperadas: number } => v != null),
    // `xa` se recrea en cada render y no cambia de significado; el eje depende
    // de las fechas, que sí están en la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aplicadas, jornadaDe],
  );


  /** Sólo los días en que esa facultad fue a algún aula: un hueco no es un cero. */
  const trazo = (dias: ReadonlyArray<{ porAula: number | null }>) => dias
    .map((d, i) => (d.porAula == null ? null : `${xa(i)},${y(d.porAula)}`))
    .filter(Boolean)
    .join(" ");

  // La vista general con veinte líneas verdes era una maraña —«el gráfico general
  // no se entiende bien», y era verdad—. Veinte series iguales no se leen una por
  // una, así que lo que se lee es la DISPERSIÓN: la banda entre el cuartil 1 y el
  // 3 de cada día, la mediana encima, y las veinte al fondo muy tenues para no
  // perder el detalle. Y con color, las dos que deciden: la que más rinde y la
  // que menos.
  const cuartiles = elegida ? [] : aplicadas.map((_, i) => {
    const v = facultades
      .map((f) => f.dias[i]?.porAula)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    if (!v.length) return null;
    const en = (q: number) => v[Math.min(v.length - 1, Math.floor(q * (v.length - 1)))];
    return { p25: en(0.25), p50: en(0.5), p75: en(0.75) };
  });
  const conBanda = cuartiles.filter(Boolean).length >= 2;

  /**
   * Lo que cabe esperar POR AULA cada día agendado, en la vista general.
   *
   * No es un promedio de los esperados de cada facultad: es el esperado
   * **ponderado por cuántas aulas pone cada una ese día**, que es lo que de
   * verdad va a salir. Un día con seis aulas de una facultad que rinde 30 y una
   * de otra que rinde 12 no espera 21.
   *
   * Sin esto la franja teñida del diario quedaba en blanco en la vista general.
   */
  const esperadoDelEstudio = elegida ? [] : porVenir.map((fecha) => {
    let esperadas = 0;
    let aulas = 0;
    for (const f of proyeccion) {
      for (const d of f.dias) {
        if (d.fecha !== fecha) continue;
        esperadas += d.esperadas;
        aulas += d.aulas;
      }
    }
    return aulas ? esperadas / aulas : null;
  });
  const extremos = elegida || facultades.length < 4
    ? []
    : [facultades[0], facultades[facultades.length - 1]];

  // El acumulado: encuestas sumadas día a día contra la meta. Es la pregunta que
  // manda —«si llegamos a la meta»— y por eso va arriba y con su propio eje: la
  // escala de un acumulado no cabe en la de un rendimiento por aula.
  /**
   * El color de cada sexo, el MISMO par que usa Cálculo de muestra.
   *
   * Allí los tokens viven bajo `.cmv2-frame` y aquí no existen, así que se
   * redeclaran apuntando a las mismas variables base —no a un hex copiado—: si
   * la casa cambia el azul o el rosa, los dos módulos cambian juntos. Y la
   * clasificación de la etiqueta se importa de `sexoPalette` en vez de repetir
   * aquí la lista de sinónimos, que es donde se descuadran dos módulos.
   */
  const colorDeSexo = (etiqueta: string) => {
    const clase = sexSeriesKind(etiqueta);
    if (clase === "male") return "var(--aulas-sexo-hombre)";
    if (clase === "female") return "var(--aulas-sexo-mujer)";
    return "var(--pulso-border-strong)";
  };

  /**
   * Las cuotas que aplican a la vista: las de la facultad, o las del estudio.
   *
   * **Y hay que DECIR cuál de las dos**, porque son universos distintos y
   * conviven en la misma leyenda. Medido en pantalla el 2026-08-29 con la vista
   * «Todas las facultades»: el chip verde decía «Meta de lo visitado 67» —el eje
   * acaba en 200 y la serie llega a 54— mientras los de sexo decían «Hombres
   * 348/1.730» y «Mujeres 319/1.761». Esos dos suman 3.491, que es la suma de
   * las quince cuotas por facultad del estudio entero. Nada avisaba del cambio
   * de denominador dentro de la misma línea.
   *
   * Aquí no hay nada que arreglar en la cifra: la agregación es correcta y en
   * esa vista es la única cuota que existe. Lo que se arregla es el rótulo.
   */
  const cuotasSonDelEstudio = !(elegida && proyectada);
  const cuotasVisibles = elegida && proyectada
    ? proyectada.cuotas.map((c) => ({ sexo: c.sexo, meta: c.meta, observadas: c.observadas }))
    : (() => {
        const porSexo = new Map<string, { meta: number; observadas: number }>();
        for (const fila of cuotas) {
          const sexo = String(fila.sex ?? "").trim() || "Sin dato";
          const acc = porSexo.get(sexo) ?? { meta: 0, observadas: 0 };
          acc.meta += Number(fila.target ?? 0);
          acc.observadas += Number(fila.observed ?? 0);
          porSexo.set(sexo, acc);
        }
        return [...porSexo].map(([sexo, v]) => ({ sexo, ...v }));
      })();

  const acumulado = ((): null | {
    tope: number; escalones: number[]; meta: number;
    /** La meta del estudio (o de la facultad en foco): la suma de sus cuotas. */
    muestra: number;
    /** `false` cuando el estudio no declara cuotas y la vara es la meta del plan. */
    muestraEsDelDiseno: boolean;
    y: (v: number) => number; observado: string;
    puntos: Array<{ x: number; y: number; inferido: boolean; lineas: TrozoDePista[] }>;
    cubiertasPorSexo: number | null;
    conseguidasEnTotal: number;
    cruce: { x: number; y: number; fecha: string; inferido: boolean } | null;
    inferido: string; lectura: string;
    series: Array<{
      sexo: string; color: string; meta: number; conseguidas: number; faltan: number;
      alcanza: boolean; obs: string; inf: string;
      cruce?: { x: number; y: number; fecha: string } | null;
    }>;
    repartoObservado: boolean;
    metasSeñaladas: Array<{ sexo: string; color: string; meta: number; observadas: number }>;
    /** Las cuotas que NO caben en el eje: se declaran en vez de dibujarse. */
    metasFueraDeEscala: Array<{ sexo: string; color: string; meta: number; observadas: number }>;
    /** `true` cuando las cuotas son las del estudio entero y no las de una facultad. */
    cuotasSonDelEstudio: boolean;
    hayObservadasPorSexo: boolean;
    etiqueta: string;
  } => {
    const observadas = elegida
      ? elegida.dias.map((d) => d.efectivasAcumuladas)
      : aplicadas.map((_, i) => facultades.reduce((n, f) => n + (f.dias[i]?.efectivasAcumuladas ?? 0), 0));
    if (!observadas.length) return null;
    const ultimo = observadas[observadas.length - 1];
    // **La meta con la que se puede comparar el parte es la del PLAN**, no la
    // cuota por sexo: las dos primeras salen de plan+parte y la tercera de
    // respuestas atribuidas. Compararlas fue lo que hizo que el gráfico dijera
    // «llegamos» junto a un «0 de 196», y por eso el acumulado se estaba
    // ocultando entero. Ocultarlo no era la reparación: era quitar el gráfico que
    // Gonzalo había pedido. La reparación es medir contra lo comparable.
    const meta = elegida
      ? elegida.esperadoDeLoVisitado
      : facultades.reduce((n, f) => n + f.esperadoDeLoVisitado, 0);
    // **La proyección del ESTUDIO cuando no hay facultad elegida.** Sin esto la
    // franja teñida de lo agendado ocupaba un tercio del gráfico y estaba
    // completamente en blanco: prometía que ahí hay algo y no dibujaba nada, que
    // es peor que no teñirla. Y es justo la lectura que Gonzalo pide —«imagina
    // que ya vamos 10 días de aplicación y ya tenemos agendadas dos semanas [...]
    // eso es lo rico de este gráfico»—: lo interesante no es la franja, es ver la
    // previsión corriendo sobre ella con diez días de evidencia detrás.
    //
    // Se suma por FECHA y no por posición: cada facultad tiene su propio
    // calendario y el día 3 de una no es el día 3 de otra. Y se acumula sobre el
    // total ya conseguido, que es contra lo que se mide la meta.
    const proyectadas = proyectada
      ? proyectada.dias.map((d) => ultimo + d.acumuladas)
      : (() => {
        const porFecha = new Map<string, number>();
        for (const f of proyeccion) {
          for (const d of f.dias) {
            porFecha.set(d.fecha, (porFecha.get(d.fecha) ?? 0) + d.esperadas);
          }
        }
        let suma = ultimo;
        return porVenir.map((fecha) => (suma += porFecha.get(fecha) ?? 0));
      })();
    // **La sobremuestra es del ESTUDIO, no de la facultad que se esté mirando.**
    //
    // Con una facultad en foco la meta del gráfico pasa a ser la suya —93 en
    // Educación— mientras la sobremuestra sigue valiendo 3.750, el aforo
    // comprado para el estudio entero. Meterla en el techo escalaba el eje a
    // 4.000 con todos los datos por debajo de 120: las líneas quedaban
    // aplastadas contra el suelo e ilegibles. Se vio en pantalla el mismo día
    // que se conectó la sobremuestra a este gráfico.
    //
    // No se reparte por facultad aquí, aunque el libro sí lo haga con el ratio
    // del diseño: allí la referencia es la CUOTA de cada facultad, y la de este
    // gráfico es «lo que el plan espera de los cursos-horario visitados», que
    // es otro denominador. Aplicarle el mismo ratio mezclaría dos cosas.
    const sobremuestraDelEstudio = foco ? null : sobremuestra;
    // **El techo ignora lo que no es un número finito.** Un solo `NaN` en este
    // `Math.max` contamina el tope, `escalaDeEje(NaN)` vuelve NaN TODAS las Y y
    // el lienzo entero queda en blanco bajo una leyenda con cifras. Pasó de
    // verdad (A17, 2026-08-31): `meta_operativa` llegó del JSON de R como el
    // STRING "NA", atravesó el `?? null` de la pestaña y vació el acumulado del
    // estudio. La frontera ya normaliza; este filtro es la garantía de que
    // ningún campo sucio futuro pueda repetirlo.
    // **La MUESTRA: la meta del estudio, que hasta ahora no se dibujaba.**
    //
    // Gonzalo, 2026-09-08, mirando este gráfico: «¿cómo que la meta es 301? Si
    // la meta es 2500. Debería estar clarísimo dónde están las tres metas.»
    // Tenía razón y el defecto era literal: en el lienzo había cuatro líneas
    // —301, 3 750, 1 239 y 1 261— y ninguna era la muestra. La única rotulada
    // «Meta» era la de lo visitado, que además se MUEVE: crece según se pisan
    // aulas. Es la misma patología que las 3 158 que salieron esa mañana del
    // bloque de Avance: una cifra intermedia ocupando el sitio de la meta.
    //
    // Las tres que manda enseñar son la muestra y su reparto por sexo.
    const cuotaDeclarada = cuotasVisibles.reduce((n, c) => n + (Number.isFinite(c.meta) ? c.meta : 0), 0);
    // **Sin cuotas del diseño no hay muestra, y entonces la vara es la del
    // plan.** Es la misma degradación que el bloque de metas del libro: se usa
    // lo único que hay y se NOMBRA, en vez de quedarse sin ninguna referencia.
    // La mayoría de los estudios no declara cuotas por sexo; dejarlos sin línea
    // habría cambiado un rótulo equivocado por un gráfico mudo.
    const muestraDelCorte = cuotaDeclarada > 0
      ? cuotaDeclarada
      : (Number.isFinite(meta) && meta > 0 ? meta : 0);
    const muestraEsDelDiseno = cuotaDeclarada > 0;
    // **El techo incluye las tres metas y la sobremuestra**: si una no cabe, no
    // se ve, y «estar clarísimo dónde están» exige que quepan. Antes el techo
    // salía sólo de lo conseguido y lo proyectado, y por eso las cuotas por sexo
    // caían fuera de escala en cuanto el campo iba por debajo de ellas — que es
    // todo el principio del operativo.
    const metasDeSexoParaElTecho = cuotasVisibles.map((c) => c.meta);
    const techo = Math.max(
      ...[
        ultimo, muestraDelCorte, sobremuestraDelEstudio ?? 0, ...metasDeSexoParaElTecho,
        ...proyectadas, 1,
      ].filter((v) => Number.isFinite(v)),
    );
    const { tope, escalones } = escalaDeEje(techo);
    const yy = (v: number) => MARGEN + UTIL - (UTIL * v) / tope;
    const observado = observadas.map((v, i) => `${xa(i)},${yy(v)}`).join(" ");
    const inferido = proyectadas.length
      ? [`${x(corteX)},${yy(ultimo)}`, ...proyectadas.map((v, i) => `${xp(i)},${yy(v)}`)].join(" ")
      : "";
    const alCerrar = proyectadas.length ? proyectadas[proyectadas.length - 1] : ultimo;
    // **La segunda llegada: la del diseño.** La de arriba corre con la tasa que
    // el campo lleva y responde «¿a dónde llego si sigo rindiendo como rindo?».
    // Ésta responde la otra mitad —«¿a dónde habría llegado si rindiera lo que
    // el diseño supuso?»— que es el contraste que manda el ADR 0082.
    //
    // No es otra tasa: es la suma del `expected_valid` de las aulas AGENDADAS,
    // cada una con su tamaño. Una agenda de tres aulas grandes no es la misma
    // que una de tres pequeñas, y una tasa por un número de aulas no distingue
    // las dos.
    //
    // **CUÁL de las dos varas del diseño es ésta.** `expected_valid` hereda
    // `efectivas_esperadas`, que el motor compone como `elegibles × tasa DEL
    // AULA` (`calc_muestra_aulas_efectividad.R`): ajusta por el tamaño de cada
    // aula. El panel de seguimiento de arriba contrasta contra la otra vara, la
    // **tasa de la facultad**, que es la que dividió la cuota. Las dos suman lo
    // mismo por facultad y difieren aula por aula, así que esta línea y aquel
    // porcentaje NO son la misma referencia y no deben leerse como si lo
    // fueran. Al cambiar de vara aquí hay que cambiar el rótulo: el defecto
    // caro de este repo es un rótulo que promete otro número.
    const disenoDeLaAgenda = proyectada
      ? { total: proyectada.esperadasPorDisenoTotal, conVara: proyectada.aulasConDiseno, agendadas: proyectada.aulasAgendadas }
      : proyeccion.reduce<{ total: number | null; conVara: number; agendadas: number }>((acc, f) => ({
        total: f.esperadasPorDisenoTotal == null ? acc.total : (acc.total ?? 0) + f.esperadasPorDisenoTotal,
        conVara: acc.conVara + f.aulasConDiseno,
        agendadas: acc.agendadas + f.aulasAgendadas,
      }), { total: null, conVara: 0, agendadas: 0 });
    const alCerrarPorDiseno = disenoDeLaAgenda.total == null ? null : ultimo + disenoDeLaAgenda.total;

    // Una línea por sexo, con su cuota señalizada. El desglose por DÍA no existe
    // en el dato —el parte no trae sexo—, así que la serie de cada sexo es el
    // acumulado repartido con la proporción YA OBSERVADA de esa facultad. Se
    // declara en el pie: es un supuesto, no una medición día a día.
    // **La cuota se mide sobre las respuestas atribuidas a un curso-horario, no
    // sobre las encuestas del parte.** Son dos fuentes distintas y sobre este
    // corte dan 0 y 232: mezclarlas ponía un ✓ en la leyenda mientras la tabla de
    // abajo decía «no llega · faltarían 88». Es la misma trampa que este perfil
    // lleva toda la noche corrigiendo, y la metí yo.
    //
    // Así que las líneas de sexo salen de la MISMA fuente que la tabla —las
    // cuotas del motor— y la del total, de los partes, en gris y dicha aparte.
    const baseSexo = cuotasVisibles.reduce((n, c) => n + c.observadas, 0);
    const metaSexo = cuotasVisibles.reduce((n, c) => n + c.meta, 0);
    // **Sin ninguna respuesta atribuida no hay serie por sexo que dibujar.** Con
    // `observadas` en cero las dos líneas salían planas pegadas al eje y parecían
    // rotas —«no entiendo por qué la línea azul se queda inmóvil hasta el
    // final»—. Una línea plana en cero no es una serie: es una ausencia dibujada
    // como si fuera un dato. Se dice con palabras y se dibujan sólo las cuotas.
    // **El reparto por sexo sale del libro, no de la cuota.** El libro lo declara
    // aula por aula y viaja con el parte; la cuota se mide sobre respuestas
    // atribuidas, que es otra fuente. Con el libro, la serie por sexo se puede
    // dibujar junto al total sin cruzar nada —y Gonzalo avisó de que los datos van
    // a llegar con el sexo en todos los efectivos, así que ésta es la vía—.
    // En la vista general se suman TODAS las facultades, igual que la línea del
    // total. Antes devolvía `[]` sin facultad elegida, así que el desglose por
    // sexo —que es lo que Gonzalo pidió que no faltara nunca— sencillamente no
    // existía en la vista que se abre por defecto.
    const acumSexo = (campo: "mujeres" | "hombres") => {
      let acc = 0;
      let visto = false;
      return aplicadas.map((_, i) => {
        const v = elegida
          ? elegida.dias[i]?.[campo] ?? null
          : facultades.reduce<number | null>((n, f) => {
            const w = f.dias[i]?.[campo];
            return w == null ? n : (n ?? 0) + w;
          }, null);
        if (v != null) { acc += v; visto = true; }
        return visto ? acc : null;
      });
    };
    const acumM = acumSexo("mujeres");
    const acumH = acumSexo("hombres");
    /** Encuestas con sexo conocido, día a día: la suma de los dos repartos. */
    const conSexo = acumM.map((m, i) => (m == null ? null : m + (acumH[i] ?? 0)));
    const cubiertas = [...conSexo].reverse().find((v) => v != null) ?? 0;
    const hayLibroPorSexo = acumM.some((v) => v != null);
    const hayObservadasPorSexo = cuotasVisibles.some((c) => c.observadas > 0);
    // Con el libro se dibuja la serie de verdad; sin él, sólo las cuotas.
    // **Cada sexo también se proyecta sobre lo agendado.** Sólo lo hacía el total
    // (`inf: ""`), así que las dos líneas de sexo se cortaban en seco el día del
    // último parte y el gráfico no podía contestar la pregunta con la que empezó
    // todo esto: «tengo que ver si voy a llegar a la cuota y a la meta de hombres
    // y mujeres [...] **¿y cuándo llegaría?**».
    //
    // Se reparte lo que se prevé conseguir con la **proporción ya observada** de
    // cada sexo, que es el mismo supuesto que el pie declara para el reparto. No
    // se inventa nada nuevo: si el libro dice que 6 de cada 10 son mujeres, la
    // agenda se reparte igual mientras no haya dato que diga otra cosa.
    const conocidoPorSexo = (acumM[acumM.length - 1] ?? 0) + (acumH[acumH.length - 1] ?? 0);
    const seriesDelLibro = hayLibroPorSexo
      ? ([["Mujeres", acumM, "Mujer"], ["Hombres", acumH, "Hombre"]] as const).map(([etiqueta, serie, clave]) => {
          const meta = cuotasVisibles.find((c) => sexSeriesLabel(c.sexo) === sexSeriesLabel(clave))?.meta ?? 0;
          const ultimoV = [...serie].reverse().find((v) => v != null) ?? 0;
          const peso = conocidoPorSexo > 0 ? ultimoV / conocidoPorSexo : 0;
          const proyeccionDelSexo = proyectadas.map((v) => ultimoV + (v - ultimo) * peso);
          const iCruce = meta > 0 && ultimoV < meta
            ? proyeccionDelSexo.findIndex((v) => v >= meta)
            : -1;
          return {
            sexo: etiqueta,
            color: colorDeSexo(clave),
            meta,
            conseguidas: ultimoV,
            faltan: Math.max(0, meta - ultimoV),
            alcanza: meta > 0 && ultimoV >= meta,
            obs: serie.map((v, i) => (v == null ? null : `${xa(i)},${yy(v)}`)).filter(Boolean).join(" "),
            inf: proyeccionDelSexo.length
              ? [`${x(corteX)},${yy(ultimoV)}`,
                 ...proyeccionDelSexo.map((v, i) => `${xp(i)},${yy(v)}`)].join(" ")
              : "",
            // Dónde cruza SU cuota, que es lo que la tabla ya dice en palabras
            // («llega el DD/MM») y el gráfico callaba.
            cruce: iCruce >= 0
              ? { x: xp(iCruce), y: yy(proyeccionDelSexo[iCruce]), fecha: porVenir[iCruce] }
              : null,
          };
        })
      : [];
    const series = seriesDelLibro.length ? seriesDelLibro : (hayObservadasPorSexo ? cuotasVisibles : [])
      .filter((c) => c.meta > 0 || c.observadas > 0)
      .map((c) => {
        const peso = baseSexo > 0 ? c.observadas / baseSexo : metaSexo > 0 ? c.meta / metaSexo : 0;
        // El nivel de hoy es el que declara la cuota; la forma de la curva se
        // toma del acumulado diario, que es lo único que hay con fecha.
        const escala = ultimo > 0 ? c.observadas / ultimo : 0;
        const obs = observadas.map((v, i) => `${xa(i)},${yy(v * escala)}`).join(" ");
        const inf = proyectadas.length
          ? [`${x(corteX)},${yy(c.observadas)}`,
             ...proyectadas.map((v, i) => `${xp(i)},${yy(c.observadas + (v - ultimo) * peso)}`)].join(" ")
          : "";
        const alCerrarSexo = c.observadas + (alCerrar - ultimo) * peso;
        return {
          sexo: sexSeriesLabel(c.sexo),
          color: colorDeSexo(c.sexo),
          meta: c.meta,
          conseguidas: c.observadas,
          faltan: Math.max(0, c.meta - c.observadas),
          alcanza: alCerrarSexo >= c.meta,
          obs,
          inf,
        };
      });
    const repartoObservado = baseSexo > 0;
    // Ya no se oculta: el acumulado compara parte contra meta del plan, que son
    // la misma familia de cifras. Lo que aparece **sólo con atribución** son las
    // dos líneas de sexo y sus cuotas, que sí necesitan la otra fuente.
    // Nunca un agregado sin su desglose: «faltan 232» no dice a quién hay que ir
    // a buscar. Se acompaña siempre del reparto por sexo.
    const desglose = (total: number) => cuotasVisibles.length
      ? ` (${cuotasVisibles
          .filter((c) => c.meta > 0 || c.observadas > 0)
          .map((c) => {
            const b = cuotasVisibles.reduce((n, q) => n + q.observadas, 0);
            const m = cuotasVisibles.reduce((n, q) => n + q.meta, 0);
            const peso = b > 0 ? c.observadas / b : m > 0 ? c.meta / m : 0;
            return `${fmt(Math.round(total * peso))} ${sexSeriesLabel(c.sexo).toLowerCase()}`;
          })
          .join(" · ")})`
      : "";
    // La cifra que manda es la de la CUOTA, no la del parte: es la que decide si
    // el estudio llega. La del parte se dice aparte y con su nombre.
    // **Las dos llegadas, dichas juntas.** Sin la del diseño al lado, «se
    // llegaría a X» es un número sin vara: no se sabe si ese X es lo que se
    // había planeado o la mitad. Sólo se dice cuando difiere de verdad —menos
    // de una encuesta de diferencia no es información— y declarando sobre
    // cuántas aulas se calculó, porque no todas traen meta del diseño.
    // Desanidado a propósito: un template literal dentro de la expresión de
    // otro esconde sus cifras del contrato de formato del perfil, que las busca
    // en el fuente. El contrato tenía razón y la reparación es no anidar.
    const coberturaDelDiseno = disenoDeLaAgenda.conVara < disenoDeLaAgenda.agendadas
      ? ` (de ${fmt(disenoDeLaAgenda.conVara)} de las ${fmt(disenoDeLaAgenda.agendadas)} agendadas)`
      : "";
    const segundaLlegada = alCerrarPorDiseno != null && Math.abs(alCerrarPorDiseno - alCerrar) >= 1
      ? ` · con lo que el diseño pedía de esos cursos-horario, ${fmt(Math.floor(alCerrarPorDiseno))}${coberturaDelDiseno}`
      : "";
    // **Por qué la proyección no llega**, que es la pregunta que deja abierta.
    //
    // Gonzalo, 2026-09-08: «si estamos en principio yendo mejor de lo esperado,
    // ¿por qué sale que no vamos a llegar a la meta?». No es una contradicción y
    // el gráfico no lo decía: la proyección sólo cuenta los cursos-horario que
    // YA tienen fecha, así que se queda corta cuando quedan aulas del plan sin
    // citar, por bien que esté rindiendo el campo. La brecha es de AGENDA, no de
    // rendimiento, y son dos remedios distintos: uno se arregla agendando y el
    // otro mandando más gente a la misma aula.
    //
    // Medido sobre HSVG2026 el 2026-09-08: 174 titulares, 115 agendados, 59 sin
    // fecha. Lo agendado promete 2 066 y el plan entero 3 158, contra una
    // muestra de 2 500.
    const sinAgendar = elegida
      ? 0
      : plan.filter((u) => {
        const rol = String((u as Record<string, unknown>).sample_role ?? "").trim();
        if (rol && rol !== "titular") return false;
        const f = String((u as Record<string, unknown>).scheduled_date
          ?? (u as Record<string, unknown>).fecha ?? "").trim();
        return !f;
      }).length;
    const porAgendar = sinAgendar > 0 && alCerrar < muestraDelCorte
      ? ` · la proyección sólo cuenta lo agendado, y quedan ${fmt(sinAgendar)} cursos-horario del plan sin fecha`
      : "";

    const lectura = meta > 0
      ? `${fmt(Math.round(ultimo))} de ${fmt(meta)} encuestas que el plan espera de los cursos-horario visitados · ${
          alCerrar >= meta
            // **La cifra se dice también cuando se pasa.** Decir sólo «se pasa
            // de esa meta» dejaba la segunda llegada —la del diseño— sin nada
            // con que compararse: la pantalla mostraba «se pasa de esa meta ·
            // con lo que el diseño pedía, 3 795» y ese 3 795 no significaba
            // nada solo. Las dos llegadas se leen en pareja o no se leen.
            ? `con lo agendado se llegaría a ${fmt(Math.floor(alCerrar))}, por encima de esa meta`
            : `con lo agendado se llegaría a ${fmt(Math.floor(alCerrar))}, ${fmt(Math.ceil(meta - alCerrar))} por debajo`
        }${segundaLlegada}${porAgendar}`
      : `${fmt(Math.round(ultimo))} encuestas del parte · el plan no declara meta para esos cursos-horario`;
    // Las cuotas se siguen señalizando aunque no haya serie: son el objetivo, y
    // no depende de que alguien haya respondido.
    // **Una meta por encima del tope del eje NO se dibuja: se declara.**
    //
    // Medido el 2026-08-29 en el DOM: estas dos líneas salían a `y = -1384 px` y
    // `-1332 px`, o sea 2.628 px por encima del gráfico, cruzando la tabla del
    // panel de arriba y tachando su párrafo. `techo` sale de
    // `max(ultimo, meta, sobremuestra, ...proyectadas)` y NO incluye las cuotas
    // por sexo: con un tope de unos 400 y cuotas de 1.730 y 1.761, la `y` de
    // `MARGEN + UTIL - UTIL*v/tope` se va muy negativa.
    //
    // Meterlas en la escala tampoco vale: aplastaría la serie observada —348
    // sobre 1.761— contra el suelo y el gráfico dejaría de leerse, que es
    // exactamente lo que este panel existe para hacer. Se dibuja lo que cabe y
    // **se dice** lo que no, con su cifra: descartar en silencio sería cambiar
    // un estropicio visible por una ausencia muda.
    const metasDeSexo = cuotasVisibles
      .filter((c) => c.meta > 0)
      .map((c) => ({ sexo: sexSeriesLabel(c.sexo), color: colorDeSexo(c.sexo), meta: c.meta, observadas: c.observadas }));
    const { caben: metasSeñaladas, fuera: metasFueraDeEscala } = repartirMetasPorEscala(metasDeSexo, tope);
    return {
      tope, escalones, meta, muestra: muestraDelCorte, muestraEsDelDiseno,
      y: yy, observado, inferido, lectura, series, repartoObservado,
      metasFueraDeEscala, cuotasSonDelEstudio,
      // Cuántas de las conseguidas llevan sexo declarado en el libro. Si es menos
      // que el total, las dos líneas de sexo NO suman la verde y hay que decirlo.
      cubiertasPorSexo: hayLibroPorSexo ? cubiertas : null,
      conseguidasEnTotal: Math.round(ultimo),
      // **El cruce es con LA MUESTRA, que es la línea que se dibuja.**
      //
      // Gonzalo, 2026-09-08, señalando la marca: «¿por qué llegaría el 9 de
      // septiembre?». Con razón: la marca cruzaba las 301 de lo visitado, que
      // desde este mismo cambio ya no se pinta, así que anunciaba una llegada a
      // una línea invisible mientras la curva iba por 494 de 2 500. Una marca
      // sobre una referencia que el gráfico no enseña es peor que ninguna: se
      // lee contra la única línea que sí está.
      //
      // Si con lo agendado no se llega a la muestra, no hay marca. El pie ya
      // dice a cuánto se llegaría, que es la información sin la promesa.
      cruce: (() => {
        const listón = muestraDelCorte;
        if (!(listón > 0)) return null;
        // Primero en lo YA conseguido: si la meta se pasó, no hay nada que
        // pronosticar y la marca dice cuándo se pasó.
        const iObs = observadas.findIndex((v) => v >= listón);
        if (iObs >= 0) {
          return { x: xa(iObs), y: yy(observadas[iObs]), fecha: aplicadas[iObs], inferido: false };
        }
        const iInf = proyectadas.findIndex((v) => v >= listón);
        if (iInf < 0) return null;
        return { x: xp(iInf), y: yy(proyectadas[iInf]), fecha: porVenir[iInf], inferido: true };
      })(),
      // Un punto por dia sobre la linea del total. Gonzalo: «el acumulado por dia
      // no tiene hover cuando el dia a dia si». Cada uno dice cuanto se lleva,
      // cuanto falta para la meta y —cuando el libro lo declara— el reparto.
      puntos: [
        ...observadas.map((v, i) => ({
          x: xa(i), y: yy(v), inferido: false,
          lineas: [
            dm(aplicadas[i]),
            `${fmt(Math.round(v))} / ${fmt(meta)}${v >= meta ? " ✓" : ` · faltan ${fmt(Math.ceil(meta - v))}`}`,
            // **El desglose por color, no por palabra.** Decía «1 366 mujeres ·
            // 995 hombres» y con el punto del color de la serie la cifra ya dice
            // de quién es: se van dos palabras y, con la cobertura a una línea
            // tenue, dos de las cinco líneas del globo.
            ...(acumM[i] != null
              ? [
                { cifras: [
                  { valor: fmt(acumM[i]!), color: colorDeSexo("Mujer"), de: "mujeres" },
                  { valor: fmt(acumH[i] ?? 0), color: colorDeSexo("Hombre"), de: "hombres" },
                ] },
                // La cobertura sólo cuando NO cubre todo: si cubre, decirlo es
                // ruido en un globo que se lee de un vistazo.
                ...((conSexo[i] ?? 0) < Math.round(v)
                  ? [{ tenue: `sexo en ${fmt(conSexo[i] ?? 0)} de ${fmt(Math.round(v))}` }]
                  : []),
              ]
              // «sin sexo declarado todavía» era correcto en su fuente y
              // ambiguo en pantalla: el punto habla del PARTE, y la leyenda de
              // al lado muestra las series de sexo de PLATAFORMA («del estudio»).
              // Visto en vivo con Educación en foco: el globo decía que no había
              // sexo mientras arriba se leía «Mujeres 32/20 ✓». Nombrar la
              // fuente deshace la contradicción, igual que en «efectivas del
              // parte».
              : [{ tenue: "el parte no declara sexo" }]),
          ] as TrozoDePista[],
        })),
        ...proyectadas.map((v, i) => ({
          x: xp(i), y: yy(v), inferido: true,
          lineas: [
            `${dm(porVenir[i])} · inferido`,
            `~${personasProyectadas(v)} / ${fmt(meta)}${v >= meta ? " ✓" : ` · faltarían ${fmt(Math.ceil(meta - v))}`}`,
          ] as TrozoDePista[],
        })),
      ],
      metasSeñaladas, hayObservadasPorSexo: hayObservadasPorSexo || hayLibroPorSexo,
      etiqueta: elegida
        ? `Acumulado de ${elegida.facultad}: ${fmt(Math.round(ultimo))} de ${meta}`
        : `Acumulado del estudio: ${fmt(Math.round(ultimo))} de ${meta}`,
    };
  })();

  /**
   * De qué lado se ancla un globo según dónde caiga en el eje.
   *
   * Centrado (`translate(-50%)`) es lo correcto en medio, pero en los extremos
   * **la mitad del globo se sale del lienzo y se recorta**: con el punto a 96 %
   * la pista del último día agendado salía cortada por el borde del panel. Cerca
   * de un borde se ancla por el lado que cabe.
   */
  const anclaje = (x: number) => (x > 78 ? " es-derecha" : x < 22 ? " es-izquierda" : "");

  /** Pinta un trozo del globo: texto, texto tenue, o cifras con su color. */
  const trozo = (t: TrozoDePista, k: number) => {
    if (typeof t === "string") return <span key={k}>{t}</span>;
    if ("tenue" in t) return <span key={k} className="es-tenue">{t.tenue}</span>;
    if ("titular" in t) {
      return (
        <span key={k} className="es-titular">
          <b>{t.titular}</b> {t.unidad}
        </span>
      );
    }
    return (
      <span key={k} className="es-cifras">
        {t.cifras.map((c) => (
          <b key={c.de} style={{ "--aulas-serie-color": c.color } as React.CSSProperties}>
            {c.valor}
          </b>
        ))}
      </span>
    );
  };

  /** Lo que dice la pista de un día ya aplicado: el techo y lo conseguido. */
  const lineasDelDia = (d: {
    fecha: string; aulas: number; elegibles: number; efectivas: number; porAula: number | null;
    esperadoPorAulaDelDiseno?: number | null; aulasConDiseno?: number;
  }) => [
    // **«Encuestas» no decia de que numero hablaba.** Gonzalo, sobre esta misma
    // tarjeta: «no entiendo si con "encuesta" te refieres a "efectivas", porque
    // eso tiene que estar bien claro». El numero SIEMPRE fue `d.efectivas`, y
    // el rotulo generico obligaba a adivinarlo.
    //
    // Se dice ademas DE QUE FUENTE son. En este perfil conviven dos cuentas que
    // no coinciden —lo que el aplicador anoto en el parte y lo que llego a la
    // plataforma, que es lo que mide el KPI «VÁLIDAS»— y el panel «El parte
    // contra la plataforma» existe precisamente para compararlas. Un numero sin
    // su fuente en un sitio donde hay dos es medio dato.
    //
    // El orden tambien cambia: primero la cifra que se viene a buscar, despues
    // con que se compara, y el contexto al final. Antes las cuatro lineas
    // pesaban igual y habia que leerlas enteras para encontrar el dato.
    { tenue: `${dm(d.fecha)} · observado` },
    { titular: fmt(d.efectivas), unidad: "efectivas del parte" },
    // Con UN curso-horario el por-aula es la misma cifra que el titular: visto
    // en vivo con Educación en foco, el globo decía «20 efectivas del parte»
    // y debajo «20 por curso-horario» — un eco, y justo en las facultades
    // chicas, que es donde más se usa el foco. La línea sólo aporta cuando
    // reparte entre varios.
    ...(d.aulas > 1 ? [`${personasPorAula(d.porAula)} por curso-horario`] : []),
    // La vara del diseño y, cuando el día mezcla, sobre cuántas aulas se toma.
    // Sin decir el denominador, un día con una sola aula del diseño y tres
    // visitadas enseñaría una vara que no es la de las tres.
    ...(d.esperadoPorAulaDelDiseno != null
      ? [`el diseño pedía ${personasPorAula(d.esperadoPorAulaDelDiseno)} por curso-horario`
         + (d.aulasConDiseno && d.aulasConDiseno < d.aulas
            ? ` (de ${fmt(d.aulasConDiseno)} de las ${fmt(d.aulas)}; el resto no trae meta del diseño)`
            : "")]
      : d.aulas ? ["ninguno de esos cursos-horario trae meta del diseño"] : []),
    {
      tenue: `${fmt(d.aulas)} ${d.aulas === 1 ? "curso-horario" : "cursos-horario"}`
        + (d.elegibles ? ` · ${fmt(d.elegibles)} elegibles` : ""),
    },
  ];

  /**
   * La vara del diseño de la facultad elegida, y **sobre cuántas de sus aulas se
   * conoce**.
   *
   * Las dos cifras van juntas a propósito. `expected_valid` llega también con
   * metas escritas a mano y con el propio techo cuando no había ninguna, así que
   * una vara dicha sin su cobertura puede ser la de una aula de veinte y leerse
   * como la de las veinte.
   */
  const varaDelDiseno = useMemo(() => {
    if (!elegida) return null;
    // Lo ESPERADO, no la meta: esta acumulación suma `expected_valid` del
    // diseño, que es lo que se supuso que dejaría cada aula. La meta es la
    // cuota, y vive en el acumulado por sexo.
    let esperado = 0;
    let conVara = 0;
    let todas = 0;
    for (const d of elegida.dias) {
      todas += d.aulas;
      if (d.esperadoPorAulaDelDiseno != null && d.aulasConDiseno > 0) {
        esperado += d.esperadoPorAulaDelDiseno * d.aulasConDiseno;
        conVara += d.aulasConDiseno;
      }
    }
    return { porAula: conVara ? esperado / conVara : null, conVara, todas };
  }, [elegida]);

  const indice = elegida ? facultades.indexOf(elegida) : -1;
  const mover = (paso: number) => {
    if (!facultades.length) return;
    const siguiente = indice < 0
      ? (paso > 0 ? 0 : facultades.length - 1)
      : (indice + paso + facultades.length) % facultades.length;
    setFoco(facultades[siguiente].facultad);
  };

  // **C1: los miembros son los dos BLOQUES, no este envoltorio.** `.aulas-serie`
  // es el cuerpo del panel y no declara nada: la sección de arriba ya declara el
  // grupo, y cada bloque marca su `capacity="owned"`, que es el patrón de los
  // otros siete paneles de esta sección —un miembro por panel, su contenedor de
  // datos, delta 0—.
  //
  // Antes llevaba `capacity="owned"` y `member` a la vez, y al añadirle encima un
  // grupo propio se volvía opaca: el gate la tomaba entera como miembro y la
  // emparejaba con la cabecera del panel, marcando 898 px de `capacity-drift`
  // entre un título de 36 px y un gráfico de 934.
  return (
    <div className="aulas-serie">
      <p className="aulas-cadenas-lectura">
        {elegida ? (
          <>
            <strong>{elegida.facultad}</strong> deja <strong>{personasPorAula(elegida.observadoFinal)}</strong>{" "}
            efectivas por curso-horario en {fmt(elegida.aulas)}{" "}
            {elegida.aulas === 1 ? "curso-horario" : "cursos-horario"} ·
            {/* **Las dos expectativas, juntas y en la misma unidad.**

                Estaban las dos en esta vista y nunca en la misma frase: lo que el
                diseño pidió vivía en la leyenda del gráfico, tres bandas más
                abajo, y lo que cabe esperar según el rendimiento, aquí. Son
                cantidades distintas y contestan preguntas distintas —«¿con qué se
                dimensionó?» y «¿qué va a dejar la próxima?»—, así que separarlas
                obligaba a recordar una cifra mientras se busca la otra.

                Va en medio, entre lo conseguido y lo esperado, porque ése es el
                orden en que se leen: lo que se pidió, lo que se logra, lo que se
                espera. Sin vara del diseño no se escribe nada: la leyenda ya
                declara ese caso y repetirlo aquí sería ruido. */}
            {varaDelDiseno?.porAula != null ? (
              <> el diseño pedía <strong>{personasPorAula(varaDelDiseno.porAula)}</strong> ·</>
            ) : null}
            {" "}se espera <strong>{personasPorAula(elegida.esperadoFinal)}</strong> de la siguiente
            {elegida.aulas < 5 ? " (con tan pocos cursos-horario, el esperado se apoya en la media del estudio)" : ""}
          </>
        ) : (
          <>
            <strong>{fmt(facultades.length)}</strong> facultades ·{" "}
            <strong>{personasPorAula(mediaDelEstudio)}</strong> efectivas por curso-horario de media del estudio ·
            de <strong>{personasPorAula(facultades[0].esperadoFinal)}</strong>{" "}
            ({facultades[0].facultad}) a{" "}
            <strong>{personasPorAula(facultades[facultades.length - 1].esperadoFinal)}</strong>{" "}
            ({facultades[facultades.length - 1].facultad}) esperadas
          </>
        )}
      </p>

      {/* **El selector se fue a la cabecera de la seccion.**
          Aqui se movia con el scroll y solo existia en esta pestaña, teniendo el
          perfil nueve listas de las mismas veinte facultades. Vive ahora en
          `AulasSelectorDeFacultad`, montado en `MonitoreoWorkbenchHead`. */}

      {/* Cuando la cuota no tiene con qué medirse, el acumulado NO se dibuja.
          Dejarlo pintaba la línea gris del parte —228— cruzando por encima de una
          cuota de 196 que se mide sobre otra cosa: visualmente decía «llegamos»
          mientras el texto decía «0 de 196». Es la misma contradicción de fuentes
          de antes, reaparecida en forma de dibujo, y un gráfico que se contradice
          con su propio pie es peor que no estar. */}
      {/* EL ACUMULADO, arriba y con más peso. Gonzalo: «lo que nos importa es si
          llegamos a la meta y cuánto estamos avanzando [...] sobre todo, cómo
          vamos a seguir, y a este ritmo, ¿cuándo llegamos?».
          El diario de abajo dice qué tal fue cada día; éste, si el estudio llega.
          Van juntos y no en dos paneles porque comparten eje X: el mismo día se
          lee arriba y abajo en la misma vertical. */}
      {acumulado ? (
        <div className="aulas-serie-bloque"
          data-qa-geometry-capacity="owned" data-qa-geometry-member>
          {/* El rotulo dice QUE mide el grafico. Sin el habia que deducirlo del
              pie, tres bandas mas abajo. */}
          <p className="aulas-serie-rotulo">
            {/* **«del parte», porque de ahí salen.** `efectivasAcumuladas` suma
                `effective_surveys` de los partes de campo
                (`ritmoPorFacultad.ts:84`), no las válidas de plataforma. Medido
                con `HSVG2026_sem15_como_2025.pulso`: este pie decía «2.817 de
                2.771» mientras la banda decía «2.668 válidas» —el campo declaró
                149 más de las que pasaron el filtro— y nada distinguía los dos
                ejes. El panel vecino, «Qué está rindiendo más», sí lo declara:
                «encuestas del parte, por aula visitada».
                Cuál de los dos ejes DEBE mandar es otra pregunta, y es de
                Gonzalo (ítem 17); esto sólo dice cuál se está mirando. */}
            <b>Acumulado por día <i>· encuestas del parte contra la meta</i></b>
            {/* Una sola línea de leyenda y sólo con lo que se está dibujando. Con
                las cuatro explicaciones fijas más el aviso más la sobremuestra, el
                hueco entre los dos gráficos era un párrafo de 10 px ilegible. */}
            <span className="aulas-serie-leyenda">
              {/* **«Meta» a secas nombraba dos cosas casi con el mismo número.**
                  En esta misma línea de leyenda conviven la meta del plan sobre
                  las aulas ya visitadas —2 693 en la fixture— y las dos cuotas
                  por sexo, que suman 2 710. Diecisiete de diferencia entre dos
                  cantidades que no tienen nada que ver: una es lo que el plan
                  pedía de las aulas que se han pisado y la otra, lo que el
                  estudio necesita en total. El pie lo decía bien —«de las aulas
                  visitadas»— pero el pie está tres bandas más abajo y lo que la
                  gente lee es el chip. */}
              {/* **La muestra abre la leyenda**, porque es la meta del estudio.
                  Aquí decía «Meta de lo visitado», que es lo que el plan
                  esperaba de las aulas ya pisadas: una cifra móvil que se leía
                  como la meta y que Gonzalo cazó el 2026-09-08 («¿cómo que la
                  meta es 301? Si la meta es 2500»). Bajó al pie, junto a la
                  frase que ya la explicaba. */}
              {acumulado.muestra > 0 ? (
                <em className="es-horizontal es-gris">
                  {acumulado.muestraEsDelDiseno ? "Muestra" : "Meta del plan"}{" "}
                  {fmt(acumulado.muestra)}
                  {acumulado.cuotasSonDelEstudio || !acumulado.muestraEsDelDiseno
                    ? "" : " de esta facultad"}
                </em>
              ) : null}
              {/* **Lo que falta es el SEXO, no el enlace al curso-horario.**

                  `hayObservadasPorSexo` sale de las celdas de cuota con
                  `observadas > 0`, y esas celdas se llenan con el sexo de cada
                  respuesta. Si están todas en cero es porque el sexo no llega
                  —la variable sin mapear, o sin decodificar—, y la atribución al
                  curso-horario puede estar funcionando perfectamente: va por el
                  enlace del recopilador, que es otro camino.

                  Decía «Sin respuestas atribuidas a un curso-horario», que manda
                  a revisar el enlace. `kpisDeAulas` documenta el mismo error ya
                  cometido y corregido en su tarjeta —«faltaba el sexo, no el
                  aula, y mandaba a revisar el enlace en vez del mapeo de la
                  variable»—, y esa corrección no había llegado hasta aquí. */}
              {acumulado.hayObservadasPorSexo ? null : (
                <em className="es-ausente">
                  Ninguna respuesta trae el sexo declarado, así que no hay serie por sexo:
                  se señalan sólo las dos cuotas
                </em>
              )}
                {/* La sobremuestra, dicha o declarada ausente. Callarla dejaría la
                  pantalla igual tanto si el estudio la tiene como si no. */}
              {/* Con una facultad en foco no se dice ni que la hay ni que falta: la
                  cifra existe pero es del estudio entero, y enseñarla al lado de la
                  meta de una facultad invita a compararlas. */}
              {foco ? null : sobremuestra && sobremuestra > acumulado.muestra ? (
                <em style={{ "--aulas-serie-color": COLOR_RESULTADO.revision } as React.CSSProperties}>
                  Sobremuestra {fmt(sobremuestra)}
                  {/* **Ni «referencia» ni «no obligatoria»** (Gonzalo, 2026-09-08):
                      muestra y sobremuestra son las dos metas del estudio y se
                      miden igual. Hay un test hermano en el libro que prohíbe
                      «referencial», «margen», «segunda meta» y «techo»; decirlo
                      aquí de otra forma era enseñar dos doctrinas del mismo
                      número en dos pantallas. Lo que sí se dice es contra qué se
                      mide, que es información y no juicio. */}
                  {" · la otra meta del estudio"}
                </em>
              ) : (
                <em className="es-ausente">Sobremuestra no declarada por el estudio</em>
              )}
              {acumulado.series.map((se) => (
                <em key={se.sexo} style={{ "--aulas-serie-color": se.color } as React.CSSProperties}>
                  {se.sexo} {fmt(Math.round(se.conseguidas))}/{fmt(se.meta)}
                  {acumulado.cuotasSonDelEstudio ? " del estudio" : ""}
                  {se.meta > 0 ? (se.alcanza ? " ✓" : ` · faltan ${fmt(Math.ceil(se.faltan))}`) : ""}
                </em>
              ))}
              {/* **Las dos cifras de sexo no suman la verde**, y sin esto el
                  gráfico deja creer que sí. El reparto sólo se conoce en las aulas
                  cuyo libro lo declara: en Estudios Generales Letras la verde vale
                  31 el primer día y las series de sexo arrancan dos días después,
                  no porque no hubiera aulas sino porque el libro calla su
                  reparto. */}
              {/* Lo que no cabe en el eje se DICE, con su cifra. Recortarlo y
                  callarlo dejaría la pantalla igual que si la cuota no
                  existiera. */}
              {/* Una sola vez, no una por sexo: el motivo es el mismo para las
                  dos y repetirlo llenaba la leyenda con dos frases largas que
                  decían lo mismo. */}
              {acumulado.metasFueraDeEscala.length ? (
                <em className="es-ausente">
                  {acumulado.cuotasSonDelEstudio
                    ? `las cuotas por sexo (${acumulado.metasFueraDeEscala.map((m) => fmt(m.meta)).join(" y ")}) son las del estudio entero: no se dibujan sobre un eje de cursos-horario visitados`
                    : `las cuotas por sexo (${acumulado.metasFueraDeEscala.map((m) => fmt(m.meta)).join(" y ")}) no caben en la escala de este gráfico`}
                </em>
              ) : null}
              {acumulado.cubiertasPorSexo != null
                && acumulado.cubiertasPorSexo < acumulado.conseguidasEnTotal ? (
                <em className="es-ausente">
                  sexo declarado en {fmt(acumulado.cubiertasPorSexo)} de{" "}
                  {fmt(acumulado.conseguidasEnTotal)} encuestas
                </em>
              ) : null}
              {/* **La OTRA razón por la que no suman, que no tenía nota.**
                  `cubiertasPorSexo` sólo es distinto de `null` cuando el reparto
                  viene del libro, así que la frase de arriba cubre esa rama. En
                  la otra —el respaldo— las series de sexo salen de las
                  respuestas atribuidas y la verde, de `effective_surveys` del
                  parte: dos ejes, no una cobertura incompleta. Medido con
                  `HSVG2026_sem15_como_2025.pulso`: 1.291 + 1.377 = 2.668 válidas
                  de plataforma contra 2.817 del parte, con el reparto COMPLETO.
                  Sin esta línea la diferencia no tiene explicación en pantalla. */}
              {acumulado.cubiertasPorSexo == null && acumulado.hayObservadasPorSexo ? (
                <em className="es-ausente">
                  las dos de sexo salen de las respuestas atribuidas y la verde,
                  del parte: por eso no suman
                </em>
              ) : null}
            </span>
          </p>
        <div className="aulas-serie-plot es-acumulado">
          <ul className="aulas-serie-y" aria-hidden="true">
            {acumulado.escalones.map((m) => <li key={m}><span>{fmt(m)}</span><i /></li>)}
          </ul>
          <div className="aulas-serie-lienzo">
            <svg className="aulas-serie-grafico es-acumulado" viewBox="0 0 100 100"
              preserveAspectRatio="none" role="img"
              aria-label={acumulado.etiqueta}>
              {/* **La garantía estructural: nada se pinta fuera de la caja.**
                  El SVG lleva `overflow: visible` en el CSS —para que un trazo
                  del borde no se corte a la mitad— y eso, con una `y` fuera de
                  escala, deja pintar SIN LÍMITE: medido, dos líneas a 2.628 px
                  por encima, cruzando el panel de arriba. Arreglada la escala,
                  esto es lo que impide que vuelva a pasar por otra vía. El
                  margen de 2 unidades conserva el grosor de los trazos del
                  borde, que es para lo que estaba el `overflow`. */}
              <defs>
                <clipPath id="aulas-serie-caja">
                  <rect x="-2" y="-2" width="104" height="104" />
                </clipPath>
              </defs>
              <g clipPath="url(#aulas-serie-caja)">
              {/* LA ZONA DE LO AGENDADO. Gonzalo: «el grafico sigue sin
                  diferenciar el pasado del futuro o lo previsto». Y era exacto: la
                  unica separacion era una vertical punteada del MISMO gris que la
                  rejilla —#e2e7f0, indistinguible de una linea de fondo— y una
                  fecha en ambar de 10 px. Lo que se lee de un vistazo es la
                  superficie, no la raya: todo lo que cae a la derecha del ultimo
                  parte va sobre fondo teñido, y ahi dentro nada es un hecho. */}
              {porVenir.length ? (
                <rect x={x(corteX)} y={MARGEN} width={Math.max(0, 100 - MARGEN - x(corteX))}
                  height={UTIL} fill={COLOR_RESULTADO.pendiente} opacity="0.07"
                  className="aulas-serie-franja" />
              ) : null}
              <defs>
                <linearGradient id="aulas-serie-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_RESULTADO.efectiva} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={COLOR_RESULTADO.efectiva} stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {acumulado.escalones.map((m) => (
                <line key={m} x1={MARGEN} y1={acumulado.y(m)} x2={100 - MARGEN} y2={acumulado.y(m)}
                  stroke="var(--pulso-border)" strokeWidth="1"
                  vectorEffect="non-scaling-stroke" opacity={m === 0 ? 1 : 0.55} />
              ))}
              {/* La SOBREMUESTRA, si el estudio la declara: por encima de la meta
                  y con trazo propio. No es una obligación —la meta manda— y por
                  eso va más tenue y punteada más fina. */}
              {sobremuestra && sobremuestra > acumulado.muestra ? (
                <line x1={MARGEN} y1={acumulado.y(sobremuestra)} x2={100 - MARGEN}
                  y2={acumulado.y(sobremuestra)}
                  stroke={COLOR_RESULTADO.revision} strokeWidth="1.25"
                  vectorEffect="non-scaling-stroke" opacity="0.75" />
              ) : null}
              {/* **LA MUESTRA: la línea que manda.** En neutro y con el trazo más
                  grueso del lienzo, porque es contra lo que se lee todo lo demás
                  y porque no es de ningún sexo — iba en el mismo rosa que la
                  cuota de mujeres y las dos quedaban indistinguibles diciendo
                  cosas distintas.

                  Sustituye a la línea de «lo visitado», que ocupaba este sitio
                  siendo una cifra móvil: crecía a medida que se pisaban aulas y
                  se leía como la meta del estudio sin serlo. Esa cifra sigue
                  viva en el pie, que es donde significa algo (¿estamos sacando
                  de cada aula lo que prometía?). */}
              {acumulado.muestra > 0 ? (
                <line x1={MARGEN} y1={acumulado.y(acumulado.muestra)} x2={100 - MARGEN}
                  y2={acumulado.y(acumulado.muestra)}
                  stroke="var(--pulso-text-soft)" strokeWidth="2"
                  vectorEffect="non-scaling-stroke" opacity="0.95" />
              ) : null}
              {porVenir.length ? (
                <line x1={x(corteX)} y1={MARGEN} x2={x(corteX)} y2={MARGEN + UTIL}
                  stroke={COLOR_RESULTADO.pendiente} strokeWidth="1.5" strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke" opacity="0.9" />
              ) : null}
              {/* La CUOTA de cada sexo, señalizada con su color. Sin esto no se
                  puede saber si una linea llega o no llega. */}
              {acumulado.metasSeñaladas.map((se) => (
                <line key={`meta-${se.sexo}`} x1={MARGEN} y1={acumulado.y(se.meta)}
                  x2={100 - MARGEN} y2={acumulado.y(se.meta)}
                  stroke={se.color} strokeWidth="1.2"
                  vectorEffect="non-scaling-stroke" opacity="0.7" />
              ))}
              {/* El area bajo el acumulado. Una linea sola sobre un fondo vacio se
                  lee como un trazo; con el area debajo se lee como un volumen que
                  crece, que es lo que un acumulado es. */}
              <polygon
                points={`${MARGEN},${MARGEN + UTIL} ${acumulado.observado} ${x(corteX)},${MARGEN + UTIL}`}
                fill="url(#aulas-serie-area)" />
              <polyline points={acumulado.observado} fill="none" stroke={COLOR_RESULTADO.efectiva}
                strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
              {acumulado.inferido ? (
                <polyline points={acumulado.inferido} fill="none" stroke={COLOR_RESULTADO.parcial}
                  strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke" />
              ) : null}
              {/* Y las dos que importan: hombres y mujeres, en el mismo gráfico y
                  con el par de colores de Cálculo de muestra. */}
              {acumulado.series.map((se) => (
                <polyline key={`obs-${se.sexo}`} points={se.obs} fill="none" stroke={se.color}
                  strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
                  vectorEffect="non-scaling-stroke" />
              ))}
              {acumulado.series.map((se) => (se.inf ? (
                <polyline key={`inf-${se.sexo}`} points={se.inf} fill="none" stroke={se.color}
                  strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke" opacity="0.85" />
              ) : null))}
              </g>
            </svg>
            {porVenir.length ? (
              <>
                <span className="aulas-serie-zona es-aplicado"
                  style={{ right: `${100 - x(corteX)}%` }}>aplicado</span>
                <span className="aulas-serie-zona es-agendado"
                  style={{ left: `${x(corteX)}%` }}>agendado</span>
              </>
            ) : null}
            {pista ? (
              <span className="aulas-serie-guia" style={{ left: `${pista.x}%` }} />
            ) : null}
            {/* **Las cotas del borde son LAS METAS**, y la primera decía «Meta 301»
                —lo que el plan esperaba de las aulas ya pisadas—, que es lo que
                Gonzalo cazó el 2026-09-08: la única cota rotulada «Meta» no era
                ninguna de las del estudio. Ahora son la muestra, su reparto por
                sexo y la sobremuestra, que es la otra meta y hasta hoy sólo
                tenía línea, sin cifra en el borde. */}
            {separaLasMetas([
              { clave: "muestra", valor: acumulado.muestra, color: "var(--pulso-text-soft)",
                que: acumulado.muestraEsDelDiseno ? "Muestra" : "Meta del plan" },
              ...acumulado.metasSeñaladas.map((se) => ({
                clave: se.sexo, valor: se.meta, color: se.color, que: sexSeriesLabel(se.sexo),
              })),
              ...(!foco && sobremuestra && sobremuestra > 0
                ? [{ clave: "sobremuestra", valor: sobremuestra, color: COLOR_RESULTADO.revision, que: "Sobremuestra" }]
                : []),
            ].filter((m) => m.valor > 0).map((m) => ({ ...m, y: acumulado.y(m.valor) }))).map((m) => (
              <span key={`meta-${m.clave}`} className="aulas-serie-meta"
                style={{
                  top: `${m.y}%`,
                  "--aulas-serie-color": m.color,
                } as React.CSSProperties}>
                {m.que} <b>{fmt(m.valor)}</b>
              </span>
            ))}
            {acumulado.cruce ? (
              <span
                className={`aulas-serie-cruce${acumulado.cruce.inferido ? " es-inferido" : ""}${anclaje(acumulado.cruce.x)}`}
                style={{ left: `${acumulado.cruce.x}%`, top: `${acumulado.cruce.y}%` }}
              >
                {acumulado.cruce.inferido ? "llegaría el " : "meta alcanzada el "}
                <b>{dm(acumulado.cruce.fecha)}</b>
              </span>
            ) : null}
            {/* **Dos cruces en la misma fecha son UN chip.** Medido: en 2 de cada
                12 facultades mujeres y hombres cruzan su cuota el mismo día, y sus
                dos etiquetas caían en la misma vertical, solapadas. Fundirlas no
                es sólo evitar el choque: «las dos cuotas el 28/08» es una frase, y
                dos chips pegados son dos cosas que el ojo tiene que juntar. */}
            {Object.entries(
              acumulado.series.reduce<Record<string, typeof acumulado.series>>((mapa, se) => {
                if (!se.cruce) return mapa;
                (mapa[se.cruce.fecha] ??= []).push(se);
                return mapa;
              }, {}),
            ).map(([fecha, juntas]) => {
              // Del par se toma el que cruza más arriba, que es donde el ojo
              // termina de seguir la línea.
              const ancla = juntas.reduce((a, b) => (a.cruce!.y <= b.cruce!.y ? a : b));
              return (
                <span key={`cruce-${fecha}`}
                  className={`aulas-serie-cruce es-sexo${anclaje(ancla.cruce!.x)}`}
                  style={{
                    left: `${ancla.cruce!.x}%`, top: `${ancla.cruce!.y}%`,
                    "--aulas-serie-color": juntas.length > 1 ? "var(--pulso-text-soft)" : ancla.color,
                  } as React.CSSProperties}>
                  {juntas.length > 1
                    ? "las dos cuotas"
                    : ancla.sexo} <b>{dm(fecha)}</b>
                </span>
              );
            })}
            {acumulado.puntos.map((pt, i) => (
              <span key={`acum-${i}`}
                className={`aulas-serie-punto${pt.inferido ? " es-inferido" : ""}`}
                tabIndex={0} role="img" aria-label={pistaEnPalabras(pt.lineas)}
                style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                onMouseEnter={() => setPista({ ...pt, bloque: "acumulado" })}
                onFocus={() => setPista({ ...pt, bloque: "acumulado" })}
                onMouseLeave={() => setPista(null)}
                onBlur={() => setPista(null)} />
            ))}
            {pista && pista.bloque === "acumulado" ? (
              <div className={`aulas-serie-pista${anclaje(pista.x)}`} role="status"
                style={{ left: `${pista.x}%`, top: `${pista.y}%` }}>
                {pista.lineas.map(trozo)}
              </div>
            ) : null}
          </div>
          {/* El MISMO eje de días que el «Día a día», DENTRO del plot y no del
              bloque: `.aulas-serie-dias` lleva `grid-column: 2`, que es la
              columna del lienzo en el grid del plot. Colgado del bloque creaba
              allí una segunda columna y partía el gráfico en dos —visto en
              pantalla el 2026-09-08—. Aquí queda bajo el lienzo y con su mismo
              ancho, que es lo que hace que las dos rejillas coincidan. */}
          {ejeDeDias}
        </div>
        <p className="aulas-serie-eje aulas-serie-lectura-acumulado">
          <span>{acumulado.lectura}</span>
        </p>
          <p className="mon-profile-muted aulas-serie-pie">
            {/* **Una gramática de trazo, y una sola** (Gonzalo, 2026-09-08: «el
                hecho de que todas las líneas sean punteadas es confuso, no queda
                claro cuáles son las metas y cuáles son las inferencias»).

                Tenía razón: el punteado significaba dos cosas a la vez. Las
                metas iban punteadas —muestra, sobremuestra y las dos cuotas por
                sexo— y las proyecciones también, así que el mismo trazo decía
                «este es el listón» y «esto todavía no ha pasado».

                Desde aquí el punteado significa UNA cosa: lo que aún no ocurrió.
                Las metas son líneas continuas y finas, que es como se lee un
                listón; lo conseguido, continuo y grueso; lo inferido, punteado.
                El color sigue diciendo de quién habla cada línea. */}
            Continuo es lo que hay: <strong>grueso</strong> lo conseguido y{" "}
            <strong>fino</strong>{acumulado.metasSeñaladas.length
              ? " las dos metas del estudio y las cuotas de cada sexo"
              : " la muestra"}. El <strong>punteado</strong> es lo que se infiere de
            los cursos-horario ya agendados: todavía no ha pasado.
            {/* El pie prometía «y las cuotas de cada sexo» SIEMPRE, y desde que
                esas cuotas dejan de dibujarse cuando son las del estudio entero,
                la frase mandaba a buscar dos líneas que no están. Se dice lo que
                hay: es el mismo defecto —un rótulo que promete otro contenido—
                que este panel viene arreglando, y lo introduje yo al dejar de
                pintarlas. */}
          </p>
        </div>
      ) : null}

      <div className="aulas-serie-bloque"
        data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="aulas-serie-rotulo">
          <b>Día a día <i>{jornadasEnElEje.length
            ? "· efectivas del día, con lo esperado de fondo"
            : "· encuestas por curso-horario, con los elegibles de fondo"}</i></b>
          {/* **Las tres alturas, nombradas.** El gráfico dibujaba techo, vara y
              línea sin decir cuál era cuál: había que deducirlo del pie, tres
              bandas más abajo, y el pie es prosa. Con la leyenda las tres se
              distinguen por su trazo —relleno, punteado, sólido— y no sólo por
              dónde caen. Sólo con una facultad elegida, que es cuando se dibujan. */}
          {elegida ? (
            <span className="aulas-serie-leyenda es-trazos">
              <em className="es-gris">Techo: los elegibles del día</em>
              {varaDelDiseno?.porAula != null ? (
                <em className="es-zona">
                  El diseño pedía {personasPorAula(varaDelDiseno.porAula)} por
                  curso-horario, ajustado por su tamaño
                  {varaDelDiseno.conVara < varaDelDiseno.todas
                    ? ` · en ${fmt(varaDelDiseno.conVara)} de ${fmt(varaDelDiseno.todas)} cursos-horario`
                    : ""}
                </em>
              ) : (
                <em className="es-ausente">
                  El plan no trae la meta del diseño de estos cursos-horario: no hay vara que dibujar
                </em>
              )}
              <em style={{ "--aulas-serie-color": COLOR_RESULTADO.efectiva } as React.CSSProperties}>
                Lo conseguido
              </em>
              {/* **El esperado también se nombra.** Estaba dibujado desde siempre
                  y sólo se explicaba en el pie, tres bandas más abajo; al entrar
                  la vara había dos grises punteados en el lienzo y un único
                  rótulo, así que el lector no podía saber cuál era cuál. */}
              <em className="es-punteado">
                Lo que cabe esperar de la siguiente ({personasPorAula(elegida.esperadoFinal)})
              </em>
            </span>
          ) : null}
        </p>
      <div className="aulas-serie-plot">
        <ul className="aulas-serie-y" aria-hidden="true">
          {escalones.map((m) => <li key={m}><span>{fmt(m)}</span><i /></li>)}
        </ul>
        <div className="aulas-serie-lienzo">
          <svg className="aulas-serie-grafico es-diario" viewBox="0 0 100 100" preserveAspectRatio="none"
            role="img"
            aria-label={elegida
              ? `Rendimiento diario de ${elegida.facultad}; esperado ${elegida.esperadoFinal} encuestas por curso-horario`
              : `Rendimiento diario de ${fmt(facultades.length)} facultades; media del estudio ${mediaDelEstudio}`}>
            {/* La misma garantía que en el acumulado, y por el mismo motivo:
                `overflow: visible` deja pintar sin tope, y aquí `esperadoDelEstudio`
                se calcula DESPUÉS del techo del eje —no se puede incluir sin
                reordenar— así que el recorte es lo que impide que un día
                proyectado alto se vaya sobre el panel de arriba.

                Con `id` PROPIO y no el del acumulado: los `id` de SVG son del
                documento entero, así que apuntar al del otro gráfico parece que
                funciona… hasta que el acumulado no se renderiza. Una referencia
                de `clip-path` que no resuelve no deja el elemento sin recortar:
                lo deja SIN DIBUJAR. */}
            <defs>
              <clipPath id="aulas-serie-caja-diario">
                <rect x="-2" y="-2" width="104" height="104" />
              </clipPath>
            </defs>
            <g clipPath="url(#aulas-serie-caja-diario)">
            {/* LA ZONA DE LO AGENDADO, debajo de todo. Ver el comentario del
                acumulado: la raya sola no separaba nada porque iba del color de
                la rejilla. */}
            {porVenir.length ? (
              <rect x={x(corteX)} y={MARGEN} width={Math.max(0, 100 - MARGEN - x(corteX))}
                height={UTIL} fill={COLOR_RESULTADO.pendiente} opacity="0.07"
                  className="aulas-serie-franja" />
            ) : null}
            {escalones.map((m) => (
              <line key={m} x1={MARGEN} y1={y(m)} x2={100 - MARGEN} y2={y(m)}
                stroke="var(--pulso-border)" strokeWidth="1"
                vectorEffect="non-scaling-stroke" opacity={m === 0 ? 1 : 0.55} />
            ))}
            {/* La media del estudio, siempre visible: es contra lo que se compara
                cualquier facultad, y es el prior del esperado. */}
            {/* La media del estudio es una cifra POR curso-horario (17,5). Con
                el gráfico en efectivas del día se dibujaba a y=92,8 sobre un eje
                de 500, o sea pegada al suelo, y ahí no dice nada: es la misma
                trampa de mezclar unidades que Gonzalo cazó con el «límite de 30».
                Vuelve en cuanto el gráfico mide por curso-horario. */}
            {jornadasEnElEje.length ? null : (
              <line x1={MARGEN} y1={y(mediaDelEstudio)} x2={100 - MARGEN} y2={y(mediaDelEstudio)}
                stroke={COLOR_RESULTADO.revision} strokeWidth="1.2"
                vectorEffect="non-scaling-stroke" opacity="0.7" />
            )}
            {/* La banda de dispersión, debajo de todo: entre el cuartil 1 y el 3
                de cada día está la mitad central de las facultades. */}
            {conBanda && !jornadasEnElEje.length ? (
              <polygon
                points={[
                  ...cuartiles.map((c, i) => (c ? `${xa(i)},${y(c.p75)}` : null)).filter(Boolean),
                  ...cuartiles.map((c, i) => (c ? `${xa(i)},${y(c.p25)}` : null)).filter(Boolean).reverse(),
                ].join(" ")}
                fill={COLOR_RESULTADO.efectiva} opacity="0.1" />
            ) : null}
            {/* **La línea verde es LO QUE SE TUVO ese día** (Gonzalo,
                2026-09-08). Con las jornadas del motor es una sola línea de
                totales, y las veinte series por facultad y su mediana se
                retiran: median encuestas POR curso-horario, que es otra unidad,
                y superpuestas a una barra de totales se leerían como si fueran
                la misma cifra. Sin jornadas se conserva lo de antes, que es lo
                único que hay. */}
            {jornadasEnElEje.length ? (
              <polyline
                points={jornadasEnElEje.map((j) => `${j.x},${y(j.conseguidas)}`).join(" ")}
                fill="none" stroke={COLOR_RESULTADO.efectiva} strokeWidth="3"
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
            ) : (
              <>
                {dibujadas.map((f) => (
                  <polyline key={f.facultad} points={trazo(f.dias)} fill="none"
                    stroke={COLOR_RESULTADO.efectiva}
                    strokeWidth={elegida ? 2.5 : 1}
                    opacity={elegida ? 1 : 0.16}
                    strokeLinejoin="round" strokeLinecap="round"
                    vectorEffect="non-scaling-stroke" />
                ))}
                {extremos.map((f, k) => (
                  <polyline key={`extremo-${f.facultad}`} points={trazo(f.dias)} fill="none"
                    stroke={k === 0 ? COLOR_RESULTADO.efectiva : COLOR_RESULTADO.rechazo}
                    strokeWidth="2" opacity="0.9"
                    strokeLinejoin="round" strokeLinecap="round"
                    vectorEffect="non-scaling-stroke" />
                ))}
                {conBanda ? (
                  <polyline
                    points={cuartiles.map((c, i) => (c ? `${xa(i)},${y(c.p50)}` : null)).filter(Boolean).join(" ")}
                    fill="none" stroke={COLOR_RESULTADO.efectiva} strokeWidth="3"
                    strokeLinejoin="round" strokeLinecap="round"
                    vectorEffect="non-scaling-stroke" />
                ) : null}
              </>
            )}
            {/* El esperado del ESTUDIO sobre lo agendado. Arranca en la mediana
                del último día con parte para que se vea de dónde sale. */}
            {/* La punteada del esperado del estudio también va por curso-horario
                y quedaba plana en el suelo. Gonzalo: «no entiendo la funcionalidad
                de la línea punteada aquí». No hacía falta traducirla de unidad:
                lo que se espera de los días agendados ya son las barras grises de
                la derecha, y una segunda lectura de lo mismo sólo compite. */}
            {conBanda && !jornadasEnElEje.length && esperadoDelEstudio.some((v) => v != null) ? (
              <polyline
                points={[
                  `${x(corteX)},${y(cuartiles[corte]?.p50 ?? mediaDelEstudio)}`,
                  ...esperadoDelEstudio.map((v, i) => (v == null ? null : `${xp(i)},${y(v)}`)).filter(Boolean),
                ].join(" ")}
                fill="none" stroke={COLOR_RESULTADO.parcial} strokeWidth="2.5"
                strokeDasharray="6 4" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke" />
            ) : null}
            {/* El esperado sólo con una facultad elegida: veinte líneas punteadas
                sobre veinte sólidas no se leen, y encima el esperado es lo que se
                mira DESPUÉS de decidir a quién mirar. */}
            {/* **La banda del esperado, DEBAJO de su línea.** El esperado es una
                media posterior y se dibujaba solo: con dos aulas visitadas y con
                treinta el punteado se ve igual, y no significa lo mismo. Es el
                mismo defecto que la probabilidad de cierre repara en las celdas.

                Va sin borde y muy translúcida: no es un dato más, es el ancho
                del que ya está dibujado. Se salta los días sin banda en vez de
                interpolarlos —una banda inventada es peor que ninguna—. */}
            {elegida ? (() => {
              const conBanda = elegida.dias
                .map((d, i) => ({ d, i }))
                .filter(({ d }) => d.esperadoBanda !== null);
              if (conBanda.length < 2) return null;
              const arriba = conBanda.map(({ d, i }) => `${xa(i)},${y(d.esperadoBanda!.alto)}`);
              const abajo = [...conBanda].reverse().map(({ d, i }) => `${xa(i)},${y(d.esperadoBanda!.bajo)}`);
              return (
                <polygon
                  points={[...arriba, ...abajo].join(" ")}
                  fill={COLOR_RESULTADO.pendiente}
                  // **0,13 la hacía invisible.** Verificado en captura sobre
                  // DERECHO: la banda se calculaba y se dibujaba, y encima de
                  // las barras grises del techo no se distinguía nada. Una
                  // banda que no se ve es lo mismo que no tenerla, y peor:
                  // hace creer que el esperado no la tiene.
                  fillOpacity="0.24"
                  stroke={COLOR_RESULTADO.pendiente}
                  strokeOpacity="0.45"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                >
                  <title>
                    Banda del 90 % del esperado. Hereda el mismo supuesto que la
                    probabilidad de cierre —las respuestas de un curso-horario
                    no son independientes del todo—, así que la banda real es algo más
                    ancha que ésta.
                  </title>
                </polygon>
              );
            })() : null}
            {elegida && !jornadasEnElEje.length ? (
              <polyline points={elegida.dias.map((d, i) => `${xa(i)},${y(d.esperado)}`).join(" ")}
                fill="none" stroke={COLOR_RESULTADO.pendiente} strokeWidth="2"
                strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
            ) : null}
            {/* La frontera: a la izquierda lo que pasó, a la derecha lo que se
                infiere de la agenda. El comentario ya decía «sin esta raya las dos
                mitades se leen igual» —y se leían igual igualmente, porque la raya
                iba en `--pulso-border`, el MISMO gris de la rejilla de fondo. */}
            {porVenir.length ? (
              <line x1={x(corteX)} y1={MARGEN} x2={x(corteX)} y2={MARGEN + UTIL}
                stroke={COLOR_RESULTADO.pendiente} strokeWidth="1.5" strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke" opacity="0.9" />
            ) : null}
            {/* Las BARRAS de elegibles: el techo de cada día, o sea toda la gente
                que podía —o podrá— responder en esas aulas. La línea va por
                debajo, y la distancia entre las dos es la efectividad.
                **También en el pasado**: «la barra representa cuánto se esperaba
                y la línea, a cuánto se llegó [...] no sólo aplica al futuro,
                aplica también a lo que ya se aplicó». Con eso el gráfico se lee
                igual a los dos lados de la línea de corte, que es lo que lo hace
                intuitivo.
                En elegibles POR AULA, que es la unidad del eje; los totales del
                día van en el hover, que es donde caben sin mentir la escala. */}
            {diasConBarra.map((d, i) => {
              // **La barra es lo que se ESPERABA del día** (Gonzalo, 2026-09-08:
              // «la barra gris es lo que se espera del día y la línea verde es
              // lo que se tuvo»). Medía los elegibles POR curso-horario, o sea
              // el aforo de un aula media, que es una pregunta de diseño y no la
              // de la jornada. Sin jornada del motor se conserva la medida
              // vieja, que es lo único que hay.
              const jornada = jornadaDe.get(d.fecha);
              const techo = jornada
                ? jornada.esperadas
                : (d.elegibles && d.aulas ? d.elegibles / d.aulas : 0);
              if (!techo) return null;
              const ancho = anchoDeBarraDelDia(fechas.length);
              // **La tercera altura: lo que el DISEÑO supuso de cada una de esas
              //   aulas.** La barra era el techo y la línea lo conseguido, así que
              //   el gráfico comparaba el campo consigo mismo y con la media del
              //   estudio, pero nunca contra la vara con la que se dimensionó.
              //
              //   Va DENTRO de la barra y no como una cuarta línea suelta: es el
              //   mismo patrón de la barra de efectividad —relleno hasta la vara,
              //   tapa en el techo—, y una línea más sobre las tres que ya hay no
              //   se leería. La zona baja es lo que el diseño pedía; lo que queda
              //   sobre ella es techo que sobraba.
              //
              //   **Tapa sólida y vara punteada**, que es la convención que este
              //   gráfico ya usa: lo medido va sólido y lo supuesto punteado.
              const vara = d.esperadoPorAulaDelDiseno;
              return (
                <g key={`techo-obs-${d.fecha}`}>
                  <rect x={xa(i) - ancho / 2} y={y(techo)}
                    width={ancho} height={Math.max(0, MARGEN + UTIL - y(techo))}
                    fill="var(--pulso-text)" opacity="0.055" />
                  {vara != null && vara > 0 ? (
                    <>
                      {/* **El relleno es la señal, no la raya.** Con las dos zonas
                          al mismo tono la vara sólo se distinguía por una raya
                          punteada gris, y en este gráfico YA hay otra punteada
                          gris —el esperado—: dos cosas distintas con el mismo
                          trazo. Con la zona baja más oscura la barra se lee de un
                          vistazo en dos tramos, lo que el diseño pedía y el techo
                          que sobraba, y la raya queda de refuerzo. */}
                      <rect x={xa(i) - ancho / 2} y={y(Math.min(vara, techo))}
                        width={ancho} height={Math.max(0, MARGEN + UTIL - y(Math.min(vara, techo)))}
                        fill="var(--pulso-text)" opacity="0.10" />
                      <line x1={xa(i) - ancho / 2} y1={y(vara)} x2={xa(i) + ancho / 2} y2={y(vara)}
                        stroke="var(--pulso-text-soft)" strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke" opacity="0.85" />
                    </>
                  ) : null}
                  <line x1={xa(i) - ancho / 2} y1={y(techo)} x2={xa(i) + ancho / 2} y2={y(techo)}
                    stroke="var(--pulso-border-strong)" strokeWidth="1.5" opacity="0.9"
                    vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
            {diasProyectadosConBarra.map((d, i) => {
              // Los días por venir van en la MISMA unidad que los pasados: lo
              // que se espera de sus cursos-horario agendados. Con el gráfico en
              // totales, una barra de «elegibles por aula» al lado de una de 329
              // se dibujaría pegada al suelo y se leería como una jornada mala.
              const techo = jornadasEnElEje.length
                ? d.esperadas
                : (d.elegibles && d.aulas ? d.elegibles / d.aulas : 0);
              if (!techo) return null;
              const ancho = anchoDeBarraDelDia(fechas.length);
              return (
                <g key={`techo-${d.fecha}`}>
                  <rect x={xp(i) - ancho / 2} y={y(techo)}
                    width={ancho} height={Math.max(0, MARGEN + UTIL - y(techo))}
                    fill={COLOR_RESULTADO.pendiente} opacity="0.22" />
                  <line x1={xp(i) - ancho / 2} y1={y(techo)}
                    x2={xp(i) + ancho / 2} y2={y(techo)}
                    stroke={COLOR_RESULTADO.pendiente} strokeWidth="1.5" opacity="0.5"
                    vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
            {/* Lo INFERIDO. Arranca en el último día con parte para que se vea de
                dónde sale, y sólo llega hasta donde llega la agenda. */}
            {proyectada && porVenir.length ? (
              <polyline
                points={[`${x(corteX)},${y(elegida!.esperadoFinal)}`,
                  ...porVenir.map((_, i) => `${xp(i)},${y(proyectada.esperadoPorAula)}`)].join(" ")}
                fill="none" stroke={COLOR_RESULTADO.parcial} strokeWidth="2.5"
                strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            ) : null}
            </g>
          </svg>
            {porVenir.length ? (
              <>
                <span className="aulas-serie-zona es-aplicado"
                  style={{ right: `${100 - x(corteX)}%` }}>aplicado</span>
                <span className="aulas-serie-zona es-agendado"
                  style={{ left: `${x(corteX)}%` }}>agendado</span>
              </>
            ) : null}
          {/* Los puntos van en HTML y no como `<circle>`: en un viewBox estirado
              un círculo sale elipse. Y son los que llevan el hover: cada uno dice
              su fecha, sus aulas, sus encuestas y si eso es observado o inferido.
              Sólo con una facultad elegida: veinte series de puntos son una nube,
              no un dato. */}
          {/* **También sin facultad en foco** (Gonzalo, 2026-09-08: «no tiene
              hover, entonces no tengo idea de cuánto era lo que se tenía
              previsto y cuántas fueron las efectivas al final»). El comentario
              de arriba habla de las SERIES —veinte líneas de puntos sí son una
              nube—, pero un punto por día sobre el agregado es justo el dato que
              faltaba: cuántas efectivas dejó la jornada y contra qué se
              comparaba. Con foco es la facultad; sin foco, el estudio. */}
          {/* **Un punto por día sobre la línea verde** (Gonzalo, 2026-09-08:
              «cada punto verde por día debería tener un pequeño círculo cerca
              para ver bien la diferencia entre lo aplicado y lo que se preveía
              aplicar»). Los puntos existían pero se colocaban con la cifra POR
              curso-horario, así que sobre un eje de efectivas del día caían al
              suelo, lejos de su propia línea. Con la jornada del motor van donde
              está el dato, que es justo a la altura desde la que se mide contra
              la barra gris de lo esperado. */}
          {jornadasEnElEje.length ? diasConBarra.map((d, i) => {
            const j = jornadaDe.get(d.fecha);
            if (!j) return null;
            const alto = y(j.conseguidas);
            const lineas = [
              { tenue: `${dm(d.fecha)} · observado` },
              { titular: fmt(j.conseguidas), unidad: "efectivas del día" },
              { tenue: `${fmt(j.esperadas)} esperadas de los cursos-horario aplicados` },
              { tenue: `${j.diferencia > 0 ? "+" : ""}${fmt(j.diferencia)} contra lo esperado` },
            ];
            return (
              <span key={d.fecha} className="aulas-serie-punto" tabIndex={0} role="img"
                style={{ left: `${xa(i)}%`, top: `${alto}%` }}
                aria-label={`${dm(d.fecha)}: ${fmt(j.conseguidas)} efectivas del día de ${fmt(j.esperadas)} esperadas`}
                onMouseEnter={() => setPista({ x: xa(i), y: alto, lineas, bloque: "diario" })}
                onFocus={() => setPista({ x: xa(i), y: alto, lineas, bloque: "diario" })}
                onMouseLeave={() => setPista(null)}
                onBlur={() => setPista(null)} />
            );
          }) : diasConBarra.map((d, i) => (d.porAula == null ? null : (
            <span key={d.fecha} className="aulas-serie-punto" tabIndex={0} role="img"
              style={{ left: `${xa(i)}%`, top: `${y(d.porAula)}%` }}
              // Lo que se OYE tiene que decir lo mismo que lo que se lee: la
              // tarjeta ya dice «efectivas del parte» y este aria-label seguia
              // en «encuestas», que es justo la palabra que no distinguia de
              // que cuenta se hablaba.
              aria-label={`${dm(d.fecha)}, observado, ${fmt(d.efectivas)} efectivas del parte en ${fmt(d.aulas)} cursos-horario`}
              onMouseEnter={() => setPista({ x: xa(i), y: y(d.porAula!), lineas: lineasDelDia(d), bloque: "diario" })}
              onFocus={() => setPista({ x: xa(i), y: y(d.porAula!), lineas: lineasDelDia(d), bloque: "diario" })}
              onMouseLeave={() => setPista(null)}
              onBlur={() => setPista(null)} />
          )))}
          {proyectada ? proyectada.dias.map((d, i) => {
            const lineas = [
              `${dm(d.fecha)} · inferido de la agenda`,
              `${fmt(d.aulas)} ${d.aulas === 1 ? "curso-horario agendado" : "cursos-horario agendados"}`,
              d.elegibles ? `${fmt(d.elegibles)} elegibles · ~${personasProyectadas(d.esperadas)} esperadas` : `~${personasProyectadas(d.esperadas)} esperadas`,
            ];
            const px = xp(i);
            const py = y(proyectada.esperadoPorAula);
            return (
              <span key={d.fecha} className="aulas-serie-punto es-inferido" tabIndex={0} role="img"
                style={{ left: `${px}%`, top: `${py}%` }}
                aria-label={pistaEnPalabras(lineas)}
                onMouseEnter={() => setPista({ x: px, y: py, lineas, bloque: "diario" })}
                onFocus={() => setPista({ x: px, y: py, lineas, bloque: "diario" })}
                onMouseLeave={() => setPista(null)}
                onBlur={() => setPista(null)} />
            );
          }) : null}
          {pista ? (
            <span className="aulas-serie-guia" style={{ left: `${pista.x}%` }} />
          ) : null}
          {pista && pista.bloque === "diario" ? (
            <div className={`aulas-serie-pista${anclaje(pista.x)}`} role="status"
              style={{ left: `${pista.x}%`, top: `${pista.y}%` }}>
              {pista.lineas.map(trozo)}
            </div>
          ) : null}
        </div>
      {ejeDeDias}
      </div>

      {/* Sin repetir la última fecha: ya está en el eje por día, dos líneas más
          arriba, y verla dos veces se lee como dos datos distintos. */}
      <p className="aulas-serie-eje">
        {/* **Con foco, «11 días con parte» era del ESTUDIO.**

            El eje recorre los días del estudio y eso está bien —sin ellos no
            hay con qué comparar—, pero el rótulo se leía como «esta facultad
            tuvo parte once días» cuando Educación tuvo dos. Es la misma cifra
            global colada en un contexto de facultad que aplastaba el eje dos
            paneles más arriba.

            Se dicen las dos: la suya primero, que es la que se ha pedido al
            poner el foco, y el total detrás como referencia. */}
        {elegida ? (
          <span>
            {fmt(elegida.dias.filter((d) => (d.porAula ?? null) !== null).length)} de{" "}
            {fmt(aplicadas.length)} días con parte
          </span>
        ) : (
          <span>{fmt(aplicadas.length)} días con parte</span>
        )}
        {porVenir.length
          ? <span>{fmt(porVenir.length)} días agendados por delante</span>
          : <span>sin días agendados por delante</span>}
      </p>
      <p className="mon-profile-muted aulas-serie-pie">
        {/* **El pie dice lo que el gráfico DIBUJA.** Con el día como unidad son
            otras dos cosas que en la vista por curso-horario, y un pie que
            nombra la mediana y las veinte facultades manda a buscar líneas que
            ya no están. */}
        {jornadasEnElEje.length
          ? "La barra es lo que se esperaba de los cursos-horario aplicados ese día, calculado con la tasa de rendimiento de cada uno, y la línea verde lo que de verdad se consiguió. A la derecha del corte, lo que se espera de los que ya están agendados."
          : elegida
          ? "Las barras son el techo de cada día (los elegibles de sus cursos-horario, por curso-horario) y la línea, lo que se consiguió de ellos: la distancia entre las dos es la efectividad. La barra va en dos tonos: el tramo oscuro de abajo es lo que el diseño pedía de cada curso-horario (con la tasa del curso-horario, que ajusta por su tamaño, no con la tasa de la facultad del panel de arriba) y lo claro de arriba, el techo que sobraba. Con la línea por encima del corte el día dio más de lo dimensionado; por debajo, menos. A la derecha de la línea de corte se lee igual, pero con lo que se infiere de los cursos-horario YA AGENDADOS, ni un día más allá. La punteada gris es lo que cabe esperar de la siguiente aula según lo que lleva (encogido hacia la media del estudio cuando tiene pocas), y la raya horizontal es esa media. El esperado supone que el rendimiento no cambia con los días: no modela que una facultad se agote a medida que avanza el campo."
          : "La línea gruesa es la mediana del día y la banda, la mitad central de las facultades; detrás están las veinte, una por facultad. En verde y en granate, las dos que deciden: la que más rinde y la que menos. La raya horizontal es la media del estudio. Elige una facultad para ver su esperado y lo que se infiere de su agenda."}
      </p>
      </div>

      {/* Las DOS metas de la facultad, que es lo que decide si se sale a agendar.
          Gonzalo: «cada facultad tiene una meta por hombre y por mujer [...]
          tengo que ver si voy a llegar a la cuota, y si lo que tengo agendado ya
          es suficiente para llegar a esa meta o no. ¿Y cuándo llegaría?».
          Sólo con una facultad elegida: en la vista general son cuarenta filas y
          ninguna pregunta. */}
      {elegida && proyectada && proyectada.cuotas.length ? (
        <table className="aulas-serie-cuotas">
          <caption>
            Cuota de {elegida.facultad} y lo que aportan sus cursos-horario agendados
            {proyectada.reparto === "meta" ? (
              <em>
                {" "}· el reparto por sexo sale de la META, porque esta facultad
                todavía no tiene respuestas propias con sexo declarado
              </em>
            ) : null}
          </caption>
          <thead>
            <tr>
              <th scope="col">Sexo</th>
              <th scope="col">Meta</th>
              <th scope="col">Conseguidas</th>
              <th scope="col">Faltan</th>
              <th scope="col">De la agenda</th>
              <th scope="col">Con lo agendado</th>
            </tr>
          </thead>
          <tbody>
            {proyectada.cuotas.map((c) => {
              // El veredicto lo da `veredictoDeCeldaDeCuota`, no esta fila: aquí
              // no se podía comprobar —la tabla sólo se monta con una facultad
              // elegida, y el render estático nunca la ve— y era justo donde
              // vivía el tercer `0 >= 0` del módulo.
              const v = veredictoDeCeldaDeCuota(c, fmt, dm);
              return (
              <tr key={c.sexo} className={v.clase}>
                <th scope="row">{c.sexo}</th>
                <td>{v.sinCuota ? "—" : fmt(c.meta)}</td>
                <td>{fmt(c.observadas)}</td>
                <td>{v.sinCuota || c.faltan === 0 ? "—" : fmt(c.faltan)}</td>
                <td>{proyectada.aulasAgendadas ? `~${personasProyectadas(c.esperadasDeLaAgenda)}` : "—"}</td>
                <td>{v.texto}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {/* Que una facultad no tenga NADA agendado por delante no es un hueco del
          gráfico: es la noticia. Es el momento en que hay que salir a agendar, y
          callarlo deja la pantalla igual que si la agenda estuviera llena. */}
      {elegida && proyectada && !proyectada.aulasAgendadas ? (
        <p className="aulas-serie-aviso">
          <strong>{elegida.facultad}</strong> no tiene ningún curso-horario agendado por delante:
          sin agenda no hay nada que inferir, y lo que falte de su cuota no va a llegar solo.
          {proyectada.cuotas.some((c) => c.faltan > 0)
            ? ` Le faltan ${fmt(proyectada.cuotas.reduce((n, c) => n + c.faltan, 0))} encuestas de cuota.`
            : ""}
        </p>
      ) : null}

    </div>
  );
}
