import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ChipDato, ChipHora, ChipLugar } from "./AulasSistemaPabellon";
import {
  candidatosDeReemplazo,
  type BrechaPorSexo,
  type CandidatoDeReemplazo,
  type OrigenDeCandidato,
} from "./candidatosDeReemplazo";
import { etiquetaDeFecha } from "./agendaPorDia";
import { composicionDelAula } from "./composicionDelAula";
import { pronosticoDelAula } from "./pronosticoDelAula";
import { facultadCorta } from "./facultadEnPalabras";
import { fmt, pctPerfil } from "./kpisDeAulas";

/**
 * A quién ir cuando un aula no sale.
 *
 * Diseño de Gonzalo: «un popover bien elegante: mira, estas son las de los
 * reemplazos disponibles […] si te vas por los reemplazos, este es el mejor y
 * este es el otro. Y hay un botón abajo de cambiar a pool o cambiar a aulas
 * extra […] Y que te diga bien el nombre, cómo se llama el curso, el aula, que
 * te dé todo eso, porque eso también es importante para tomar una decisión.
 * Incluso te puede dar como un top tres de las mejores.»
 *
 * Tres decisiones que el componente toma y conviene que se lean:
 *
 * **La cadena va primero y en su propio orden.** No se reordena por puntuación:
 * el reemplazo 1 es el reemplazo 1, porque la cadena es la guía del
 * procedimiento. La puntuación se enseña igual, para que se vea cuándo la guía
 * y el parecido no coinciden — que es justo cuando hay algo que decidir.
 *
 * **Parecido y ayuda se muestran separados, nunca sumados en pantalla.** Son la
 * decisión: uno protege el diseño, el otro cierra la cuota. En el caso más
 * ajustado de HSVG2026 el mejor por parecido y el mejor por ayuda son aulas
 * distintas y empatan en total; con un solo número nadie sabría que estaba
 * eligiendo.
 *
 * **Nunca dice «no hay reemplazo».** Si un grupo está vacío lo dice y ofrece los
 * otros dos. Un aviso que cierra la puerta obliga a improvisar fuera de la app.
 */

const GRUPOS: Array<{ id: OrigenDeCandidato; titulo: string; pie: string }> = [
  {
    id: "cadena",
    titulo: "Su cadena",
    pie: "El orden que fijó el sorteo. Es la guía: se sigue salvo que no sirva.",
  },
  {
    id: "otra_cadena",
    titulo: "Reservas al aire",
    pie: "De cadenas ya resueltas (su titular o un reemplazo previo ya se aplicó), así que nadie las espera.",
  },
  {
    id: "extra",
    titulo: "Reserva adicional",
    pie: "Cursos-horario adicionales, fuera de toda cadena. No cargan peso de diseño.",
  },
];

// **Con el espacio**, como el resto del perfil: `pctCorto` en la alerta de
// anticipación, `fmtPct` en el criterio de aula y el `p` del propio registro de
// campo, que es la pantalla desde la que se abre este diálogo. Era el único que
// pegaba el signo al número —«se parece 100%» junto a «68.9 %» dos pantallas
// atrás—, y ese chip queda a un click del formulario que sí lo separa.
/* El porcentaje del perfil. Redondeaba al entero, así que una tasa de 53,4 %
   salía «53 %» aquí y «53.4 %» en el panel que abre este popover. */
const pct = (v: number) => pctPerfil(v * 100);

/**
 * El reparto por sexo del aula, en elegibles y en respuestas esperadas.
 *
 * Gonzalo: «el sexo es fundamental, y tenemos que saber el sexo tanto de
 * elegibles como de esperados bajo rendimiento». Son dos cifras distintas y las
 * dos hacen falta: los elegibles dicen a cuánta gente se entra, las esperadas
 * dicen cuántas encuestas salen de ahí. Un aula de 43 con τ 0,55 no cierra una
 * brecha de 40 mujeres aunque 35 de sus elegibles lo sean.
 *
 * `sex_top_1` dice CUÁL es el dominante, así que no se puede asumir que el
 * primero sea mujer: hacerlo invierte el aula entera.
 */
