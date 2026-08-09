/**
 * E4 · «El sorteo» — la cadena de titulares (dirección 2026-08-08).
 *
 * El campo se pinta ENTERO en gris: es el marco del que se elige. Después cada
 * curso-horario sorteado se ENCIENDE en su sitio, en el orden que publicó
 * `discount_step`, y se ata a la anterior de su mismo estrato hasta formar la
 * cola de titulares. Las barras de balance hacen tick con cada encendido, y el
 * sub-stepper permite ir de a una — también en reduced motion, como cuadros
 * discretos.
 *
 * Qué cambió y por qué: antes la bola volaba desde el borde del bombo y se
 * ataba a sus DOS vecinas más cercanas. Las dos cosas contaban algo que el
 * muestreo no hace. El vuelo sugería una llegada —la bola ya estaba en el
 * marco, lo que cambia es su estado—, y la vecindad es una relación ESPACIAL:
 * unía bolas por estar al lado. La cadena por orden de sorteo sí es una
 * relación del método.
 *
 * El ORDEN sale íntegro del dato: `discount_step` en corridas secuenciales (y
 * ahí el encogimiento es publicar `eligible_n_neto`). Se encadena DENTRO del
 * estrato porque el paso reinicia en cada uno; unir el último de un estrato
 * con el primero del siguiente dibujaría una sucesión que no ocurrió. Sin
 * `discount_step` no hay cadena: agregado por estrato con el hueco declarado.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmtInt } from "../../../../sharedCore";
import { discountModeDetalle, discountModeLabel } from "../../descuentoRepetidosModel";
import { RELATO_BOLAS_MAX, type RelatoEscenaSorteo, type RelatoPasoSorteo } from "../relatoModel";
import { EnsamblajeBalanceado } from "./EnsamblajeBalanceado";
import { bobbingDeBola, escalaPorDensidad, membranaGoo, posicionCadena, radioGoo } from "./goo";
import { RelatoCifra, RelatoHuecos } from "./relatoPartes";

/** ~820 ms por bola: con ~30 titulares son ~25 s, dentro del tope de 60 s. */
const BOLA_MS = 820;

/** El tamaño con el que la bola queda ensamblada: el dato, no decoración. */
function elegiblesEnsamblados(paso: RelatoPasoSorteo, encoge: boolean): number | null {
  return encoge ? paso.neto ?? paso.bruto : paso.bruto ?? paso.neto;
}

function cifraDeAterrizaje(paso: RelatoPasoSorteo, encoge: boolean): string {
  if (paso.certeza) return "certeza · sin sorteo";
  if (encoge && paso.neto != null) return `${fmtInt(paso.neto)} netos`;
  const elegibles = elegiblesEnsamblados(paso, encoge);
  return elegibles != null ? `${fmtInt(elegibles)} elegibles` : "";
}

/**
 * Agrupa los pasos por estrato conservando su orden de sorteo, y corta por
 * grupos ENTEROS hasta el cap. Un grupo que no entra completo no entra: media
 * cadena leería como una cola rota, que es un hecho distinto del que hubo.
 *
 * El orden entre estratos es el de su primera aparición en el sorteo, así que
 * sigue saliendo del dato; el orden DENTRO del estrato es `discount_step`, que
 * es el único orden de selección real.
 */
function agruparEnCadenas(pasos: RelatoPasoSorteo[], cap: number): RelatoPasoSorteo[] {
  const porEstrato = new Map<string, RelatoPasoSorteo[]>();
  for (const paso of pasos) {
    const grupo = porEstrato.get(paso.estrato);
    if (grupo) grupo.push(paso);
    else porEstrato.set(paso.estrato, [paso]);
  }
  const salida: RelatoPasoSorteo[] = [];
  for (const grupo of porEstrato.values()) {
    if (salida.length + grupo.length > cap) continue;
    salida.push(...grupo);
  }
  return salida;
}

