import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { celdasPrevistas, piramideDeCuota, type LadoDeCuota } from "./piramideDeCuota";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt } from "./kpisDeAulas";

/**
 * La cuota de sexo por facultad, enfrentada como una pirámide.
 *
 * Una fila por facultad, un sexo a cada lado, **cada lado contra su propia
 * meta**. Así se ve en un vistazo de qué lado va corta cada facultad, que es la
 * pregunta de campo; la lista ordenada por cumplimiento contestaba la otra
 * —qué celda se va a incumplir— y dejaba las dos celdas de una facultad lejos
 * una de otra.
 *
 * Barras en CSS, sin Plotly: son doce barras y esta pestaña ya carga bastante.
 */

/** `2026-08-24` → `24/08`. */
const dm = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
};

/**
 * Lo que hay que leer de esta celda, en tres palabras.
 *
 * La cifra decía «78 faltan», que es dónde está la celda hoy. Con la proyección
 * encima puede decir dónde va a acabar, que es lo que decide si hay que hacer
 * algo: **una celda a la que le faltan 78 pero que cierra el jueves no necesita
 * a nadie, y una a la que le faltan 12 y no cierra, sí.** Sin agenda publicada
 * se sigue diciendo lo de antes, porque predecir sin datos sería inventar.
 */
function veredicto(lado: LadoDeCuota): { texto: string; estado: "cumplida" | "cierra" | "no-cierra" | "sin-dato" } {
  if (lado.cumple) return { texto: "cumplida", estado: "cumplida" };
  if (lado.cierra === null) return { texto: `${fmt(lado.faltan)} faltan`, estado: "sin-dato" };
  if (lado.cierra) {
    return {
      texto: lado.cierraEl ? `cierra ${dm(lado.cierraEl)}` : "cierra",
      estado: "cierra",
    };
  }
  // Lo que va a faltar CUANDO SE ACABE la agenda, no lo que falta ahora: es la
  // cifra con la que se decide cuántas aulas más pedir.
  return { texto: `faltarán ${fmt(lado.faltanAlCerrar)}`, estado: "no-cierra" };
}

/**
 * El color dice el ESTADO de la celda, no lo lejos que está: eso ya lo dice el
 * largo de la barra.
 *
 * Tenía un corte inventado en el 50 % que pintaba de gris todo lo que no
 * llegara —y `pendiente` es, por definición de la paleta, «del universo,
 * todavía sin trabajar»—. Así, Ciencias e Ingeniería F, con 191 de 421
 * recogidas, salía del color que significa «nadie la ha tocado» y se leía como
 * la MENOS urgente siendo la que va más atrás.
 *
 * Los tres estados son los que el motor ya decide en `.monitoreo_aulas_quota`:
 * cumplida cuando llega, pendiente cuando no se ha recogido NADA, y en riesgo
 * en medio. Aquí se reproduce esa misma regla —`observadas === 0`— en vez de
 * inventar un umbral propio.
 */
function tono(lado: LadoDeCuota) {
  if (lado.cumple) return COLOR_RESULTADO.efectiva;
  return lado.observadas > 0 ? COLOR_RESULTADO.parcial : COLOR_RESULTADO.pendiente;
}

/** Un lado de la fila; `hacia` decide de qué borde crece la barra. */
function Lado({ lado, tope, hacia }: {
  lado: LadoDeCuota | null;
  tope: number;
  hacia: "izquierda" | "derecha";
}) {
  if (!lado) {
    // Una facultad sin esa celda no se dibuja vacía como si fuera un cero: el
    // plan no declaró esa cuota y decirlo es distinto de decir que va en cero.
    return <span className={`aulas-piramide-lado es-${hacia} es-sin-cuota`}>sin cuota</span>;
  }
  // El carril mide la META contra la meta más alta —así una facultad grande se
  // ve grande— y el relleno, lo observado dentro de su propia meta.
  const carril = tope ? Math.max(6, (100 * lado.meta) / tope) : 0;
  const relleno = Math.min(100, lado.avance);
  const v = veredicto(lado);
  const detalle = lado.cierra === null
    ? ""
    : lado.cumple
      ? ""
      : lado.cierra
        ? ` · con lo agendado llega${lado.cierraEl ? ` el ${dm(lado.cierraEl)}` : ""}`
        : ` · con lo agendado se queda a ${fmt(lado.faltanAlCerrar)}`;
  return (
    <span
      className={`aulas-piramide-lado es-${hacia}`}
      title={`${lado.sexo}: ${fmt(lado.observadas)} de ${fmt(lado.meta)} · ${lado.avance}%${detalle}`}
    >
      <span className={`aulas-piramide-cifra es-${v.estado}`}>{v.texto}</span>
      <span className="aulas-piramide-carril" style={{ width: `${carril}%` }}>
        <i style={{ width: `${relleno}%`, background: tono(lado) }} />
        {/* **La sombra de lo que la agenda va a traer.** Sale del relleno hacia
            la meta, en el mismo carril y con la misma escala, así que si no
            llega al final del carril esa celda no cierra —y eso se ve sin leer
            ninguna cifra—. Va rayada y translúcida porque es previsión y no
            dato: confundirla con lo recogido sería peor que no dibujarla. */}
        {lado.previsto ? (
          <i
            className="es-previsto"
            style={{ width: `${lado.previsto}%`, "--aulas-previsto-tono": tono(lado) } as React.CSSProperties}
          />
        ) : null}
      </span>
    </span>
  );
}