function repartoPorSexo(f: MonitoreoAulasPlanRow) {
  const anon = f as MonitoreoAulasPlanRow & { tasa_efectividad_aula?: number };
  // **El reparto se lee en UN solo sitio.** Esta función tenía su propia copia
  // de la lectura de `sex_top_*` —la tercera del perfil, junto a la de
  // `ayudaCon`— y las tres decían lo mismo por escrito. Son el mismo campo y la
  // misma trampa: el primero es el sexo DOMINANTE, no las mujeres.
  const { mujeres, hombres } = composicionDelAula(f);
  const tasa = Number(anon.tasa_efectividad_aula) > 0 ? Number(anon.tasa_efectividad_aula) : 0.55;
  return {
    elegibles: { mujeres, hombres, total: mujeres + hombres },
    // Hacia abajo: media persona no se encuesta, y una meta redondeada hacia
    // arriba prometería gente que el aula no tiene.
    //
    // **Y el total es la SUMA de las dos, no un tercer redondeo.** Redondear
    // por separado el total rompe la aditividad de la fila: con 29 elegibles
    // (5 mujeres, 24 hombres) y tasa 0,52 salía «2 mujeres · 12 hombres · 15»,
    // porque `floor(29 × 0,52) = 15` mientras `floor(2,6) + floor(12,48) = 14`.
    // Visto a 1440 el 2026-08-30 en las dos solapas del popover: **los seis
    // candidatos mostrados fallaban por uno**, siempre de más en el total.
    // Tres celdas en una línea donde dos tienen que sumar la tercera.
    esperadas: (() => {
      const eM = Math.floor(mujeres * tasa);
      const eH = Math.floor(hombres * tasa);
      return { mujeres: eM, hombres: eH, total: eM + eH };
    })(),
    tasa,
  };
}

function Barra({ valor, tono }: { valor: number; tono: "parecido" | "ayuda" }) {
  return (
    <span className={`aulas-reemplazo-barra es-${tono}`} aria-hidden="true">
      <i style={{ width: `${Math.max(2, Math.round(valor * 100))}%` }} />
    </span>
  );
}

