import { useMemo } from "react";

import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";
import { NombreDeFacultad } from "./NombreDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt, pctPerfil } from "./kpisDeAulas";
import "./efectividadSeguimiento.css";

/**
 * La τ del diseño contra la del campo (ADR 0082).
 *
 * **Qué es τ.** El dimensionamiento compra aforo con `⌈cuota / (p25 × τ)⌉`. Esa
 * τ no es una constante de la app: cada facultad tiene la suya, compuesta como
 * `mix_de_tamaños × factor_residual`, y los quince valores de HSVG2026 —de
 * 0,409 en EE.GG. Ciencias a 0,800 en Letras— salen del campo 2025 y de ningún
 * otro sitio.
 *
 * **Por qué esta pantalla existe.** El módulo de certeza declara, literal, que
 * NO cubre la incertidumbre de τ, y esa exención no tenía destinatario: el
 * tablero contaba aulas aplicadas y encuestas conseguidas, nunca la tasa que
 * las liga. Medido: con τ un 5 % por debajo, EE.GG. Ciencias cierra 4,1 alumnos
 * corta. Y el riesgo no es el que el operativo teme —en 2025 sólo 2 de 196
 * aulas no se aplicaron—: es que baje la asistencia general, que hasta hoy no
 * disparaba nada.
 *
 * **Qué NO es esta pantalla.** No es cumplimiento: la brecha contra la cuota
 * vive en el bloque de cuotas y tiene otro denominador. Lo de aquí son los
 * alumnos ATRIBUIBLES A τ —lo que se pierde porque las aulas rinden distinto de
 * lo supuesto— sobre las aulas que ya se aplicaron.
 *
 * **Y no recalcula nada.** Tasas, bandas, déficits y reservas los publica el
 * motor: si la vista los recompusiera, dos superficies del mismo número
 * acabarían discrepando, que es cómo nacieron las tres tasas homónimas que este
 * ADR vino a separar.
 */

/**
 * Lo que una facultad tiene a mano, nombrando cada fuente.
 *
 * «0 libres» era falso en veinte facultades de la fixture: tenían banco. Y la
 * concordancia importa —«1 libres» se leyó en pantalla— porque una cifra mal
 * concordada delata que nadie miró la fila con un solo elemento.
 */
function disponibles(f: MonitoreoAulasEfectividadFacultad): string {
  const partes: string[] = [];
  if (f.reservas_libres > 0) partes.push(`${fmt(f.reservas_libres)} en cadena`);
  if (f.banco_disponible > 0) partes.push(`${fmt(f.banco_disponible)} de banco`);
  if (!partes.length) return "sin reservas";
  return partes.join(" · ");
}

/**
 * Cuántas reservas hay que activar, concordando con la cifra.
 *
 * **Es la misma reparación que `disponibles()` ya lleva escrita arriba** —«1
 * libres» se leyó en pantalla y por eso ese helper existe—, y esta rama se
 * quedó fuera: publicaba «hacen falta 1 de 118», visto a 1440 en ESTUDIOS
 * GENERALES CIENCIAS. Una cifra mal concordada delata que nadie miró la fila
 * con un solo elemento, que es justo la fila más fácil de cerrar.
 */
function faltan(necesarias: number, aMano: number): string {
  return necesarias === 1
    ? `hace falta 1 de ${fmt(aMano)}`
    : `hacen falta ${fmt(necesarias)} de ${fmt(aMano)}`;
}

/**
 * Cuando activar TODO lo que queda todavía no cierra.
 *
 * Este caso caía en `disponibles()`, que lista los recursos sin decir que no
 * bastan: la fila mostraba «49 en cadena» y quien la leía entendía que estaba
 * cubierta. Es el momento en que hay que escalar por encima de los reemplazos
 * —pedir aulas fuera del marco, mover cuota entre facultades, alargar campo— y
 * era justo el que la pantalla no nombraba.
 *
 * Se dice la causa además del hecho: cuántas hay, y cuántos quedarían igual.
 */
