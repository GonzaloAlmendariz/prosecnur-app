import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { cuotasResumen, type CorteDeCuota } from "./cuotasResumen";
import { fmt } from "./kpisDeAulas";

/**
 * Cuántos GRUPOS de cuota han cerrado, y el aviso de las filas que los arman.
 *
 * Nació publicando la cuota del estudio en personas —«el tablero decía "2/12
 * celdas" y eso no contesta la pregunta del operativo: doce celdas pueden estar
 * a una respuesta o a doscientas»— y esa lectura se ganó su sitio. Pero para el
 * 2026-09-08 la misma pareja «494 de 2 500 · 19,8 %» salía TRES veces en la
 * pantalla de Metas: la banda de KPIs, «Cumplimiento de la cuota del estudio» y
 * esto. Se quedó con lo único que aporta y nadie más dice: cuántos de los grupos
 * de cuota —el cruce facultad × sexo— han cerrado.
 *
 * El aviso de las filas sigue aquí y sigue yendo PRIMERO: quien ve un cero deja
 * de leer.
 */

/* **La barra del total se retiró el 2026-09-08.** Publicaba «494 de 2 500
   personas · 19,8 %», que en la misma pantalla ya decían la banda de siete KPIs
   —arriba, en las seis pestañas— y la barra de «Cumplimiento de la cuota del
   estudio», dos paneles más arriba. Tres veces la misma pareja de cifras.

   Lo que este bloque aporta y no dice nadie más es el estado de los GRUPOS
   —el cruce facultad × sexo—: cuántos han cerrado su cuota. Eso se queda, y con
   ello el aviso de las filas, que también es suyo. */

/**
 * La entidad enfocada dentro de la sección.
 *
 * `facultad` y `sexo` acotan lo que se ve; **`aula` no acota nada: abre la ficha
 * de ese curso-horario**. Comparten parámetro porque la gramática declara `foco`
 * para la entidad seleccionada y no hay una sexta dimensión que inventar, y el
 * prefijo evita la ambigüedad de un valor suelto. Los consumidores que sólo
 * miran `facultad` siguen ignorando el resto, que es como estaba escrito.
 */
export type FocoDeCuota = { tipo: "facultad" | "sexo" | "aula"; valor: string } | null;

/** Serializa el foco para la URL: `facultad:Derecho`, `sexo:F`, `aula:CH 31`. */
export function focoDesdeTexto(bruto: string | null): FocoDeCuota {
  const [tipo, ...resto] = (bruto ?? "").split(":");
  const valor = resto.join(":").trim();
  if (!valor || (tipo !== "facultad" && tipo !== "sexo" && tipo !== "aula")) return null;
  return { tipo, valor };
}

export function textoDesdeFoco(foco: FocoDeCuota) {
  return foco ? `${foco.tipo}:${foco.valor}` : "";
}

/**
 * **Por qué las celdas están en cero, cuando el motor sabe por qué.**
 *
 * `monitoreo_aulas_avance_cuota.R:518` detecta el caso en que la columna de
 * sexo existe y ninguno de sus valores se reconoce —una base de Kobo sin
 * decodificar trae el NOMBRE de la opción del XLSForm, y el instrumento de
 * HSVG2026 usa `1` = Mujer y `2` = Hombre—, y publica la causa con los valores
 * que llegaron. Deliberadamente no adivina que `1` es mujer: otro estudio puede
 * numerarlo al revés y eso sería inventar el dato.
 *
 * Ese aviso viajaba en la columna `warning` de todas las filas y la UI lo
 * pintaba sólo como una columna más de la tabla, rotulada «Advertencia» y
 * repetida treinta veces. Aquí es donde se lee el cero —«0 de 30 celdas
 * cumplidas» sobre mil quinientas respuestas ya atribuidas a su aula—, así que
 * aquí es donde tiene que estar la causa. Es la misma regla del `collectorID`:
 * un aviso dice la causa, no sólo el hecho.
 */
function avisoDeLasFilas(filas: ReadonlyArray<MonitoreoRow>): string {
  for (const fila of filas) {
    const w = typeof fila.warning === "string" ? fila.warning.trim() : "";
    if (w) return w;
  }
  return "";
}

export function AulasCuotasResumen({ filas }: { filas: ReadonlyArray<MonitoreoRow> }) {
  const { general, sinMeta } = useMemo(() => cuotasResumen(filas), [filas]);
  const aviso = useMemo(() => avisoDeLasFilas(filas), [filas]);

  if (!general.celdas) {
    return (
      <p className="mon-profile-muted">
        {aviso || (sinMeta
          ? `Los ${fmt(sinMeta)} grupos de cuota del plan no declaran objetivo.`
          : "El plan no declara composición por sexo para estos cursos-horario.")}
      </p>
    );
  }

  return (
    <div className="aulas-cuotas-resumen">
      {/* Antes de las cifras, no después: quien ve un cero deja de leer. */}
      {aviso ? <p className="aulas-cuota-aviso">{aviso}</p> : null}
      <p className="aulas-cuota-lectura">
        <strong>{general.celdasCumplidas}</strong> de{" "}
        <strong>{general.celdas}</strong> grupos con su cuota cumplida
        {sinMeta ? ` · ${sinMeta} sin objetivo declarado` : ""}
      </p>

      {/* La lista «Por facultad» se retiró: decía exactamente lo que la pirámide
          —las mismas seis facultades con el mismo desglose «F 230 · M 97»— y en
          la forma peor de las dos, porque separa los dos sexos de una facultad
          en vez de enfrentarlos. Dos gráficos del mismo cruce le quitaban el
          protagonismo justo al que contesta la pregunta. El foco por facultad se
          mudó a la pirámide, que ahora es quien lo controla.

          «Por sexo» tampoco vive aquí: es el marginal de los dos lados, y donde
          se lee es en el eje de la propia pirámide. */}
    </div>
  );
}