function prefiereMovimientoReducido(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EscenaSorteo({ escena }: { escena: RelatoEscenaSorteo }) {
  // El recorte conserva CADENAS COMPLETAS, no la primera ronda de todo.
  //
  // `escena.pasos` viene ordenado por `discount_step`, que reinicia en cada
  // estrato. Cortar los primeros 60 de ese orden global se lleva 60 pasos «1»
  // de 60 estratos distintos: ninguno repite estrato y la cadena no tiene un
  // solo eslabón. Medido con el estudio real —84 estratos, 45 bolas
  // encendidas, 0 eslabones—: la escena mostraba puntos sueltos.
  //
  // Se agrupa por estrato (los estratos entran en el orden en que aparecieron
  // en el sorteo) y se corta por grupos enteros. Se ve nacer una cola, y otra,
  // en vez de la primera pieza de sesenta colas que nunca se arman.
  const visibles = agruparEnCadenas(escena.pasos, RELATO_BOLAS_MAX);
  const ocultos = escena.pasos.length - visibles.length;
  const total = visibles.length;
  // Reduced motion (evaluado una vez): el cluster nace completo; el
  // sub-stepper sigue funcionando como cuadros discretos.
  const [reducido] = useState(prefiereMovimientoReducido);
  const [aterrizadas, setAterrizadas] = useState(() => (reducido ? total : 0));
  const [autoAvance, setAutoAvance] = useState(true);

  useEffect(() => {
    if (reducido || !autoAvance || aterrizadas >= total) return;
    const timer = window.setTimeout(
      () => setAterrizadas((actual) => Math.min(total, actual + 1)),
      aterrizadas === 0 ? 500 : BOLA_MS,
    );
    return () => window.clearTimeout(timer);
  }, [reducido, autoAvance, aterrizadas, total]);

  // ---------------------------------------------------------------------
  // UN solo campo: el marco entero, y las sorteadas encendiéndose dentro
  // ---------------------------------------------------------------------
  //
  // Antes las bolas volaban desde el borde y se ataban a sus DOS vecinas más
  // cercanas. Esa topología era espacial, no del sorteo: unía bolas por estar
  // al lado, que es una relación que el muestreo no tiene. Ahora el campo se
  // pinta completo en gris —el marco del que se elige— y cada sorteada se
  // ENCIENDE en su sitio, en el orden que publicó `discount_step`, atándose a
  // la anterior de SU MISMO estrato. La cadena es el sorteo.
  //
  // El encadenado es por estrato porque `discount_step` reinicia en cada uno:
  // unir el último de un estrato con el primero del siguiente dibujaría una
  // sucesión que no ocurrió. Y de paso hace corta la animación —los estratos
  // avanzan en paralelo—, que con 196 titulares de a uno serían ~29 s.
  const campo = escena.campo;
  const maxElegibles = Math.max(
    1,
    ...visibles.map((paso) => elegiblesEnsamblados(paso, escena.encoge) ?? 0),
    ...campo.map((bola) => bola.elegibles ?? 0),
  );
  // Orden del campo: la CADENA primero, en su orden de sorteo, y el resto del
  // marco después.
  //
  // Se probó ordenar por tamaño publicado (el criterio del bombo) y la escena
  // quedaba ilegible: dos eslabones consecutivos caían en extremos opuestos de
  // la espiral y los enlaces se cruzaban hasta leerse como una maraña, no como
  // una cola. Con el orden de la cadena, los consecutivos son vecinos en la
  // espiral y la cola se lee como un recorrido. El tamaño sigue siendo el
  // radio: lo que cambia es dónde se sienta cada bola, no cuánto mide.
  //
  // LUGAR y TURNO son cosas distintas y se calculan aparte. El lugar en la
  // espiral agrupa por estrato, para que cada cola se lea como un camino. El
  // turno —en qué momento se enciende— va por RONDAS: primero el paso 1 de
  // todos los estratos, después el paso 2, y así. Los estratos se sortean en
  // paralelo, no uno después del otro, y encender cola por cola contaba una
  // secuencia entre estratos que el método no tiene.
  const turnoDe = new Map<number, number>();
  visibles
    .map((paso, index) => ({ paso, index }))
    .sort((a, b) => a.paso.paso - b.paso.paso || a.index - b.index)
    .forEach((entrada, turno) => turnoDe.set(entrada.index, turno));

  const unidades = [
    ...visibles.map((paso, orden) => ({
      clave: `paso-${paso.code}`,
      orden,
      turno: turnoDe.get(orden) ?? orden,
      paso,
      elegibles: elegiblesEnsamblados(paso, escena.encoge),
    })),
    ...campo.map((bola) => ({
      clave: `campo-${bola.code}`,
      orden: null as number | null,
      turno: null as number | null,
      paso: null,
      elegibles: bola.elegibles,
      bola,
    })),
  ].sort((a, b) => {
    // Los pasos van primero, en el orden en que salieron; el campo detrás,
    // por tamaño publicado, con desempate estable por clave.
    if (a.orden != null && b.orden != null) return a.orden - b.orden;
    if (a.orden != null) return -1;
    if (b.orden != null) return 1;
    return (
      (b.elegibles ?? -1) - (a.elegibles ?? -1) ||
      a.clave.localeCompare(b.clave, "es", { sensitivity: "base", numeric: true })
    );
  });
  // El tamaño sigue siendo el dato; la densidad solo decide en qué escala se
  // dibuja ese dato para que el campo lleno siga siendo legible.
  const escala = escalaPorDensidad(unidades.length);
  const geometria = unidades.map((unidad, index) => ({
    ...unidad,
    pos: posicionCadena(index, unidades.length),
    r: radioGoo(unidad.elegibles, maxElegibles) * escala,
  }));

  // La bola del turno actual (la que acaba de encenderse), para el indicador.
  const indiceReciente = visibles.findIndex(
    (_, index) => turnoDe.get(index) === aterrizadas - 1,
  );
  const ultima = aterrizadas > 0 && indiceReciente >= 0 ? visibles[indiceReciente] : null;
  const bolasBalance = escena.balance?.variables[0]?.porBola.length ?? 0;

  // La cadena: eslabón entre pasos CONSECUTIVOS del mismo estrato. El par se
  // dibuja cuando AMBOS extremos ya se encendieron —por turno, no por lugar—,
  // así que las colas se alargan a la vez en vez de completarse una por una.
  const porOrden = new Map(
    geometria.filter((u) => u.orden != null).map((u) => [u.orden as number, u]),
  );
  const encendido = (index: number) => (turnoDe.get(index) ?? Infinity) < aterrizadas;
  const ultimoDelEstrato = new Map<string, number>();
  const eslabones: Array<{ de: number; a: number }> = [];
  for (let k = 0; k < visibles.length; k += 1) {
    const estrato = visibles[k]!.estrato;
    const previo = ultimoDelEstrato.get(estrato);
    if (previo != null && encendido(k) && encendido(previo)) {
      eslabones.push({ de: previo, a: k });
    }
    ultimoDelEstrato.set(estrato, k);
  }
  const reciente = indiceReciente;

  function irABola(valor: number) {
    setAutoAvance(false);
    setAterrizadas(Math.max(0, Math.min(total, valor)));
  }

  return (
    <div className="cmv2-relato-escena-cuerpo">
      {escena.descuento && (
        <p className="cmv2-relato-nota">
          <strong>{discountModeLabel(escena.descuento)}.</strong>{" "}
          {discountModeDetalle(escena.descuento)}
        </p>
      )}
      {escena.modo === "pasos" ? (
        <>
          <svg
            className="cmv2-relato-goo is-ensamblaje"
            viewBox="0 0 100 100"
            role="img"
            aria-label={`Cola de titulares: ${fmtInt(aterrizadas)} de ${fmtInt(total)} cursos-horario sorteados, en el orden publicado, sobre un marco de ${fmtInt(geometria.length)} unidades`}
          >
            {/* La cola: cada eslabón une dos pasos CONSECUTIVOS del mismo
                estrato. El recién tensado hace SNAP y vibra con la senoide
                amortiguada del asentamiento. */}
            {eslabones.map((eslabon) => {
              const desde = porOrden.get(eslabon.de);
              const hasta = porOrden.get(eslabon.a);
              if (!desde || !hasta) return null;
              const membrana = membranaGoo(
                { ...desde.pos, r: desde.r },
                { ...hasta.pos, r: hasta.r },
              );
              const esReciente = eslabon.a === reciente && !reducido;
              return (
                <path
                  key={`eslabon-${eslabon.de}-${eslabon.a}${esReciente ? "-snap" : ""}`}
                  className={`cmv2-relato-goo-membrana${esReciente ? " is-snap" : ""}`}
                  d={membrana.d}
                  style={{ strokeWidth: membrana.grosor.toFixed(2) }}
                />
              );
            })}
            {geometria.map((unidad, index) => {
              const paso = unidad.paso;
              // Encendida = ya salió en el sorteo hasta donde va el stepper.
              const encendida = paso != null && (unidad.turno as number) < aterrizadas;
              const esReciente = paso != null && unidad.orden === reciente && aterrizadas > 0;
              const bobbing = bobbingDeBola(index);
              const anillo = encendida && !escena.encoge && (paso!.yaCubiertos ?? 0) > 0;
              const codigo = paso ? paso.code : unidad.bola!.code;
              const cifra = paso
                ? cifraDeAterrizaje(paso, escena.encoge)
                : unidad.bola!.elegibles != null
                  ? `${fmtInt(unidad.bola!.elegibles)} elegibles`
                  : "";
              const detalle = paso
                ? [
                    paso.etiqueta,
                    paso.facultad,
                    cifra,
                    escena.encoge && paso.bruto != null && paso.neto != null
                      ? `${fmtInt(paso.bruto)} → ${fmtInt(paso.neto)} netos`
                      : "",
                    (paso.yaCubiertos ?? 0) > 0 ? `${fmtInt(paso.yaCubiertos)} ya cubiertos` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : [unidad.bola!.etiqueta, unidad.bola!.facultad, cifra].filter(Boolean).join(" · ");
              return (
                <g
                  key={`${unidad.clave}${esReciente ? "-enciende" : ""}`}
                  tabIndex={0}
                  className={[
                    "cmv2-relato-goo-bola",
                    // Gris hasta que sale: el marco del que se elige. Una bola
                    // que aún no salió NO se pinta de sorteada.
                    encendida ? "is-sorteada" : "is-candidata",
                    encendida ? "is-ensamblada" : "",
                    esReciente && !reducido ? "is-aterrizando" : "",
                    encendida && paso!.certeza ? "is-certeza" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    // La bola NO se mueve: ya está en su sitio del marco y lo
                    // que cambia es su estado. El vuelo desde el borde contaba
                    // una llegada que el sorteo no hace.
                    transform: `translate(${unidad.pos.x.toFixed(2)}px, ${unidad.pos.y.toFixed(2)}px)`,
                    ["--relato-i" as string]: String(Math.min(index, 24)),
                    ["--goo-sombra" as string]: `${Math.max(0.4, unidad.r * 0.14).toFixed(2)}px`,
                    ["--wob-dur" as string]: bobbing.duracion,
                    ["--wob-delay" as string]: bobbing.fase,
                  }}
                >
                  <title>
                    {paso
                      ? `Paso ${fmtInt(paso.paso)} · ${paso.estrato} · ${codigo} · ${detalle}`
                      : `Sin sortear · ${codigo} · ${detalle}`}
                  </title>
                  <circle className="cmv2-relato-goo-cuerpo" r={unidad.r.toFixed(2)} />
                  <circle
                    className="cmv2-relato-goo-brillo"
                    r={(unidad.r * 0.34).toFixed(2)}
                    cx={(-unidad.r * 0.32).toFixed(2)}
                    cy={(-unidad.r * 0.36).toFixed(2)}
                  />
                  {encendida && paso!.certeza && (
                    <circle className="cmv2-relato-goo-doble" r={Math.max(0.8, unidad.r - 1.1).toFixed(2)} />
                  )}
                  {anillo && <circle className="cmv2-relato-goo-anillo" r={(unidad.r + 0.9).toFixed(2)} />}
                  {encendida && (
                    <text className="cmv2-relato-goo-paso" dy="0.9">{fmtInt(paso!.paso)}</text>
                  )}
                  {/* Rótulo fijo SOLO en la que acaba de encenderse.
                      Con las 60 encendidas rotuladas a la vez, las etiquetas se
                      pisaban entre sí —11 pares medidos— y la escena se leía
                      sucia aunque ninguna bola se tocara. Sesenta nombres
                      simultáneos tampoco se leen: lo que la escena cuenta es
                      QUÉ pasa ahora, y la secuencia completa está en la lista
                      «Orden real del sorteo» debajo del SVG. Los demás
                      conservan su código en hover/focus y en el `<title>`, así
                      que no se pierde nada alcanzable (C4). */}
                  {esReciente ? (
                    <text className="cmv2-relato-goo-rotulo is-reciente" y={unidad.r + 2.6}>
                      {codigo}
                      {cifra ? ` · ${cifra}` : ""}
                    </text>
                  ) : (
                    <text className="cmv2-relato-goo-rotulo is-hover" y={unidad.r + 2.6}>
                      {codigo}
                      {cifra ? ` · ${cifra}` : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Sub-timeline de la escena: bola por bola, a mano. No publica
              nada en la dirección — es estado efímero del cuadro. */}
          <div className="cmv2-relato-substepper" role="group" aria-label="Paso a paso del ensamblaje">
            <button
              type="button"
              className="cmv2-ghost"
              disabled={aterrizadas === 0}
              aria-label="Bola anterior"
              onClick={() => irABola(aterrizadas - 1)}
            >
              <ChevronLeft size={13} aria-hidden="true" />
            </button>
            <input
              className="cmv2-relato-scrub is-sub"
              type="range"
              min={0}
              max={total}
              step={1}
              value={aterrizadas}
              aria-label="Bolas ensambladas"
              aria-valuetext={`Bola ${aterrizadas} de ${total}`}
              onChange={(event) => irABola(Number(event.currentTarget.value))}
            />
            <button
              type="button"
              className="cmv2-ghost"
              disabled={aterrizadas >= total}
              aria-label="Bola siguiente"
              onClick={() => irABola(aterrizadas + 1)}
            >
              <ChevronRight size={13} aria-hidden="true" />
            </button>
            <p className="cmv2-relato-indicador" aria-live="polite">
              Bola {fmtInt(aterrizadas)} de {fmtInt(total)}
              {ultima
                ? ` · ${ultima.code} · ${cifraDeAterrizaje(ultima, escena.encoge)}`
                : ""}
            </p>
          </div>

          {ocultos > 0 && (
            <p className="cmv2-relato-nota">
              +{fmtInt(ocultos)} pasos más del sorteo; sus cifras siguen abajo.
            </p>
          )}
          <ol className="cmv2-relato-pasos" aria-label="Orden real del sorteo">
            {visibles.map((paso) => (
              <li key={`${paso.paso}-${paso.code}`} className="cmv2-relato-paso">
                <span className="cmv2-relato-paso-orden">{fmtInt(paso.paso)}</span>
                <span className="cmv2-relato-paso-quien">
                  <strong>
                    {paso.code}
                    {paso.certeza ? " · certeza · sin sorteo" : ""}
                  </strong>
                  <small>{paso.etiqueta} · {paso.facultad}</small>
                </span>
                <span className="cmv2-relato-paso-cifras">
                  <span>{paso.bruto == null ? "— brutos" : `${fmtInt(paso.bruto)} brutos`}</span>
                  <span className="cmv2-relato-flecha" aria-hidden="true">→</span>
                  <span>{paso.yaCubiertos == null ? "— ya cubiertos" : `−${fmtInt(paso.yaCubiertos)} ya cubiertos`}</span>
                  <span className="cmv2-relato-flecha" aria-hidden="true">→</span>
                  <span className="is-neto">{paso.neto == null ? "— netos" : `${fmtInt(paso.neto)} netos`}</span>
                </span>
              </li>
            ))}
            {ocultos > 0 && (
              <li className="cmv2-relato-paso is-resto">
                <span className="cmv2-relato-paso-orden">…</span>
                <span className="cmv2-relato-paso-quien">
                  <strong>+{fmtInt(ocultos)} pasos más</strong>
                  <small>agregados por el tope de la vista; el orden completo vive en la corrida</small>
                </span>
              </li>
            )}
          </ol>
        </>
      ) : (
        <>
          <div className="cmv2-relato-cifras">
            <RelatoCifra label="Estratos sorteados" valor={fmtInt(escena.porEstrato.length)} />
            <RelatoCifra
              label="Cursos-horario sorteados"
              valor={fmtInt(escena.porEstrato.reduce((totalCuota, item) => totalCuota + item.cuota, 0))}
              realce
            />
          </div>
          <table className="cmv2-relato-tabla">
            <thead>
              <tr>
                <th scope="col">Estrato</th>
                <th scope="col" className="is-num">Elegibles</th>
                <th scope="col" className="is-num">Sorteados</th>
              </tr>
            </thead>
            <tbody>
              {escena.porEstrato.map((item) => (
                <tr key={item.estrato}>
                  <th scope="row">{item.estrato}</th>
                  <td className="is-num">{item.elegiblesEstrato == null ? "—" : fmtInt(item.elegiblesEstrato)}</td>
                  <td className="is-num">{fmtInt(item.cuota)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {/* Coreografía propia del engine balanceado: el perfil de la muestra
          convergiendo al del marco, con tick por bola aterrizada. */}
      {escena.balance && (
        <EnsamblajeBalanceado
          balance={escena.balance}
          ensambladas={escena.modo === "pasos" ? aterrizadas : bolasBalance}
        />
      )}
      {escena.ajustesTamano.length > 0 && (
        <ul className="cmv2-relato-huecos is-ajuste" aria-label="Ajustes de tamaño divulgados por la corrida">
          {escena.ajustesTamano.map((texto) => (
            <li key={texto}>{texto}</li>
          ))}
        </ul>
      )}
      <RelatoHuecos huecos={escena.huecos} />
    </div>
  );
}