function noAlcanzan(f: MonitoreoAulasEfectividadFacultad): string {
  const aMano = f.reservas_libres + f.banco_disponible;
  const resto = f.sin_cubrir != null && Number.isFinite(f.sin_cubrir) ? Math.round(f.sin_cubrir) : null;
  if (aMano === 0) return "sin respaldo que activar";
  const cola = resto != null && resto > 0 ? `: quedarían ${fmt(resto)}` : "";
  return `no alcanzan las ${fmt(aMano)} que quedan${cola}`;
}

const p1 = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * Alumnos, en PERSONAS ENTERAS y siempre por el lado cauto.
 *
 * Gonzalo: «en términos numéricos no podemos estar 3.4 alumnos por encima». No
 * existe medio alumno encuestado, y es la misma regla que ya rige el ranking de
 * rendimiento (`personasPorAula`): hacia abajo siempre, incluso desde 3,9.
 *
 * Con signo hay que decidir en los DOS sentidos, y la cautela cambia de lado:
 *
 * - **Sobra +3,4 → «+3»**: se promete de menos, nunca de más.
 * - **Falta −22,4 → «−23»**: el faltante se redondea hacia arriba en
 *   magnitud. Decir que faltan 22 cuando faltan 22,4 es prometer que se cierra
 *   con menos de lo que hace falta, que es el error caro en una pantalla que
 *   decide si se activan reservas.
 */
const alumnos = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = n < 0 ? Math.ceil(Math.abs(n)) : Math.floor(n);
  if (v === 0) return "0";
  return `${n < 0 ? "−" : "+"}${v.toLocaleString("es-PE")}`;
};

/** El margen de error en puntos porcentuales, entero. `null` si no hay banda. */
const margenError = (f: MonitoreoAulasEfectividadFacultad): string | null => {
  if (f.banda_bajo == null || f.banda_alto == null) return null;
  const pts = Math.round(((f.banda_alto - f.banda_bajo) / 2) * 100);
  return pts > 0 ? `± ${pts}` : null;
};

/**
 * Lo que hay que hacer con esta facultad, en una frase.
 *
 * La regla de la señal vive en el motor; aquí sólo se traduce. Ninguna rama
 * inventa un veredicto que el bloque no haya declarado: `conforme` y
 * `sin_banda` dicen por qué NO se actúa, que es tan informativo como el rojo —y
 * es lo que impide que alguien lea un silencio como un visto bueno.
 */
function lectura(f: MonitoreoAulasEfectividadFacultad): string {
  // Primero el MARGEN, que es lo que decide. El veredicto de la banda se añade
  // detrás porque explica el porqué, no porque mande.
  if (f.riesgo === "sin_campo") return "Todavía no tiene cursos-horario aplicados: no hay tasa con la que proyectar.";
  if (f.riesgo === "sin_cuota") return "El diseño no le trazó cuota: no hay margen que medir.";
  if (f.riesgo === "sin_cumplimiento") return "No se pudo leer lo conseguido de esta facultad.";

  const falta = f.margen_restante != null && f.margen_restante < 0 ? Math.round(Math.abs(f.margen_restante)) : 0;
  const porque = f.senal === "bajo" ? " Rinde por debajo de la tasa prevista para su facultad."
    : f.senal === "sobre" ? " Rinde por encima de la tasa prevista para su facultad."
    : "";

  if (f.riesgo === "holgado") return `Su proyección cierra la cuota con margen.${porque}`;
  if (f.riesgo === "ajustado") return `Cierra la cuota, pero sin margen para que el rendimiento baje.${porque}`;

  const firme = f.riesgo === "riesgo_firme"
    ? "No cierra la cuota ni en el mejor escenario del dato"
    : "Su proyección no cierra la cuota";
  const aMano = f.reservas_libres + f.banco_disponible;
  if (aMano === 0) return `${firme}: faltan ${fmt(falta)} y no le queda ningún curso-horario de respaldo.`;
  if (f.reservas_alcanzan && f.reservas_necesarias != null) {
    const de = f.reservas_de_banco > 0 && f.reservas_de_cadena > 0
      ? ` (${fmt(f.reservas_de_cadena)} de cadena y ${fmt(f.reservas_de_banco)} de banco)`
      : f.reservas_de_banco > 0 ? " del banco" : " de su cadena";
    // Concuerdan las DOS cifras, no sólo la primera. La frase salía «1 aula
    // cierra de su cadena los 1 que faltan»: nadie lo había visto porque la
    // función estaba muerta. Y el sujeto va junto a su origen —«14 aulas de su
    // cadena cierran…»—, que es como se dice.
    const sujeto = f.reservas_necesarias === 1 ? "curso-horario" : "cursos-horario";
    const verbo = f.reservas_necesarias === 1 ? "cierra" : "cierran";
    const objeto = falta === 1 ? "el 1 que falta" : `los ${fmt(falta)} que faltan`;
    return `${firme}: ${fmt(f.reservas_necesarias)} ${sujeto}${de} ${verbo} ${objeto}.`;
  }
  const resto = f.sin_cubrir != null && Number.isFinite(f.sin_cubrir) ? Math.round(f.sin_cubrir) : null;
  return `${firme}: ni activando las ${fmt(aMano)} que le quedan se cierran los ${fmt(falta)}${resto ? `, quedarían ${fmt(resto)}` : ""}.`;
}


