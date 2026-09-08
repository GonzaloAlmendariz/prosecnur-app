import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { piramideDeCuota, type LadoDeCuota } from "./piramideDeCuota";
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
function veredicto(lado: LadoDeCuota): { texto: string; pct: string; estado: "cumplida" | "sobra" | "falta" } {
  // **Dos estados y sólo dos** (Gonzalo, 2026-09-08): «simplemente hay dos
  // estados: la meta por facultad por sexo con el largo de la barra
  // proporcional a la cantidad de estudiantes y en verde lo que ya se ha
  // conseguido; y en vez del "faltarán x" que siga "faltan x", o si se llega a
  // la meta se vuelve "sobran x"».
  //
  // Contrato anterior, citado para quien lea un diff: decía «cierra 15/09» y
  // «faltarán 160», que proyectaban con lo agendado. Era predicción, y la
  // predicción vive en otra pestaña — decía además cuánto iba a faltar sobre un
  // avance que la pantalla todavía no había calculado.
  // **Con su porcentaje** (Gonzalo, 2026-09-08: «medir el avance, están pintados
  // pero no se sabe el porcentaje de avance»). La barra enseña la proporción y
  // la cifra decía sólo el resto: quien mira una fila con 107 por recoger no
  // podía saber si eso era el 20 % o el 80 % sin medir el relleno con el ojo.
  const pct = `${Math.round(lado.avance)} %`;
  if (lado.sobran > 0) return { texto: `sobran ${fmt(lado.sobran)}`, pct, estado: "sobra" };
  if (lado.cumple) return { texto: "cumplida", pct, estado: "cumplida" };
  return { texto: `faltan ${fmt(lado.faltan)}`, pct, estado: "falta" };
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
  // **Verde lo conseguido, y sólo eso** (Gonzalo, 2026-09-08: «en verde lo que
  // ya se ha conseguido»). Tenía tres tonos —cumplida, parcial, pendiente— que
  // codificaban un estado que la cifra de al lado ya dice con palabras; el
  // color se gastaba en repetirlo en vez de en enseñar el avance.
  void lado;
  return "var(--pulso-success-fg)";
}


/** Un lado de la fila; `hacia` decide de qué borde crece la barra. */
function Lado({ lado, tope, hacia, facultad }: {
  lado: LadoDeCuota | null;
  tope: number;
  hacia: "izquierda" | "derecha";
  /** El nombre de la fila: el hover sustituye a una tabla y tiene que decir de quién habla. */
  facultad: string;
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
  // **El hover dice TODO lo que decía la tabla que se retiró.**
  //
  // Gonzalo condicionó una cosa a la otra (2026-09-08): «esta tabla ya no sería
  // necesaria si el gráfico de la pirámide tiene hovers profesionales y se
  // maneja bien mostrando todo como debería ser». La tabla FACULTAD / SEXO /
  // META / ESTADO daba cuatro columnas; aquí van las cuatro más las dos cifras
  // que la tabla no traía —lo conseguido y el porcentaje—, en una sola lectura
  // que sirve de tooltip y de etiqueta accesible. Un `title` solo no bastaba:
  // no es alcanzable por teclado y los lectores de pantalla lo tratan de forma
  // desigual, así que la misma cadena va en `aria-label`.
  //
  // Sin proyección ni fechas: la predicción salió de esta pestaña con el mismo
  // dictado.
  const estado = lado.sobran > 0
    ? `sobran ${fmt(lado.sobran)}`
    : lado.cumple ? "meta cumplida" : `faltan ${fmt(lado.faltan)}`;
  const lectura = `${facultad} · ${lado.sexo}: ${fmt(lado.observadas)} de ${fmt(lado.meta)} conseguidas · ${lado.avance} % · ${estado}`;
  return (
    <span className={`aulas-piramide-lado es-${hacia}`}>
      {/* **Un hover de verdad, no el `title` del navegador** (Gonzalo,
          2026-09-08: «faltan hovers profesionales»). El `title` nativo tarda un
          segundo largo en salir, no se puede estilar, se corta a capricho del
          sistema y no aparece nunca al navegar con teclado. Este sale al
          instante, con la tipografía de la casa, y responde también a `:focus`
          del botón de la fila. La lectura es la misma cadena que va al
          `aria-label`: una sola redacción para el ojo y para el oído. */}
      <span className="aulas-piramide-tip" role="tooltip">{lectura}</span>
      <span className={`aulas-piramide-cifra es-${v.estado}`}>
        {v.texto}
        <em className="aulas-piramide-pct">{v.pct}</em>
      </span>
      {/* La PISTA es la escala; el carril es el dato. Estaban fundidos en un
          solo elemento: el carril llevaba `width: ${carril}%` siendo hijo
          directo del lado, y un porcentaje en un hijo flex se resuelve contra
          el contenedor ENTERO, no contra lo que sobra tras la cifra. La fila
          con la meta más alta llega al 100 % y se salía 11 px por debajo de su
          vecina —medido a 1440x1000 sobre el fixture de aulas—. Con la pista,
          el 100 % es el ancho de la pista y no puede desbordar. */}
      <span className="aulas-piramide-pista">
      <span className="aulas-piramide-carril" style={{ width: `${carril}%` }}
        role="img" aria-label={lectura}>
        <i style={{ width: `${relleno}%`, background: tono(lado) }} />
        {/* Aquí iba «la sombra de lo que la agenda va a traer», rayada sobre
            el carril. Salió el 2026-09-08 con el resto de la predicción:
            «lo nada que tenga que ver con predicción porque eso le pertenece a
            otra pestaña». La barra enseña dos cosas y nada más: lo conseguido
            y lo que falta. */}
      </span>
      </span>
    </span>
  );
}

export function AulasPiramideCuota({ filas, foco, onFoco }: {
  filas: ReadonlyArray<MonitoreoRow>;
  /** El corte enfocado; la fila enfocada se marca y filtra el detalle. */
  foco: FocoDeCuota;
  onFoco: (foco: FocoDeCuota) => void;
}) {
  const { facultades, izquierda, derecha, otros, tope, sinMeta } = useMemo(
    // Sin previsiones: la pirámide dejó de proyectar el 2026-09-08 y pasarle
    // la agenda sólo costaba el cálculo.
    () => piramideDeCuota(filas),
    [filas],
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
      // **La causa se dice UNA vez, arriba.** `AulasCuotasResumen` encabeza la
      // sección y ya explica por qué no hay cuotas; verlo en la app dejó claro
      // que aquí se repetía literal —la misma frase salía tres veces en la
      // misma pantalla, más dos KPIs en «S/D» diciendo lo mismo—. Repetir la
      // causa no informa, tapa. Esta pieza declara su propio vacío en SUS
      // términos: una pirámide compara dos lados, y sin celdas no hay nada que
      // enfrentar.
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {sinMeta
          ? `Los ${fmt(sinMeta)} grupos de cuota del plan no declaran objetivo.`
          : "Sin grupos que enfrentar."}
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
                <Lado lado={fila.izquierda} tope={tope} hacia="izquierda" facultad={fila.facultad} />
                {/* `title` como en el resto del perfil. De las 20 facultades del
                    estudio sólo se recorta una —«Ciencias y Artes de la
                    Comunicacion», 38 px de más—, pero era la única etiqueta
                    recortada de toda la sección sin forma de leerse entera. */}
                <span className="aulas-piramide-facultad" title={fila.facultad}>{fila.facultad}</span>
                <Lado lado={fila.derecha} tope={tope} hacia="derecha" facultad={fila.facultad} />
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
          lados, así que esos grupos se ven en la tabla de abajo.
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
