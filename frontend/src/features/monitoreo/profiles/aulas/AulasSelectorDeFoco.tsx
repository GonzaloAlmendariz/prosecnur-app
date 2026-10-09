import type { FocoDeCuota, FocoTipo } from "./AulasCuotasResumen";
import {
  etiquetaDeValor, etiquetaPluralDelEje, etiquetaDelEje, type EjeDeclarado,
} from "./etiquetaDelEje";

/**
 * El selector de foco de la sección, para la cabecera.
 *
 * **Vivía dentro de un panel** —el de la serie de rendimiento— y eso le daba dos
 * defectos que Gonzalo nombró: se movía con el scroll, y sólo existía en la
 * pestaña que lo montaba, teniendo el perfil nueve listas de las mismas veinte
 * facultades. «El selector debería tener una vista privilegiada y permanente
 * arriba y que no se mueva, como el título y el icono».
 *
 * Al subirlo, los nombres de facultad de las tablas dejaron de necesitar ser
 * botones: «no es necesario que sean botones cuando ya tenemos un selector
 * arriba que toma en cuenta o todas las facultades o una por una».
 *
 * **Se llamaba `AulasSelectorDeFacultad` y ofrecía una sola dimensión.** Con el
 * eje de cuotas declarable eso deja de alcanzar por dos motivos distintos: el
 * eje puede no ser la facultad (CCSS Perfil 2026-II mide por NIVEL), y además
 * carrera y sexo son referenciales y también sirven para acotar lo que se ve
 * (decisión 11 del plan, 2026-09-17: «el eje más carrera y sexo»).
 *
 * Tres decisiones de forma, cada una con su porqué:
 *
 * - **La dimensión en juego la dice el FOCO, no un estado propio.** El foco es
 *   una dimensión de la gramática de navegación y viaja en la URL; guardar aquí
 *   «qué dimensión estoy mirando» crearía un segundo sitio donde vive lo mismo,
 *   y al volver por un enlace las dos discreparían.
 * - **El conmutador sólo aparece si hay más de una dimensión con valores.** Un
 *   estudio sin composición publicada —o sin padrón, que es de donde salen
 *   carrera y sexo— enseñaría dos botones muertos.
 * - **Los rótulos salen del eje** (`etiquetaDelEje`), no del código: en un
 *   estudio por nivel el grupo se llama «Nivel en foco» y el «todas» dice
 *   «Todos los niveles».
 */
export function AulasSelectorDeFoco({ valores, foco, onFoco, eje }: {
  /**
   * Los valores de cada dimensión, ya ordenados por quien los conoce: el eje
   * desde las filas del avance, y carrera y sexo desde
   * `avance_cuota.composicion`, que **ya viene ordenado por población** — no se
   * reordena aquí, porque el orden de una lista no puede bailar con cada
   * sincronización.
   */
  valores: {
    eje: ReadonlyArray<string>;
    carrera?: ReadonlyArray<string>;
    sexo?: ReadonlyArray<string>;
  };
  /** El foco vigente de la sección; de él sale la dimensión en juego. */
  foco: FocoDeCuota;
  onFoco: (foco: FocoDeCuota) => void;
  /** La declaración del eje (`avance_cuota.eje`). Sin ella, facultad. */
  eje?: EjeDeclarado;
}) {
  const claveDelEje = (String(eje?.clave ?? "facultad") || "facultad") as FocoTipo;
  // Las dimensiones ofrecidas, en el orden en que se piensan: primero la que
  // manda —el eje, que es la cuota— y después las descriptivas.
  // **El «todas» de cada dimensión se declara, no se deriva.** Añadirle una «s»
  // al rótulo daba «Todas las sexos». El plural de una palabra no sale de una
  // regla en castellano, y una frase mal construida en la cabecera —el sitio más
  // visto de la sección— resta más de lo que ahorra.
  type Dimension = { tipo: FocoTipo; rotulo: string; todas: string; lista: ReadonlyArray<string> };
  const dimensiones: Dimension[] = (
    [
      {
        tipo: claveDelEje, rotulo: etiquetaDelEje(eje),
        todas: `Todos: ${etiquetaPluralDelEje(eje)}`, lista: valores.eje ?? [],
      },
      { tipo: "carrera" as FocoTipo, rotulo: "Carrera", todas: "Todas las carreras", lista: valores.carrera ?? [] },
      { tipo: "sexo" as FocoTipo, rotulo: "Sexo", todas: "Mujeres y hombres", lista: valores.sexo ?? [] },
    ] satisfies Dimension[]
  ).filter((d) => d.lista.length > 0);

  if (!dimensiones.length) return null;

  // `aula` no es una dimensión de este selector —abre una ficha, no acota—, así
  // que un foco de aula deja el selector en el eje sin borrarlo.
  const activa = dimensiones.find((d) => d.tipo === foco?.tipo) ?? dimensiones[0];
  const valor = foco?.tipo === activa.tipo ? foco.valor : "";
  const poner = (v: string) => onFoco(v ? { tipo: activa.tipo, valor: v } : null);

  // El paso circular: desde el último, «siguiente» vuelve al primero. Sin eso el
  // recorrido se acaba y hay que volver al desplegable para seguir.
  const mover = (paso: number) => {
    const i = activa.lista.indexOf(valor);
    if (i < 0) return poner(activa.lista[paso > 0 ? 0 : activa.lista.length - 1]);
    poner(activa.lista[(i + paso + activa.lista.length) % activa.lista.length]);
  };

  return (
    <div className="aulas-serie-mando" role="group" aria-label={`${activa.rotulo} en foco`}>
      {dimensiones.length > 1 ? (
        <select
          className="aulas-serie-dimension"
          value={activa.tipo}
          // Cambiar de dimensión SUELTA el foco en vez de arrastrar el valor: un
          // «ECONOMÍA» no significa nada como nivel, y llevarlo dejaría la
          // sección filtrada por algo que no existe.
          onChange={(e) => {
            const siguiente = e.currentTarget.value as FocoTipo;
            onFoco(siguiente === activa.tipo ? foco : null);
          }}
          aria-label="Dimensión en foco"
        >
          {dimensiones.map((d) => (
            <option key={d.tipo} value={d.tipo}>{d.rotulo}</option>
          ))}
        </select>
      ) : null}
      <button type="button" className={valor ? "" : "is-activa"} onClick={() => poner("")}>
        Todas
      </button>
      <button type="button" aria-label={`${activa.rotulo} anterior`} onClick={() => mover(-1)}>‹</button>
      <select value={valor} onChange={(e) => poner(e.currentTarget.value)} aria-label={activa.rotulo}>
        <option value="">{activa.todas}</option>
        {activa.lista.map((v) => (
          <option key={v} value={v}>{etiquetaDeValor(v, activa.tipo, eje)}</option>
        ))}
      </select>
      <button type="button" aria-label={`${activa.rotulo} siguiente`} onClick={() => mover(1)}>›</button>
    </div>
  );
}