/**
 * Una tasa, dicha como la lee alguien que no es del equipo.
 *
 * τ es 0,693. **«0.693» no significa nada para quien no diseñó la muestra**, y
 * la pantalla es para el jefe de campo tanto como para el analista. Un
 * porcentaje sí: «69,3 %» de los que estaban en el aula respondieron.
 */
/** El porcentaje de la casa. Era otra copia del cuerpo de `pctPerfil()`: la
 *  tercera del perfil, y su propio docstring ya avisaba de que dos sitios
 *  formateando lo mismo acaban separándose. */
const pct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : pctPerfil(n * 100);

/**
 * Los alumnos que faltan EN TOTAL, con la misma regla cauta que cada fila.
 *
 * La cabecera decía «528 alumnos en riesgo» y la columna «Alumnos» de esas doce
 * facultades sumaba **535**. Ninguno de los dos estaba mal: el motor suma los
 * déficits crudos (`round(sum(...), 1)` en
 * `monitoreo_aulas_efectividad_seguimiento.R:562`) y cada fila los redondea
 * HACIA ARRIBA en magnitud, a propósito —«decir que faltan 22 cuando faltan
 * 22,4 es prometer que se cierra con menos de lo que hace falta»—. Doce filas
 * redondeando hacia arriba explican los siete de diferencia.
 *
 * Pero quien suma la columna encuentra el hueco y desconfía de las dos cifras.
 * Y el argumento que justifica el redondeo por fila vale igual para el total:
 * como cada facultad hay que cubrirla por separado (ADR 0079, que es lo que ya
 * hace el motor al sumar sólo las que están en riesgo), lo que de verdad hace
 * falta es la suma de los techos, no el techo de la suma.
 *
 * Se calcula sobre las MISMAS filas que se pintan: no es una segunda lectura
 * del dato, es la única, con su regla de presentación aplicada una sola vez.
 */
export function alumnosQueFaltanEnTotal(
  filas: ReadonlyArray<{ riesgo?: string | null; margen_restante?: number | null }>,
): number {
  let total = 0;
  for (const f of filas) {
    if (f.riesgo !== "riesgo" && f.riesgo !== "riesgo_firme") continue;
    const v = f.margen_restante;
    if (v == null || !Number.isFinite(v) || v >= 0) continue;
    total += Math.ceil(-v);
  }
  return total;
}

/**
 * El veredicto en PALABRAS, además de en color.
 *
 * El estado se transmitía sólo por el borde de color de la fila. Quien no
 * distingue rojo de verde —o mira la pantalla proyectada, o la imprime— no
 * recibía el dato principal. Es también lo que permite que la tabla se entienda
 * sin leer el pie.
 */