function Candidato({
  c,
  puesto,
  conBrecha,
  brecha,
  onElegir,
}: {
  c: CandidatoDeReemplazo;
  puesto: number;
  /**
   * Si hay una brecha con la que medir «cierra brecha». Sin ella la medida no
   * se calcula y **no se dibuja**: una barra a 0 % se lee como «esta aula no
   * ayuda a cerrar nada», que es una afirmación sobre el aula. La verdad es
   * otra —aquí no se está midiendo eso— y son cosas distintas. Un cero medido
   * y un cero por no medir no pueden verse igual.
   */
  conBrecha: boolean;
  /** Lo que la facultad debe hoy, para decir con qué se queda si se toma éste. */
  brecha?: BrechaPorSexo;
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
}) {
  const f = c.fila;
  /**
   * **El coste de la decisión: con qué se queda la facultad si se toma éste.**
   *
   * Gonzalo lo pidió con esas palabras —«si tomas uno, a la facultad le
   * quedan…»— y es la mitad que faltaba: «cierra brecha 64 %» dice cuánto tapa
   * este candidato, pero no dice si con eso basta. Dos aulas con la misma
   * medida dejan deudas distintas cuando la facultad debe en los dos sexos, y
   * ahí es donde se elige.
   *
   * Se corta cada sexo contra lo que se debe de ESE sexo: lo que sobra de uno
   * no tapa lo que falta del otro, aunque siga contando para el total del
   * estudio.
   */
  const queda = (() => {
    if (!brecha) return null;
    const debeM = Math.max(0, Math.round(brecha.mujeres));
    const debeH = Math.max(0, Math.round(brecha.hombres));
    if (debeM + debeH === 0) return null;
    const r = repartoPorSexo(f);
    const m = Math.max(0, debeM - r.esperadas.mujeres);
    const h = Math.max(0, debeH - r.esperadas.hombres);
    return { m, h, total: m + h, antes: debeM + debeH };
  })();
  return (
    <li className={`aulas-reemplazo-item${puesto === 1 ? " es-mejor" : ""}`}>
      {/* **La tarjeta, con el lenguaje del ensayo del 2026-09-10.** Gonzalo:
          «no se parece en absolutamente nada a la sofisticación y el buen
          diseño que habías tenido en el artefacto». Tenía razón: la pieza
          llevaba una tabla de cuatro columnas para el sexo, dos barras de medida
          apiladas y un botón de ancho completo, y eso se lee como un formulario,
          no como una elección entre tres aulas.

          Lo que manda ahora es la comparación: el puesto a la izquierda, la
          identidad en el centro, la composición en un chip y **las dos varas
          juntas a la derecha**, que es donde se decide. */}
      <div className="aulas-reemplazo-fila">
        <span className="aulas-reemplazo-puesto">{puesto}</span>

        <span className="aulas-reemplazo-quien">
          <span className="aulas-reemplazo-codigo">
            {f.operational_code || f.classroom_id}
            {puesto === 1 ? <b className="aulas-reemplazo-sello">el mejor</b> : null}
          </span>
          <span className="aulas-reemplazo-curso">
            {f.course_name || f.label || "Curso sin nombre"}
            {/* El docente en su peso de texto, no dentro de un chip de color:
                no se decide por él, pero es a quien hay que llamar. */}
            {f.teacher ? <em> · {f.teacher}</em> : null}
          </span>
          <span className="aulas-chips-fila">
            {/* **La facultad primero** (canon B34). Es la frontera dura del
                modelo —de ahí no se sale— y al comparar candidatos de tres
                procedencias hay que ver de dónde es cada uno sin leer. */}
            {f.faculty ? <ChipDato>{facultadCorta(String(f.faculty))}</ChipDato> : null}
            {f.venue ? <ChipLugar lugar={f.venue} /> : null}
            {f.sesiones_dia_hora ? <ChipHora>{f.sesiones_dia_hora}</ChipHora> : null}
          </span>
          {/* **Las tres varas de lo que puede dar, en una tabla.**

              Gonzalo, 2026-09-11: «le falta los hombres y mujeres elegibles y
              los esperados en base a lo planeado y en base a lo obtenido hasta
              ahora». Son tres cosas distintas y la tarjeta enseñaba una sola:

              - **Elegibles** es el techo, el padrón entero.
              - **Según el plan** es el compromiso del diseño, y no se mueve.
              - **Al ritmo de hoy** es el pronóstico con la tasa que el campo
                está consiguiendo de verdad, y cambia cada jornada.

              Las dos últimas DISCREPAN, y esa discrepancia es la decisión: un
              curso-horario cuyo plan pide 16 y al ritmo real dará 11 no es lo
              mismo que uno cuyo plan pide 11 y dará 14. Con una sola cifra no
              se sabía siquiera cuál de las dos se estaba usando. */}
          {(() => {
            const pr = pronosticoDelAula(f);
            if (!pr.elegibles.total) return null;
            const fila = (
              rotulo: string,
              v: { mujeres: number; hombres: number; total: number },
              clase: string,
              nota?: string,
            ) => (
              <tr className={clase}>
                <th scope="row">
                  {rotulo}
                  {nota ? <em>{nota}</em> : null}
                </th>
                <td>{fmt(v.mujeres)}</td>
                <td>{fmt(v.hombres)}</td>
                <td><b>{fmt(v.total)}</b></td>
              </tr>
            );
            return (
              <table className="aulas-reemplazo-varas3">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Mujeres</th>
                    <th scope="col">Hombres</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fila("Elegibles", pr.elegibles, "es-techo")}
                  {pr.plan ? fila("Según el plan", pr.plan, "es-plan") : null}
                  {fila(
                    "Proyección actual",
                    pr.ritmo,
                    "es-ritmo",
                    // De dónde sale la tasa, porque no es lo mismo medida sobre
                    // este curso-horario que prestada de su facultad.
                    pr.deDondeLaTasa === "aula" ? `${pctPerfil(pr.tasa * 100)} suyo`
                      : pr.deDondeLaTasa === "facultad" ? `${pctPerfil(pr.tasa * 100)} de su facultad`
                      : `${pctPerfil(pr.tasa * 100)} del perfil, sin medida propia`,
                  )}
                </tbody>
              </table>
            );
          })()}
          {/* **La discrepancia entre las dos varas, dicha.** Cuando coinciden
              —un candidato que aún no ha salido, cuyo plan se calculó con la
              misma tasa— leer dos filas iguales no aporta; cuando se separan,
              esa distancia ES la decisión y hay que encontrarla sin restar a
              mano. */}
          {(() => {
            const pr = pronosticoDelAula(f);
            if (pr.desvio == null) return null;
            return pr.desvio === 0 ? (
              <span className="aulas-reemplazo-desvio es-igual">La proyección coincide con el plan.</span>
            ) : (
              <span className={`aulas-reemplazo-desvio${pr.desvio < 0 ? " es-corto" : " es-sobra"}`}>
                {pr.desvio < 0
                  ? <>Va a dar <b>{fmt(Math.abs(pr.desvio))}</b> menos de lo que el plan le pedía.</>
                  : <>Va a dar <b>{fmt(pr.desvio)}</b> más de lo que el plan le pedía.</>}
              </span>
            );
          })()}
          {/* Lo que se concede al tomarlo. Vacío cuando es del mismo grupo: ahí
              no hay nada que advertir y rellenarlo sería ruido. */}
          {c.concesiones.length ? (
            <span className="aulas-reemplazo-concesiones">
              Concede: {c.concesiones.join(" · ")}
            </span>
          ) : (
            <span className="aulas-reemplazo-concesiones es-limpia">Mismo grupo: sin concesiones.</span>
          )}
        </span>

        {/* **Las dos varas, juntas y nunca sumadas.** Una protege el diseño
            —que el reemplazo se parezca al que cae— y la otra cierra la cuota;
            puestas una debajo de otra se comparan de un vistazo. «Cierra
            brecha» sólo existe si hay brecha: pintarla a cero diría que el
            candidato no ayuda, cuando lo cierto es que no hay nada que cerrar. */}
        <span className="aulas-reemplazo-varas">
          <span className="aulas-reemplazo-vara es-parecido">
            <em>similitud</em>
            <i><b style={{ width: `${Math.round(c.parecido * 100)}%` }} /></i>
            <strong>{Math.round(c.parecido * 100)}</strong>
          </span>
          {conBrecha ? (
            <span className="aulas-reemplazo-vara es-ayuda">
              <em>cierra brecha</em>
              <i><b style={{ width: `${Math.round(c.ayuda * 100)}%` }} /></i>
              <strong>{Math.round(c.ayuda * 100)}</strong>
            </span>
          ) : null}
          {queda ? (
            <span className="aulas-reemplazo-resto">
              {queda.total
                ? <>a {facultadCorta(String(f.faculty)) || "la facultad"} le quedarían <b>{fmt(queda.total)}</b>
                    {queda.m && queda.h ? <> ({fmt(queda.m)} M · {fmt(queda.h)} H)</>
                      : queda.m ? <> mujeres</> : <> hombres</>}</>
                : <>con éste la facultad cierra su cuota</>}
            </span>
          ) : null}
        </span>
      </div>

      {onElegir ? (
        <button type="button" className="aulas-reemplazo-elegir" onClick={() => onElegir(f)}>
          Elegir {f.operational_code || f.classroom_id}
        </button>
      ) : null}
    </li>
  );
}