export function AulasPiramideCuota({ filas, foco, onFoco, agenda = [], partes = [] }: {
  filas: ReadonlyArray<MonitoreoRow>;
  /** El corte enfocado; la fila enfocada se marca y filtra el detalle. */
  foco: FocoDeCuota;
  onFoco: (foco: FocoDeCuota) => void;
  /** El plan con sus fechas, para saber qué va a traer lo ya agendado. */
  agenda?: ReadonlyArray<MonitoreoRow>;
  /** Los partes de campo, que dan el rendimiento con el que se proyecta. */
  partes?: ReadonlyArray<MonitoreoRow>;
}) {
  const { facultades, izquierda, derecha, otros, tope, sinMeta } = useMemo(
    () => piramideDeCuota(filas, celdasPrevistas(proyeccionPorAgenda(agenda, partes, filas))),
    [filas, agenda, partes],
  );
  // El marginal de cada sexo: lo que falta sumando todas las facultades de ese
  // lado. Vivía en una lista de barras aparte —«Por sexo»— que repetía el mismo
  // cruce en otro formato. Se lee donde el ojo ya busca de qué lado es cada
  // columna: en el propio eje.
  const faltanPorLado = useMemo(() => {
    const suma = { izquierda: 0, derecha: 0 };
    for (const fila of facultades) {
      suma.izquierda += fila.izquierda?.faltan ?? 0;
      suma.derecha += fila.derecha?.faltan ?? 0;
    }
    return suma;
  }, [facultades]);

  if (!facultades.length || !izquierda) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {sinMeta
          ? `Las ${fmt(sinMeta)} celdas de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario."}
      </p>
    );
  }

  return (
    <div className="aulas-piramide">
      <p className="aulas-piramide-ejes">
        <span>
          {izquierda}
          <em>{faltanPorLado.izquierda ? `${fmt(faltanPorLado.izquierda)} por recoger` : "cumplida"}</em>
        </span>
        <em className="aulas-piramide-regla">cada lado contra su propia meta</em>
        <span>
          {derecha}
          <em>{faltanPorLado.derecha ? `${fmt(faltanPorLado.derecha)} por recoger` : "cumplida"}</em>
        </span>
      </p>
      {/* La leyenda del rayado va en su PROPIA línea y no en la regla del centro:
          metida ahí se partía en tres líneas dentro de una columna de 168 px,
          apretada entre las dos etiquetas de sexo. Aquí tiene el ancho del panel.

          Y sólo aparece si hay algo rayado que explicar: sin agenda por delante
          no hay sombra en ninguna barra, y una leyenda de algo que no se ve
          manda a buscar lo que no está. */}
      {facultades.some((f) => f.izquierda?.previsto || f.derecha?.previsto) ? (
        <p className="aulas-piramide-leyenda">
          <i aria-hidden="true" />
          Lo rayado es lo que traerán las aulas ya agendadas. Si no llega al final
          de su carril, esa celda no cierra con lo que hay.
        </p>
      ) : null}
      <ol className="aulas-piramide-lista" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        {facultades.map((fila) => {
          const activo = foco?.tipo === "facultad" && foco.valor === fila.facultad;
          return (
            // Botón de verdad —foco, teclado y `aria-pressed`—: el control por
            // facultad vivía en la lista que se retiró, y una capacidad no se
            // borra al reordenar la vista, se muda.
            <li key={fila.facultad}>
              <button
                type="button"
                className={`aulas-piramide-fila${activo ? " es-activa" : ""}`}
                aria-pressed={activo}
                onClick={() => onFoco(activo ? null : { tipo: "facultad", valor: fila.facultad })}
              >
                <Lado lado={fila.izquierda} tope={tope} hacia="izquierda" />
                {/* `title` como en el resto del perfil. De las 20 facultades del
                    estudio sólo se recorta una —«Ciencias y Artes de la
                    Comunicacion», 38 px de más—, pero era la única etiqueta
                    recortada de toda la sección sin forma de leerse entera. */}
                <span className="aulas-piramide-facultad" title={fila.facultad}>{fila.facultad}</span>
                <Lado lado={fila.derecha} tope={tope} hacia="derecha" />
              </button>
            </li>
          );
        })}
      </ol>
      {otros.length ? (
        // Lista cerrada con salida declarada: una pirámide tiene dos lados y un
        // tercer valor de sexo no cabe. Se dice en vez de desaparecer.
        <p className="mon-profile-muted">
          El plan declara además {otros.join(", ")}; una pirámide sólo enfrenta dos
          lados, así que esas celdas se ven en la tabla de abajo.
        </p>
      ) : null}
      {sinMeta ? (
        <p className="mon-profile-muted">
          {fmt(sinMeta)} celdas del plan no declaran objetivo y quedan fuera.
        </p>
      ) : null}
    </div>
  );
}