const VEREDICTO: Record<string, { texto: string; tono: "riesgo" | "aviso" | "ok" | "neutro" }> = {
  riesgo_firme: { texto: "No cierra", tono: "riesgo" },
  // `riesgo` y `riesgo_firme` decían los dos «No cierra», y son decisiones
  // distintas: en el simulacro de campo malo, Artes Escénicas es `riesgo` con
  // 1 alumno de déficit y Ciencias e Ingeniería `riesgo_firme` con 188, bajo la
  // misma insignia roja. `riesgo_firme` es «no cierra ni en el mejor escenario
  // del dato»; `riesgo` es «la proyección central no cierra, pero la banda
  // todavía alcanza». Una escalera de cuatro peldaños —Cubierta · Justo ·
  // Puede no cerrar · No cierra— dice cuánto correr; una de tres, no.
  riesgo: { texto: "Puede no cerrar", tono: "aviso" },
  // «Justa» y no «Justo»: el sujeto de la escalera es la facultad de la fila, y
  // el peldaño de al lado ya concuerda en femenino —«Cubierta»—. Un adjetivo en
  // masculino entre dos femeninos hace dudar de a qué se refiere.
  ajustado: { texto: "Justa", tono: "aviso" },
  holgado: { texto: "Cubierta", tono: "ok" },
  sin_campo: { texto: "Sin campo", tono: "neutro" },
  sin_cuota: { texto: "Sin cuota", tono: "neutro" },
  sin_cumplimiento: { texto: "Sin dato", tono: "neutro" },
};

/**
 * La lectura de la banda para quien no la ve.
 *
 * La barra sólo tenía `title`, así que su contenido —el dato principal de la
 * fila— no existía para un lector de pantalla ni para quien navega con teclado.
 */
function bandaEnPalabras(f: MonitoreoAulasEfectividadFacultad): string {
  if (f.tau_previsto == null) return "El diseño no supuso una tasa de facultad para esta.";
  const esperado = `La tasa prevista es ${pct(f.tau_previsto)}`;
  if (f.tau_observado == null) return `${esperado}; todavía sin cursos-horario aplicados.`;
  if (f.banda_bajo == null || f.banda_alto == null) {
    return `${esperado} y la observada ${pct(f.tau_observado)}, con un solo curso-horario: todavía no se puede afirmar una diferencia.`;
  }
  const rel = f.senal === "bajo" ? "por debajo de lo previsto"
    : f.senal === "sobre" ? "por encima de lo previsto"
    : "dentro de lo previsto";
  return `${esperado} y la observada ${pct(f.tau_observado)}, entre ${pct(f.banda_bajo)} y ${pct(f.banda_alto)}: ${rel}.`;
}