/**
 * El PANEL, sin cascarón: cabecera, solapas y candidatos.
 *
 * Va aparte del modal por dos razones. La estructural: el cascarón —velo,
 * bloqueo de scroll, portal, salidas— no sabe nada de reemplazos, y el panel no
 * sabe nada de ventanas. La práctica: `createPortal` pinta en `document.body`,
 * así que un `renderToStaticMarkup` del modal devuelve cadena VACÍA y no se
 * puede probar nada de lo que hay dentro.
 */
export function ContenidoDeReemplazo({
  caido,
  filas,
  brecha,
  pedirAntesDe,
  onElegir,
  onCerrar,
  innerRef,
}: {
  caido: MonitoreoAulasPlanRow;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** Lo que falta en la facultad del aula que cae. Sin brecha, «ayuda» es 0 para todos. */
  brecha?: BrechaPorSexo;
  /**
   * El último día útil para llamar sin que la facultad se quede parada, de
   * `alertaDeAnticipacion`.
   *
   * Es la nota «Decidir tiene fecha» del ensayo: *«un relevo agendado tarde no
   * llega a aplicarse antes del cierre. El plazo va en la cabecera, donde se
   * decide, y no en otra pantalla»*. Vivía sólo en el panel «Cuándo pedir aula
   * adicional» de Resumen, a dos clicks de aquí.
   */
  pedirAntesDe?: string | null;
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
  onCerrar?: () => void;
  /** Lo pone el modal para saber qué es «dentro» al detectar clicks fuera. */
  innerRef?: (el: HTMLDivElement | null) => void;
}) {
  // `null` y no `"cadena"`: con un valor inicial concreto habia que derivar el
  // efectivo con una segunda regla, y esa derivacion abria en la solapa
  // equivocada. Sin eleccion previa manda el orden del procedimiento.
  const [grupo, setGrupo] = useState<OrigenDeCandidato | null>(null);
  const candidatos = useMemo(
    () => candidatosDeReemplazo(filas, caido, brecha ?? { mujeres: 0, hombres: 0 }),
    [filas, caido, brecha],
  );

  // Se abre en el primer grupo que tenga algo, no en «Su cadena» a secas: si la
  // cadena está agotada, abrir en una lista vacía obliga a un click para
  // descubrir que hay opciones en otro sitio.
  // La cadena primero SIEMPRE que tenga algo: es la guia del procedimiento. Si
  // esta agotada se abre en el primer grupo con candidatos, para no obligar a
  // un click que solo sirve para descubrir que la lista esta vacia.
  const inicial = GRUPOS.find((g) => candidatos[g.id].disponibles)?.id ?? "cadena";
  const activo: OrigenDeCandidato = grupo ?? inicial;
  // Hay brecha con la que medir cuando alguien la pasa Y pide algo: una brecha
  // de cero es una facultad cubierta, y ahí «cierra brecha» tampoco significa
  // nada. Sin esta bandera los tres candidatos salían con una barra a «0 %» que
  // se leía como «ninguno ayuda». Registro de campo SÍ la pasa desde que
  // `brechaDeLaFacultad()` la produce de `quotas_sex_faculty`; antes no había
  // productor en todo el perfil y el orden colapsaba a puro parecido.
  const hayBrecha = Boolean(brecha && (brecha.mujeres > 0 || brecha.hombres > 0));

  const grupoActivo = candidatos[activo];
  const lista = grupoActivo.mejores;
  const meta = GRUPOS.find((g) => g.id === activo)!;

  /**
   * **El dilema, en dos aulas.**
   *
   * Este popover lleva desde que se escribió diciendo que parecido y ayuda no se
   * suman —«uno protege el diseño, el otro cierra la cuota»— y dejaba al lector
   * con dos barras y ninguna conclusión. Cuando el mejor por cada vara son
   * aulas DISTINTAS, que es justo cuando hay algo que decidir, se enfrentan.
   *
   * Se mira a los tres grupos y no sólo al activo: el dilema más caro es
   * precisamente el que cruza dos orígenes —la de su cadena contra la que
   * cierra la cuota—, y mirando un grupo cada vez no se ve.
   *
   * Si el mejor por ambas varas coincide, esto no aparece: no hay dilema.
   */
  const duelo = (() => {
    if (!hayBrecha) return null;
    const todos = GRUPOS.flatMap((g) => candidatos[g.id].mejores);
    if (todos.length < 2) return null;
    const porParecido = [...todos].sort((a, b) => b.parecido - a.parecido)[0];
    const porAyuda = [...todos].sort((a, b) => b.ayuda - a.ayuda)[0];
    const codigo = (c: typeof porParecido) => String(c.fila.operational_code || c.fila.classroom_id || "");
    if (!porAyuda.ayuda || codigo(porParecido) === codigo(porAyuda)) return null;
    return { porParecido, porAyuda, codigo };
  })();

  return (
    <div className="aulas-reemplazo-popover" data-pulso-panel="aulas-reemplazo" ref={innerRef}>
      <header className="aulas-reemplazo-head">
        <div>
          <p className="aulas-reemplazo-titulo">Reemplazar {caido.operational_code || caido.classroom_id}</p>
          <p className="aulas-reemplazo-sub">
            {caido.course_name || caido.label} · {caido.stratum} · {caido.eligible_n} elegibles
          </p>
          {/* **Contra qué se elige, antes de con qué.** Sin esto, las dos varas
              de cada candidato son dos números y «el que más ayuda» no dice a
              qué ayuda. Gonzalo, 2026-09-10: «¿bajo qué concepto lo estamos
              haciendo, qué estamos mejorando, y qué es lo que se tiene que
              mejorar en primer lugar?».

              Son las dos cifras por separado y no su suma: la facultad puede ir
              sobrada en un sexo y corta en el otro, y ahí un relevo que traiga
              el sexo cubierto no arregla nada. */}
          {hayBrecha ? (
            <p className="aulas-reemplazo-deuda">
              <span className={brecha!.mujeres > 0 ? "es-debe" : ""}>
                <b>{fmt(Math.max(0, brecha!.mujeres))}</b> mujeres por conseguir
              </span>
              <span className={brecha!.hombres > 0 ? "es-debe" : ""}>
                <b>{fmt(Math.max(0, brecha!.hombres))}</b> hombres por conseguir
              </span>
              <em>en {facultadCorta(String(caido.faculty ?? "")) || "su facultad"}</em>
            </p>
          ) : null}
          {/* **El plazo, en la cabecera y no en otra pantalla.** Un relevo
              agendado tarde no llega a aplicarse antes del cierre, y sin la
              fecha delante la lista de abajo parece que se puede mirar mañana
              igual. Sale del mismo sitio que la tabla «Cuándo pedir aula
              adicional» de Resumen: dos fechas distintas para el mismo día útil
              es la avería más cara de este perfil. */}
          {pedirAntesDe ? (
            <p className="aulas-reemplazo-plazo">
              Pídelo antes del <b>{etiquetaDeFecha(pedirAntesDe)}</b>
              <em>después, no llega a aplicarse antes del cierre</em>
            </p>
          ) : null}
        </div>
        {onCerrar ? (
          <button type="button" className="aulas-reemplazo-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        ) : null}
      </header>

      <nav
        className="aulas-reemplazo-solapas"
        role="tablist"
        aria-label="De dónde sacar el reemplazo"
        data-gliding-opt-out="Estas solapas separan DE DÓNDE sale el candidato —su cadena o la reserva adicional—, que es una decisión distinta con su propio recuento; no son el recorrido del módulo. Viven dentro de un popover que se abre sobre una fila, y el indicador deslizante del rail pediría un ancho estable que esta superficie no tiene."
      >
        {GRUPOS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={activo === g.id}
            className={`aulas-reemplazo-solapa${activo === g.id ? " es-activa" : ""}`}
            onClick={() => setGrupo(g.id)}
          >
            {g.titulo}
            {/* E24: el cero de la solapa susurra (la doctrina de E8/E10) — la
                solapa sigue clickeable y su vacío se declara al entrar. */}
            <span className={`aulas-reemplazo-cuenta${candidatos[g.id].disponibles ? "" : " es-cero"}`}>
              {candidatos[g.id].disponibles}
            </span>
          </button>
        ))}
      </nav>

      {duelo ? (
        <div className="aulas-reemplazo-duelo">
          <div className="aulas-reemplazo-duelo-titulo">
            <h4>El dilema, en dos cursos-horario</h4>
            <span>las dos varas no señalan el mismo: elige cuál pesa</span>
          </div>
          <div className="aulas-reemplazo-duelo-lados">
            <div className="es-parecido">
              <span className="vara">Protege el diseño</span>
              <b>{duelo.codigo(duelo.porParecido)}</b>
              <span className="gana">
                Se parece al que releva: <strong>{pctPerfil(duelo.porParecido.parecido * 100)}</strong> de parecido.
              </span>
              <span className="concede">
                Cierra <strong>{pctPerfil(duelo.porParecido.ayuda * 100)}</strong> de lo que falta.
              </span>
            </div>
            <div className="es-ayuda">
              <span className="vara">Cierra la cuota</span>
              <b>{duelo.codigo(duelo.porAyuda)}</b>
              <span className="gana">
                Cierra <strong>{pctPerfil(duelo.porAyuda.ayuda * 100)}</strong> de lo que falta.
              </span>
              <span className="concede">
                Se aleja del original: <strong>{pctPerfil(duelo.porAyuda.parecido * 100)}</strong> de parecido.
              </span>
            </div>
          </div>
          <span className="aulas-reemplazo-duelo-o" aria-hidden="true">o</span>
        </div>
      ) : null}

      <p className="aulas-reemplazo-pie">
        {meta.pie}
        {grupoActivo.disponibles > lista.length ? (
          // Se declara el recorte en vez de dejar que «3 de 9» parezca «3».
          // Un tope silencioso se lee como inventario completo.
          <> Se muestran las <b>{lista.length} mejores</b> de {grupoActivo.disponibles}.</>
        ) : null}
      </p>

      {lista.length ? (
        <ol className="aulas-reemplazo-lista">
          {lista.map((c, i) => (
            <Candidato
              key={c.fila.operational_code || c.fila.classroom_id}
              c={c}
              puesto={i + 1}
              conBrecha={hayBrecha}
              brecha={brecha}
              onElegir={onElegir}
            />
          ))}
        </ol>
      ) : (
        // Nunca «no hay reemplazo» a secas: se dice qué grupo está vacío y a
        // cuál ir. Los otros dos siguen a un click.
        <p className="aulas-reemplazo-vacio">
          Aquí no queda ninguna.{" "}
          {GRUPOS.filter((g) => g.id !== activo && candidatos[g.id].disponibles).length
            ? <>Sí hay en {GRUPOS.filter((g) => g.id !== activo && candidatos[g.id].disponibles).map((g) => g.titulo).join(" y ")}.</>
            : <>Tampoco en los otros dos grupos: hay que pedir aulas nuevas.</>}
        </p>
      )}
    </div>
  );
}

