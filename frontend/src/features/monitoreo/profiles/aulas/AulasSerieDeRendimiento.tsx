import { useMemo, useState } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import { sexSeriesKind, sexSeriesLabel } from "../../../calcMuestra/sexoPalette";
import { personasPorAula, personasProyectadas } from "./redondeoConservador";
import { serieDeRendimiento } from "./serieDeRendimiento";

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
const fmt = (n: number) => n.toLocaleString("es-PE");
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
  | { tenue: string };

/** Lo que lee un lector de pantalla: el globo pintado, en palabras. */
function pistaEnPalabras(trozos: ReadonlyArray<TrozoDePista>): string {
  return trozos.map((t) => (typeof t === "string" ? t
    : "tenue" in t ? t.tenue
      : t.cifras.map((c) => `${c.valor} ${c.de}`).join(" · "))).join(", ");
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

export function AulasSerieDeRendimiento({ partes, agenda = [], cuotas = [], plan = [], control = [], sobremuestra = null }: {
  partes: ReadonlyArray<MonitoreoRow>;
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
}) {
  const modelo = useMemo(() => serieDeRendimiento(partes, plan, control), [partes, plan, control]);
  const proyeccion = useMemo(
    () => proyeccionPorAgenda(agenda, partes, cuotas),
    [agenda, partes, cuotas],
  );
  const [foco, setFoco] = useState("");
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
  ]);
  const techosDeAgenda = proyectada
    ? proyectada.dias.map((d) => (d.aulas ? d.elegibles / d.aulas : 0))
    : [];
  const { tope, escalones } = escalaDeEje(Math.max(...valores, ...techosDeAgenda, mediaDelEstudio));
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
  /** El sitio en el eje del día `i` de las series aplicadas / agendadas. */
  const xa = (i: number) => x(enElEje(aplicadas[i]));
  const xp = (i: number) => x(enElEje(porVenir[i]));

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

  /** Las cuotas que aplican a la vista: las de la facultad, o las del estudio. */
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
    tope: number; escalones: number[]; meta: number; y: (v: number) => number; observado: string;
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
      ? elegida.metaDeLoVisitado
      : facultades.reduce((n, f) => n + f.metaDeLoVisitado, 0);
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
    const techo = Math.max(ultimo, meta, sobremuestra ?? 0, ...proyectadas, 1);
    const { tope, escalones } = escalaDeEje(techo);
    const yy = (v: number) => MARGEN + UTIL - (UTIL * v) / tope;
    const observado = observadas.map((v, i) => `${xa(i)},${yy(v)}`).join(" ");
    const inferido = proyectadas.length
      ? [`${x(corteX)},${yy(ultimo)}`, ...proyectadas.map((v, i) => `${xp(i)},${yy(v)}`)].join(" ")
      : "";
    const alCerrar = proyectadas.length ? proyectadas[proyectadas.length - 1] : ultimo;

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
    const lectura = meta > 0
      ? `${fmt(Math.round(ultimo))} de ${fmt(meta)} encuestas que el plan espera de las aulas visitadas · ${
          alCerrar >= meta
            ? "con lo agendado se pasa de esa meta"
            : `con lo agendado se llegaría a ${fmt(Math.floor(alCerrar))}, ${fmt(Math.ceil(meta - alCerrar))} por debajo`
        }`
      : `${fmt(Math.round(ultimo))} encuestas del parte · el plan no declara meta para esas aulas`;
    // Las cuotas se siguen señalizando aunque no haya serie: son el objetivo, y
    // no depende de que alguien haya respondido.
    const metasSeñaladas = cuotasVisibles
      .filter((c) => c.meta > 0)
      .map((c) => ({ sexo: sexSeriesLabel(c.sexo), color: colorDeSexo(c.sexo), meta: c.meta, observadas: c.observadas }));
    return {
      tope, escalones, meta, y: yy, observado, inferido, lectura, series, repartoObservado,
      // Cuántas de las conseguidas llevan sexo declarado en el libro. Si es menos
      // que el total, las dos líneas de sexo NO suman la verde y hay que decirlo.
      cubiertasPorSexo: hayLibroPorSexo ? cubiertas : null,
      conseguidasEnTotal: Math.round(ultimo),
      cruce: (() => {
        if (meta <= 0) return null;
        // Primero en lo YA conseguido: si la meta se paso, no hay nada que
        // pronosticar y la marca dice cuando se paso.
        const iObs = observadas.findIndex((v) => v >= meta);
        if (iObs >= 0) {
          return { x: xa(iObs), y: yy(observadas[iObs]), fecha: aplicadas[iObs], inferido: false };
        }
        const iInf = proyectadas.findIndex((v) => v >= meta);
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
              : [{ tenue: "sin sexo declarado todavía" }]),
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
  const lineasDelDia = (d: { fecha: string; aulas: number; elegibles: number; efectivas: number; porAula: number | null }) => [
    `${dm(d.fecha)} · observado`,
    `${fmt(d.aulas)} ${d.aulas === 1 ? "aula" : "aulas"}${d.elegibles ? ` · ${fmt(d.elegibles)} elegibles` : ""}`,
    `${fmt(d.efectivas)} encuestas · ${personasPorAula(d.porAula)} por aula`,
  ];

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
            encuestas por aula en {fmt(elegida.aulas)} {elegida.aulas === 1 ? "aula" : "aulas"} ·
            se espera <strong>{personasPorAula(elegida.esperadoFinal)}</strong> de la siguiente
            {elegida.aulas < 5 ? " (con tan pocas aulas, el esperado se apoya en la media del estudio)" : ""}
          </>
        ) : (
          <>
            <strong>{fmt(facultades.length)}</strong> facultades ·{" "}
            <strong>{personasPorAula(mediaDelEstudio)}</strong> encuestas por aula de media del estudio ·
            de <strong>{personasPorAula(facultades[0].esperadoFinal)}</strong>{" "}
            ({facultades[0].facultad}) a{" "}
            <strong>{personasPorAula(facultades[facultades.length - 1].esperadoFinal)}</strong>{" "}
            ({facultades[facultades.length - 1].facultad}) esperadas
          </>
        )}
      </p>

      <div className="aulas-serie-mando">
        <button type="button" className={foco ? "" : "is-activa"} onClick={() => setFoco("")}>
          Todas
        </button>
        <button type="button" aria-label="Facultad anterior" onClick={() => mover(-1)}>‹</button>
        <select value={foco} onChange={(e) => setFoco(e.currentTarget.value)} aria-label="Facultad">
          <option value="">Todas las facultades</option>
          {facultades.map((f) => (
            <option key={f.facultad} value={f.facultad}>
              {f.facultad} · {personasPorAula(f.esperadoFinal)} esperadas
            </option>
          ))}
        </select>
        <button type="button" aria-label="Facultad siguiente" onClick={() => mover(1)}>›</button>
      </div>

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
            <b>Acumulado por día <i>· encuestas conseguidas contra la meta</i></b>
            {/* Una sola línea de leyenda y sólo con lo que se está dibujando. Con
                las cuatro explicaciones fijas más el aviso más la sobremuestra, el
                hueco entre los dos gráficos era un párrafo de 10 px ilegible. */}
            <span className="aulas-serie-leyenda">
              {acumulado.meta > 0 ? (
                <em className="es-horizontal es-gris">Meta {fmt(acumulado.meta)}</em>
              ) : null}
              {acumulado.hayObservadasPorSexo ? null : (
                <em className="es-ausente">
                  Sin respuestas atribuidas a un curso-horario no hay serie por sexo:
                  se señalan sólo las dos cuotas
                </em>
              )}
                {/* La sobremuestra, dicha o declarada ausente. Callarla dejaría la
                  pantalla igual tanto si el estudio la tiene como si no. */}
              {sobremuestra && sobremuestra > acumulado.meta ? (
                <em style={{ "--aulas-serie-color": COLOR_RESULTADO.revision } as React.CSSProperties}>
                  Sobremuestra {fmt(sobremuestra)}
                  {acumulado.series.length && acumulado.series.every((se) => se.alcanza) ? " · referencia" : " · referencia, no obligatoria"}
                </em>
              ) : (
                <em className="es-ausente">Sobremuestra no declarada por el estudio</em>
              )}
              {acumulado.series.map((se) => (
                <em key={se.sexo} style={{ "--aulas-serie-color": se.color } as React.CSSProperties}>
                  {se.sexo} {fmt(Math.round(se.conseguidas))}/{fmt(se.meta)}
                  {se.meta > 0 ? (se.alcanza ? " ✓" : ` · faltan ${fmt(Math.ceil(se.faltan))}`) : ""}
                </em>
              ))}
              {/* **Las dos cifras de sexo no suman la verde**, y sin esto el
                  gráfico deja creer que sí. El reparto sólo se conoce en las aulas
                  cuyo libro lo declara: en Estudios Generales Letras la verde vale
                  31 el primer día y las series de sexo arrancan dos días después,
                  no porque no hubiera aulas sino porque el libro calla su
                  reparto. */}
              {acumulado.cubiertasPorSexo != null
                && acumulado.cubiertasPorSexo < acumulado.conseguidasEnTotal ? (
                <em className="es-ausente">
                  sexo declarado en {fmt(acumulado.cubiertasPorSexo)} de{" "}
                  {fmt(acumulado.conseguidasEnTotal)} encuestas
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
              {/* LA ZONA DE LO AGENDADO. Gonzalo: «el grafico sigue sin
                  diferenciar el pasado del futuro o lo previsto». Y era exacto: la
                  unica separacion era una vertical punteada del MISMO gris que la
                  rejilla —#e2e7f0, indistinguible de una linea de fondo— y una
                  fecha en ambar de 10 px. Lo que se lee de un vistazo es la
                  superficie, no la raya: todo lo que cae a la derecha del ultimo
                  parte va sobre fondo teñido, y ahi dentro nada es un hecho. */}
              {porVenir.length ? (
                <rect x={x(corteX)} y={MARGEN} width={Math.max(0, 100 - MARGEN - x(corteX))}
                  height={UTIL} fill={COLOR_RESULTADO.pendiente} opacity="0.07" />
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
              {sobremuestra && sobremuestra > acumulado.meta ? (
                <line x1={MARGEN} y1={acumulado.y(sobremuestra)} x2={100 - MARGEN}
                  y2={acumulado.y(sobremuestra)}
                  stroke={COLOR_RESULTADO.revision} strokeWidth="1" strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke" opacity="0.7" />
              ) : null}
              {/* La META, que es contra lo que se lee todo lo demás. En NEUTRO:
                  iba en el mismo rosa que la cuota de mujeres y las dos lineas
                  quedaban indistinguibles diciendo cosas distintas. La meta no es
                  de ningun sexo. */}
              {acumulado.meta > 0 ? (
                <line x1={MARGEN} y1={acumulado.y(acumulado.meta)} x2={100 - MARGEN}
                  y2={acumulado.y(acumulado.meta)}
                  stroke="var(--pulso-text-faint)" strokeWidth="1.5" strokeDasharray="6 3"
                  vectorEffect="non-scaling-stroke" opacity="0.9" />
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
                  stroke={se.color} strokeWidth="1.2" strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke" opacity="0.75" />
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
            {separaLasMetas([
              { clave: "total", valor: acumulado.meta, color: "var(--pulso-text-faint)", que: "Meta" },
              ...acumulado.metasSeñaladas.map((se) => ({
                clave: se.sexo, valor: se.meta, color: se.color, que: sexSeriesLabel(se.sexo),
              })),
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
        </div>
        <p className="aulas-serie-eje aulas-serie-lectura-acumulado">
          <span>{acumulado.lectura}</span>
        </p>
          <p className="mon-profile-muted aulas-serie-pie">
            El <strong>sólido</strong> es lo conseguido y el <strong>punteado</strong>,
            lo que se infiere de las aulas ya agendadas; las horizontales son la meta
            y las cuotas de cada sexo.
          </p>
        </div>
      ) : null}

      <div className="aulas-serie-bloque"
        data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="aulas-serie-rotulo">
          <b>Día a día <i>· encuestas por aula, con los elegibles de fondo</i></b>
        </p>
      <div className="aulas-serie-plot">
        <ul className="aulas-serie-y" aria-hidden="true">
          {escalones.map((m) => <li key={m}><span>{fmt(m)}</span><i /></li>)}
        </ul>
        <div className="aulas-serie-lienzo">
          <svg className="aulas-serie-grafico" viewBox="0 0 100 100" preserveAspectRatio="none"
            role="img"
            aria-label={elegida
              ? `Rendimiento diario de ${elegida.facultad}; esperado ${elegida.esperadoFinal} encuestas por aula`
              : `Rendimiento diario de ${fmt(facultades.length)} facultades; media del estudio ${mediaDelEstudio}`}>
            {/* LA ZONA DE LO AGENDADO, debajo de todo. Ver el comentario del
                acumulado: la raya sola no separaba nada porque iba del color de
                la rejilla. */}
            {porVenir.length ? (
              <rect x={x(corteX)} y={MARGEN} width={Math.max(0, 100 - MARGEN - x(corteX))}
                height={UTIL} fill={COLOR_RESULTADO.pendiente} opacity="0.07" />
            ) : null}
            {escalones.map((m) => (
              <line key={m} x1={MARGEN} y1={y(m)} x2={100 - MARGEN} y2={y(m)}
                stroke="var(--pulso-border)" strokeWidth="1"
                vectorEffect="non-scaling-stroke" opacity={m === 0 ? 1 : 0.55} />
            ))}
            {/* La media del estudio, siempre visible: es contra lo que se compara
                cualquier facultad, y es el prior del esperado. */}
            <line x1={MARGEN} y1={y(mediaDelEstudio)} x2={100 - MARGEN} y2={y(mediaDelEstudio)}
              stroke={COLOR_RESULTADO.revision} strokeWidth="1.2" strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke" opacity="0.7" />
            {/* La banda de dispersión, debajo de todo: entre el cuartil 1 y el 3
                de cada día está la mitad central de las facultades. */}
            {conBanda ? (
              <polygon
                points={[
                  ...cuartiles.map((c, i) => (c ? `${xa(i)},${y(c.p75)}` : null)).filter(Boolean),
                  ...cuartiles.map((c, i) => (c ? `${xa(i)},${y(c.p25)}` : null)).filter(Boolean).reverse(),
                ].join(" ")}
                fill={COLOR_RESULTADO.efectiva} opacity="0.1" />
            ) : null}
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
            {/* La mediana del día, que es la línea que de verdad se lee. */}
            {conBanda ? (
              <polyline
                points={cuartiles.map((c, i) => (c ? `${xa(i)},${y(c.p50)}` : null)).filter(Boolean).join(" ")}
                fill="none" stroke={COLOR_RESULTADO.efectiva} strokeWidth="3"
                strokeLinejoin="round" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
            ) : null}
            {/* El esperado del ESTUDIO sobre lo agendado. Arranca en la mediana
                del último día con parte para que se vea de dónde sale. */}
            {conBanda && esperadoDelEstudio.some((v) => v != null) ? (
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
            {elegida ? (
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
            {elegida ? elegida.dias.map((d, i) => {
              if (!d.elegibles || !d.aulas) return null;
              const techo = d.elegibles / d.aulas;
              const ancho = fechas.length > 1 ? Math.min((UTIL / (fechas.length - 1)) * 0.36, 4.5) : 4.5;
              return (
                <g key={`techo-obs-${d.fecha}`}>
                  <rect x={xa(i) - ancho / 2} y={y(techo)}
                    width={ancho} height={Math.max(0, MARGEN + UTIL - y(techo))}
                    fill="var(--pulso-text)" opacity="0.055" />
                  <line x1={xa(i) - ancho / 2} y1={y(techo)} x2={xa(i) + ancho / 2} y2={y(techo)}
                    stroke="var(--pulso-border-strong)" strokeWidth="1.5" opacity="0.9"
                    vectorEffect="non-scaling-stroke" />
                </g>
              );
            }) : null}
            {proyectada ? proyectada.dias.map((d, i) => {
              if (!d.elegibles || !d.aulas) return null;
              const techo = d.elegibles / d.aulas;
              const ancho = fechas.length > 1 ? Math.min((UTIL / (fechas.length - 1)) * 0.36, 4.5) : 4.5;
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
            }) : null}
            {/* Lo INFERIDO. Arranca en el último día con parte para que se vea de
                dónde sale, y sólo llega hasta donde llega la agenda. */}
            {proyectada && porVenir.length ? (
              <polyline
                points={[`${x(corteX)},${y(elegida!.esperadoFinal)}`,
                  ...porVenir.map((_, i) => `${xp(i)},${y(proyectada.esperadoPorAula)}`)].join(" ")}
                fill="none" stroke={COLOR_RESULTADO.parcial} strokeWidth="2.5"
                strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            ) : null}
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
          {elegida ? elegida.dias.map((d, i) => (d.porAula == null ? null : (
            <span key={d.fecha} className="aulas-serie-punto" tabIndex={0} role="img"
              style={{ left: `${xa(i)}%`, top: `${y(d.porAula)}%` }}
              aria-label={`${dm(d.fecha)}, observado, ${fmt(d.efectivas)} encuestas en ${fmt(d.aulas)} aulas`}
              onMouseEnter={() => setPista({ x: xa(i), y: y(d.porAula!), lineas: lineasDelDia(d), bloque: "diario" })}
              onFocus={() => setPista({ x: xa(i), y: y(d.porAula!), lineas: lineasDelDia(d), bloque: "diario" })}
              onMouseLeave={() => setPista(null)}
              onBlur={() => setPista(null)} />
          ))) : null}
          {proyectada ? proyectada.dias.map((d, i) => {
            const lineas = [
              `${dm(d.fecha)} · inferido de la agenda`,
              `${fmt(d.aulas)} ${d.aulas === 1 ? "aula agendada" : "aulas agendadas"}`,
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
      {/* El eje por día, con UNA marca por fecha. Gonzalo: «el eje que es
          importantísimo, porque yo tengo que saber qué días aplicó». Tres
          etiquetas en los extremos no contestaban eso. Las etiquetas se alternan
          cuando hay muchas, pero las marcas están todas. */}
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
      </div>

      {/* Sin repetir la última fecha: ya está en el eje por día, dos líneas más
          arriba, y verla dos veces se lee como dos datos distintos. */}
      <p className="aulas-serie-eje">
        <span>{fmt(aplicadas.length)} días con parte</span>
        {porVenir.length
          ? <span>{fmt(porVenir.length)} días agendados por delante</span>
          : <span>sin días agendados por delante</span>}
      </p>
      <p className="mon-profile-muted aulas-serie-pie">
        {elegida
          ? "Las barras son el techo de cada día —los elegibles de sus aulas, por aula— y la línea, lo que se consiguió de ellos: la distancia entre las dos es la efectividad. A la derecha de la línea de corte se lee igual, pero con lo que se infiere de las aulas YA AGENDADAS, ni un día más allá. La punteada gris es lo que cabe esperar de la siguiente aula según lo que lleva —encogido hacia la media del estudio cuando tiene pocas—, y la raya horizontal es esa media. El esperado supone que el rendimiento no cambia con los días: no modela que una facultad se agote a medida que avanza el campo."
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
            Cuota de {elegida.facultad} y lo que aportan sus aulas agendadas
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
            {proyectada.cuotas.map((c) => (
              <tr key={c.sexo} className={c.faltan === 0 ? "es-cumplida" : c.alcanza ? "es-llega" : "es-corta"}>
                <th scope="row">{c.sexo}</th>
                <td>{fmt(c.meta)}</td>
                <td>{fmt(c.observadas)}</td>
                <td>{c.faltan === 0 ? "—" : fmt(c.faltan)}</td>
                <td>{proyectada.aulasAgendadas ? `~${personasProyectadas(c.esperadasDeLaAgenda)}` : "—"}</td>
                <td>
                  {c.faltan === 0
                    ? "cuota cumplida"
                    : c.fechaDeCruce
                      ? `llega el ${dm(c.fechaDeCruce)}`
                      : `no llega · faltarían ${fmt(c.faltanAlCerrarAgenda)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {/* Que una facultad no tenga NADA agendado por delante no es un hueco del
          gráfico: es la noticia. Es el momento en que hay que salir a agendar, y
          callarlo deja la pantalla igual que si la agenda estuviera llena. */}
      {elegida && proyectada && !proyectada.aulasAgendadas ? (
        <p className="aulas-serie-aviso">
          <strong>{elegida.facultad}</strong> no tiene ninguna aula agendada por delante:
          sin agenda no hay nada que inferir, y lo que falte de su cuota no va a llegar solo.
          {proyectada.cuotas.some((c) => c.faltan > 0)
            ? ` Le faltan ${fmt(proyectada.cuotas.reduce((n, c) => n + c.faltan, 0))} encuestas de cuota.`
            : ""}
        </p>
      ) : null}

    </div>
  );
}