export function AulasEfectividadSeguimiento({
  bloque, facultadEnFoco, onFoco,
}: {
  bloque: MonitoreoAulasEfectividadSeguimiento | null | undefined;
  /** Resalta, no filtra: igual que el resto de listas del perfil. */
  facultadEnFoco?: string;
  onFoco?: (foco: FocoDeCuota) => void;
}) {
  const filas = useMemo(
    () => (bloque?.facultades ?? []).filter((f) => f.tau_previsto != null || f.aulas_aplicadas > 0),
    [bloque],
  );
  /**
   * Si NINGUNA facultad trae tasa prevista, media pantalla habla de algo que no
   * existe: la vara de «dónde se esperaba llegar» sólo se dibuja por fila
   * cuando `tau_previsto != null`, así que con el estudio de HSVG2026 —que no
   * publica metas del diseño— la leyenda anunciaba una marca que no aparece en
   * ninguna de las quince barras, y la frase de cabecera decía literalmente
   * «suponía que respondería el — de los alumnos», con el guion metido dentro
   * de la oración.
   *
   * Un vacío se declara; no se incrusta en una frase. El motivo ya está dicho
   * en el sello de abajo («el estudio importado no publica metas del diseño»),
   * así que aquí sólo hay que dejar de prometer.
   */
  const hayPrevisto = filas.some((f) => Number.isFinite(f.tau_previsto));


  // C3: el vacío es SUYO y dice cuál de los dos vacíos es. «Sin diseño» y «sin
  // campo» se arreglan de maneras distintas, y un mensaje único obligaría a
  // adivinar cuál toca.
  if (!bloque) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        El estudio todavía no publica el seguimiento de efectividad.
      </p>
    );
  }
  if (!filas.length) {
    return (
      <p className="mon-profile-muted" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
        {bloque.vigencia === "sin_diseno"
          ? "El estudio importado no trae la tasa de efectividad que dimensionó los cursos-horario, así que no hay vara contra la que medir el campo."
          : "Todavía no hay cursos-horario aplicados: la tasa que rinde el campo se puede empezar a medir con el primero."}
      </p>
    );
  }

  const t = bloque.total;
  // LA ESCALA ES 0–100 %, FIJA.
  //
  // Antes la barra era un segmento flotante sobre una escala recortada al
  // máximo observado. Gonzalo, mirándola: «la barra no debería ser de 0 al
  // 100 % con el tick en lo previsto y llenando de izquierda a derecha con la
  // tasa actual… ahora está pintando medio raro». Tenía razón: un segmento que
  // flota sobre una escala sin extremos conocidos no se puede leer —no hay
  // forma de saber qué es «lleno»— y obliga a decodificarlo con la leyenda.
  //
  // Con relleno desde la izquierda, la lectura es inmediata y no necesita
  // explicación: la barra llega o no llega a la marca.
  const pos = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%`;

  return (
    <div className="aulas-tau" data-qa-geometry-capacity="owned" data-qa-geometry-member="true">
      {/* C1: la superficie declara qué mide ANTES de la primera cifra. Sin esto,
          dos porcentajes juntos son dos números sin pregunta. */}
      <p className="aulas-tau-cabeza">
        <span>
          {/* Dos correcciones que costaron dos capturas, y las dos son trampas
              ya conocidas de esta casa:
              1. Esta frase habla del AGREGADO, así que se decide con
                 `t.tau_previsto` y no con el flag de las FILAS.
              2. Y con `Number.isFinite`, NO con `!= null`: el `pct` local de
                 este archivo (línea ~159) escribe «—» cuando el valor no es
                 finito, y `NaN != null` es `true`. Preguntar por `null` deja
                 pasar el `NaN` y la frase sigue con el guion dentro. Es el mismo
                 `Number(null) === 0` de siempre. */}
          {Number.isFinite(t.tau_previsto) ? (
            <>
              En los {fmt(t.aulas_aplicadas)} cursos-horario ya aplicados, la <strong>tasa de la
              facultad</strong> suponía que respondería el <strong>{pct(t.tau_previsto)}</strong>{" "}
              de los alumnos. Está respondiendo el <strong>{pct(t.tau_observado)}</strong>.
            </>
          ) : (
            <>
              En los {fmt(t.aulas_aplicadas)} cursos-horario ya aplicados está respondiendo el{" "}
              <strong>{pct(t.tau_observado)}</strong> de los alumnos. El estudio no
              declara la tasa con la que se dimensionó, así que no hay contra qué
              compararlo.
            </>
          )}
        </span>
        {t.facultades_en_riesgo > 0 ? (
          <span>
            <strong>{fmt(alumnosQueFaltanEnTotal(filas))}</strong> alumnos en riesgo en{" "}
            {fmt(t.facultades_en_riesgo)} {t.facultades_en_riesgo === 1 ? "facultad" : "facultades"}.
          </span>
        ) : (
          <span>Ninguna facultad se queda corta de su cuota con lo que va rindiendo.</span>
        )}
        {/* Los dos conteos son distintos a propósito: se puede rendir bajo lo
            previsto y cerrar igual, porque el diseño compró colchón. */}
        {t.facultades_bajo_su_tau > 0 ? (
          <span className="aulas-tau-sello">
            {fmt(t.facultades_bajo_su_tau)}{" "}
            {t.facultades_bajo_su_tau === 1 ? "rinde" : "rinden"} por debajo de lo previsto
          </span>
        ) : null}
        <span className="aulas-tau-sello">
          se cuenta la respuesta que llegó a la plataforma y pasó los filtros
          {bloque.vigencia !== "vigente" && bloque.motivo ? ` · ${bloque.motivo}` : ""}
        </span>
      </p>

      {/* La leyenda es VISUAL y va junto a la tabla, no en prosa al pie: quien
          mira la barra tiene que poder decodificarla ahí mismo. */}
      <p className="aulas-tau-leyenda">
        {/* La vara sólo se lista si alguna fila la dibuja: una leyenda que
            describe una marca ausente manda a buscarla por quince barras. */}
        {hayPrevisto ? (
          <span><i className="aulas-tau-muestra-vara" aria-hidden="true" /> Dónde se esperaba llegar</span>
        ) : null}
        <span><i className="aulas-tau-muestra-banda" aria-hidden="true" /> Hasta dónde va, de 0 a 100 %</span>
      </p>

      {/* Es una TABLA de datos y va como tabla: el encabezado anterior era un
          `li` con `aria-hidden`, así que un lector de pantalla recibía cinco
          columnas de números sin un solo nombre. */}
      <div className="aulas-tau-marco">
        <table className="aulas-tau-tabla">
          <caption className="aulas-tau-caption">
            Cuánto responde cada facultad frente a lo que el diseño supuso, y si su cuota cierra
          </caption>
          <thead>
            <tr>
              {/* Las DOS tasas, cada una con su columna y su número. Antes sólo
                  se leía la observada y lo esperado era una marca en la barra:
                  Gonzalo, «no se sabe cuánta es la efectividad esperada y cuál
                  es la efectividad que va ahora». Una barra ilustra una
                  comparación; no la sustituye. */}
              <th scope="col">Facultad</th>
              <th scope="col" className="es-num">Tasa prevista</th>
              <th scope="col" className="es-num">Tasa observada</th>
              <th scope="col">Comparación</th>
              {/* **Dos columnas de alumnos, porque son dos preguntas.**
                  Gonzalo, 2026-09-10: «me sorprende que en Alumnos todos sean
                  positivos cuando tenemos facultades con tasas menores en
                  observadas; ¿no deberíamos tener déficit de efectivas allí?».
                  Tenía razón en la sorpresa: la columna decía «Alumnos» y
                  publicaba el margen PROYECTADO sobre la cuota —Artes Escénicas,
                  +58— mientras esa misma facultad lleva diez respuestas MENOS de
                  las que su tasa prevista pedía. Las dos cifras son ciertas y el
                  rótulo sólo nombraba una. */}
              <th scope="col" className="es-num" title="Respuestas de más o de menos frente a lo que la tasa prevista pedía en los cursos-horario ya aplicados.">
                Hasta ahora
              </th>
              <th scope="col" className="es-num" title="Alumnos que van a sobrar o a faltar para la cuota, contando con que lo que queda por aplicar responda igual que lo aplicado.">
                Al cerrar
              </th>
              <th scope="col">Si hace falta más</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const enFoco = f.facultad === facultadEnFoco;
              // Pinta el RIESGO del margen, no la señal de la banda: rendir por
              // debajo y cerrar igual es el caso normal.
              const enRiesgo = f.riesgo === "riesgo" || f.riesgo === "riesgo_firme";
              const v = VEREDICTO[f.riesgo] ?? VEREDICTO.sin_cumplimiento;
              const clases = [
                enRiesgo ? "es-bajo" : f.riesgo === "holgado" && f.senal === "sobre" ? "es-sobre" : "",
                enFoco ? "es-en-foco" : "",
              ].filter(Boolean).join(" ");
              return (
                <tr key={f.faculty_key} className={clases || undefined}>
                  <th scope="row" className="aulas-tau-nombre-celda">
                    {/* El veredicto en palabra Y en color: quien no distingue
                        los tonos recibe el dato igual. */}
                    {/* `lectura()` producía la frase que dice QUÉ HACER y no se
                        llamaba desde ningún sitio: estaba escrita, probada por
                        nadie y muerta. Va en la insignia, que es donde se mira
                        cuando la palabra sola no basta. */}
                    <span className={`aulas-tau-chip es-${v.tono}`} title={lectura(f)}>{v.texto}</span>
                    <NombreDeFacultad facultad={f.facultad} className="aulas-tau-nombre"
                      enFoco={enFoco}>
                      {f.facultad}
                      <em>
                        {fmt(f.aulas_aplicadas)} {f.aulas_aplicadas === 1 ? "curso-horario aplicado" : "cursos-horario aplicados"} ·{" "}
                        {fmt(f.efectivas)} de {fmt(f.elegibles_aplicados)} alumnos
                        {f.residual_base === "sin_base" ? " · sin base histórica propia" : ""}
                      </em>
                    </NombreDeFacultad>
                  </th>
                  <td className="aulas-tau-cifra es-debil">{pct(f.tau_previsto)}</td>
                  <td className={`aulas-tau-cifra${f.senal === "sin_banda" ? " es-debil" : ""}`}>
                    {pct(f.tau_observado)}
                    {/* El margen de error, en número y no como un bigote sobre
                        la barra: ahí estaba feo y no se sabía qué medía. */}
                    {margenError(f) ? <em className="aulas-tau-error">{margenError(f)} pts</em> : null}
                  </td>
                  <td>
                    <span className="aulas-tau-pista" role="img" aria-label={bandaEnPalabras(f)}>
                      {/* El RELLENO, desde 0 hasta lo que se viene rindiendo.
                          Verde si llega o pasa la marca, rojo si se queda
                          corto: la lectura es «llega o no llega». */}
                      {f.tau_observado != null ? (
                        <span
                          className={`aulas-tau-relleno${
                            f.tau_previsto == null ? ""
                              : f.tau_observado >= f.tau_previsto ? " es-mejor" : " es-peor"}`}
                          style={{ width: pos(f.tau_observado) }}
                        />
                      ) : null}
                      {/* LA MARCA: lo que el diseño supuso. Es la vara. */}
                      {/* `isFinite` y no `!= null`: con `NaN` la vara se pinta
                          en `left: NaN%`, que el navegador descarta, así que la
                          leyenda prometía una marca invisible. */}
                      {f.tau_previsto != null && Number.isFinite(f.tau_previsto) ? (
                        <span className="aulas-tau-vara" style={{ left: pos(f.tau_previsto) }} />
                      ) : null}
                    </span>
                  </td>
                  {/* La unidad va en la celda, no sólo en el encabezado: «−22,4»
                      solo no dice de qué. */}
                  {/* **Lo de HOY**: el déficit o el superávit de respuestas
                      contra lo que la tasa prevista pedía en lo ya aplicado. Es
                      `alumnos_corte`, que el motor calcula desde siempre y esta
                      tabla no enseñaba. */}
                  <td className={`aulas-tau-cifra${
                    f.alumnos_corte != null && f.alumnos_corte < 0 ? " es-corto" : " es-debil"
                  }`}>
                    {alumnos(f.alumnos_corte)}
                  </td>
                  <td className={`aulas-tau-cifra${enRiesgo ? "" : " es-debil"}`}>
                    {alumnos(f.margen_restante)}
                  </td>
                  {/* Texto, no cifra: alineado a la izquierda como su
                      encabezado. Iba con `aulas-tau-cifra`, que lo pegaba a la
                      derecha bajo un encabezado alineado a la izquierda. */}
                  <td className="aulas-tau-respaldo">
                    {enRiesgo && f.reservas_alcanzan && f.reservas_necesarias != null
                      ? faltan(f.reservas_necesarias, f.reservas_libres + f.banco_disponible)
                      : enRiesgo && !f.reservas_alcanzan
                        ? noAlcanzan(f)
                        : disponibles(f)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="aulas-tau-pie">
        <strong>Hasta ahora</strong> son las respuestas de más o de menos frente a lo que la tasa
        prevista pedía en los cursos-horario ya aplicados: ahí es donde se ve que una facultad está
        rindiendo por debajo.{" "}
        <strong>Al cerrar</strong> son las que van a sobrar o a faltar para su cuota, contando que los
        cursos-horario que quedan por aplicar respondan igual que los de hasta ahora. Las dos pueden tener
        signos distintos y no es una contradicción: el diseño compró cursos-horario de más, así que una
        facultad puede ir corta de rendimiento y llegar a su cuota igual.{" "}
        <strong>± pts</strong> es cuánto puede moverse todavía el porcentaje con los cursos-horario que lleva:
        cuantos menos cursos-horario, más grande.
      </p>
    </div>
  );
}
