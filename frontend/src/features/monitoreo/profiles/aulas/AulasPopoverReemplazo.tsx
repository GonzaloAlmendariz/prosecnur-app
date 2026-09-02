import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  candidatosDeReemplazo,
  type BrechaPorSexo,
  type CandidatoDeReemplazo,
  type OrigenDeCandidato,
} from "./candidatosDeReemplazo";

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
    pie: "De cadenas ya resueltas —su titular o un reemplazo previo ya se aplicó—, así que nadie las espera.",
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
const pct = (v: number) => `${Math.round(v * 100)} %`;

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
  const anon = f as MonitoreoAulasPlanRow & {
    sex_top_1?: string; sex_top_1_n?: number; sex_top_2_n?: number; tasa_efectividad_aula?: number;
  };
  const n1 = Number(anon.sex_top_1_n) || 0;
  const n2 = Number(anon.sex_top_2_n) || 0;
  const dominanteM = String(anon.sex_top_1 ?? "").trim().toUpperCase() === "M";
  const mujeres = dominanteM ? n2 : n1;
  const hombres = dominanteM ? n1 : n2;
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
  onElegir?: (fila: MonitoreoAulasPlanRow) => void;
}) {
  const f = c.fila;
  return (
    <li className={`aulas-reemplazo-item${puesto === 1 ? " es-mejor" : ""}`}>
      <div className="aulas-reemplazo-cabeza">
        <span className="aulas-reemplazo-puesto">{puesto}</span>
        <span className="aulas-reemplazo-codigo">{f.operational_code || f.classroom_id}</span>
        {puesto === 1 ? <span className="aulas-reemplazo-sello">el mejor</span> : null}
      </div>

      {/* Lo que hace falta para decidir: qué curso, dónde, con quién, cuándo. */}
      <p className="aulas-reemplazo-curso">{f.course_name || f.label || "Curso sin nombre"}</p>
      <p className="aulas-reemplazo-datos">
        {f.venue ? <span>Aula {f.venue}</span> : null}
        {f.teacher ? <span>{f.teacher}</span> : null}
        {f.sesiones_dia_hora ? <span>{f.sesiones_dia_hora}</span> : null}
        <span>{f.eligible_n} elegibles</span>
      </p>

      {/* El sexo, en las dos lecturas. Va ANTES de las medidas porque es el
          dato con el que se juzga si «cierra brecha» significa algo aquí. */}
      {(() => {
        const r = repartoPorSexo(f);
        return (
          <table className="aulas-reemplazo-sexo">
            <tbody>
              <tr>
                <th scope="row">Elegibles</th>
                <td><b>{r.elegibles.mujeres}</b> mujeres</td>
                <td><b>{r.elegibles.hombres}</b> hombres</td>
                <td className="es-total">{r.elegibles.total}</td>
              </tr>
              <tr>
                <th scope="row">Esperadas <em>×{r.tasa.toFixed(2)}</em></th>
                <td><b>{r.esperadas.mujeres}</b> mujeres</td>
                <td><b>{r.esperadas.hombres}</b> hombres</td>
                <td className="es-total">{r.esperadas.total}</td>
              </tr>
            </tbody>
          </table>
        );
      })()}

      <div className="aulas-reemplazo-medidas">
        <span className="aulas-reemplazo-medida">
          <em>se parece</em>
          <Barra valor={c.parecido} tono="parecido" />
          <strong>{pct(c.parecido)}</strong>
        </span>
        {conBrecha ? (
          <span className="aulas-reemplazo-medida">
            <em>cierra brecha</em>
            <Barra valor={c.ayuda} tono="ayuda" />
            <strong>{pct(c.ayuda)}</strong>
          </span>
        ) : null}
      </div>

      {/* Lo que se concede al tomarlo. Vacío cuando es de la misma celda: ahí no
          hay nada que advertir y rellenarlo con «mismo todo» sería ruido. */}
      {c.concesiones.length ? (
        <p className="aulas-reemplazo-concesiones">
          <span>Cambias:</span> {c.concesiones.join(" · ")}
        </p>
      ) : (
        <p className="aulas-reemplazo-concesiones es-limpia">Mismo grupo: no concedes nada.</p>
      )}

      {onElegir ? (
        <button type="button" className="aulas-reemplazo-elegir" onClick={() => onElegir(f)}>
          Reemplazar con ésta
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
  onElegir,
  onCerrar,
  innerRef,
}: {
  caido: MonitoreoAulasPlanRow;
  filas: ReadonlyArray<MonitoreoAulasPlanRow>;
  /** Lo que falta en la facultad del aula que cae. Sin brecha, «ayuda» es 0 para todos. */
  brecha?: BrechaPorSexo;
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

  return (
    <div className="aulas-reemplazo-popover" data-pulso-panel="aulas-reemplazo" ref={innerRef}>
      <header className="aulas-reemplazo-head">
        <div>
          <p className="aulas-reemplazo-titulo">Reemplazar {caido.operational_code || caido.classroom_id}</p>
          <p className="aulas-reemplazo-sub">
            {caido.course_name || caido.label} · {caido.stratum} · {caido.eligible_n} elegibles
          </p>
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
            <span className="aulas-reemplazo-cuenta">{candidatos[g.id].disponibles}</span>
          </button>
        ))}
      </nav>

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