/**
 * La VENTANA: el panel de elección, encima de todo y con el fondo detenido.
 *
 * Gonzalo, en dos pasos: «debe ser un pop up que te limite scrollear hasta que o
 * lo cierres o decidas» y «es como una ventana algo más pequeña que se abre
 * encima, y limita y pone gris lo de atrás».
 *
 * Por qué modal y no popover anclado: esto es una DECISIÓN —qué aula entra en
 * campo— y no una consulta. Dejar el fondo vivo invita a hojear en vez de
 * decidir, y anclarlo al botón lo dejaba compitiendo con el formulario que hay
 * debajo. Antes de esto estaba montado en el flujo y empujaba el registro
 * entero hacia abajo.
 *
 * Dos salidas y ninguna más: cerrar —Escape, click en el velo, la × de la
 * cabecera— o decidir, que cierra sola al elegir.
 */
export function AulasPopoverReemplazo({
  abierto = true,
  onCerrar,
  ...resto
}: {
  /** Cerrada no pinta nada, no bloquea el scroll y no escucha teclas. */
  abierto?: boolean;
  caido: MonitoreoAulasPlanRow;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  brecha?: BrechaPorSexo;
  /** El último día útil para llamar; viaja al contenido con el resto. */
  pedirAntesDe?: string | null;
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
  onCerrar?: () => void;
}) {
  const caja = useRef<HTMLDivElement | null>(null);

  // El fondo se detiene mientras se decide. Se guarda el valor previo y se
  // restaura en vez de escribir `""`: eso pisaría un `overflow` que otra capa
  // hubiera puesto. Es como lo hace `EstiloGlobalDialog`.
  useEffect(() => {
    if (!abierto || typeof document === "undefined") return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !onCerrar) return;
    const porTecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    // `mousedown` y no `click`: con click, soltar el botón sobre el velo tras
    // arrastrar desde dentro del panel —seleccionando texto, por ejemplo—
    // cerraría la ventana en mitad de un gesto que no la señalaba.
    const porFuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) onCerrar();
    };
    window.addEventListener("keydown", porTecla);
    document.addEventListener("mousedown", porFuera);
    return () => {
      window.removeEventListener("keydown", porTecla);
      document.removeEventListener("mousedown", porFuera);
    };
  }, [abierto, onCerrar]);

  if (!abierto || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="aulas-reemplazo-fondo"
      role="dialog"
      aria-modal="true"
      aria-label={`Reemplazar ${resto.caido.operational_code || resto.caido.classroom_id}`}
    >
      <ContenidoDeReemplazo {...resto} onCerrar={onCerrar} innerRef={(el) => { caja.current = el; }} />
    </div>,
    document.body,
  );
}
