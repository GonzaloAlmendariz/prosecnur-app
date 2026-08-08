/**
 * E4 · «El sorteo» — el ensamblaje bola por bola (polish 2026-08-07).
 *
 * La escena ya no resuelve el cluster de golpe: la bola k se despega del
 * borde del bombo, viaja por un arco DETERMINISTA (arcoGoo) hasta su posición
 * en la estructura, aterriza con un squash suave y su cifra publicada (neto o
 * elegibles) aparece al lado; las barras de balance hacen tick con cada
 * aterrizaje. El usuario puede ir bola por bola con el sub-stepper — también
 * en el modo estático de reduced motion (cuadros discretos).
 *
 * El ORDEN de aterrizaje es exactamente el orden publicado de las filas:
 * `discount_step` en corridas secuenciales (el encogimiento es publicar
 * `eligible_n_neto`); en cube, la secuencia de lectura del ensamblaje
 * simultáneo — y la escena lo declara. Nada se re-sortea. Sin `discount_step`,
 * el agregado por estrato con el hueco declarado.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmtInt } from "../../../../sharedCore";
import { discountModeDetalle, discountModeLabel } from "../../descuentoRepetidosModel";
import { RELATO_BOLAS_MAX, type RelatoEscenaSorteo, type RelatoPasoSorteo } from "../relatoModel";
import { EnsamblajeBalanceado } from "./EnsamblajeBalanceado";
import {
  arcoGoo,
  bobbingDeBola,
  membranaGoo,
  origenBombo,
  posicionGoo,
  radioGoo,
  vecinasMasCercanas,
} from "./goo";
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

function prefiereMovimientoReducido(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Ángulo del vuelo origen → destino (grados): orienta el estiramiento tangente. */
function anguloDeVuelo(origen: { x: number; y: number }, destino: { x: number; y: number }): number {
  return (Math.atan2(destino.y - origen.y, destino.x - origen.x) * 180) / Math.PI;
}

export function EscenaSorteo({ escena }: { escena: RelatoEscenaSorteo }) {
  const visibles = escena.pasos.slice(0, RELATO_BOLAS_MAX);
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

  const maxElegibles = Math.max(
    1,
    ...visibles.map((paso) => elegiblesEnsamblados(paso, escena.encoge) ?? 0),
  );
  const geometria = visibles.map((paso, index) => {
    const destino = posicionGoo(index, total);
    const origen = origenBombo(index);
    return {
      paso,
      destino,
      origen,
      arco: arcoGoo(origen, destino),
      r: radioGoo(elegiblesEnsamblados(paso, escena.encoge), maxElegibles),
    };
  });
  const ultima = aterrizadas > 0 ? geometria[aterrizadas - 1] : null;
  const bolasBalance = escena.balance?.variables[0]?.porBola.length ?? 0;

  // Red masa-resorte destilada: cada bola colocada se ata con tirantes a sus
  // DOS vecinas más cercanas del layout ya calculado (topología determinista).
  const destinos = geometria.map((bola) => bola.destino);
  const tirantes = geometria
    .slice(0, aterrizadas)
    .flatMap((bola, k) =>
      vecinasMasCercanas(k, destinos).map((vecina) => ({ de: vecina, a: k })),
    );
  // Propagación local atenuada del aterrizaje: 1er grado = vecinas conectadas
  // de la bola reciente; 2º grado = las vecinas de esas, a mitad de amplitud.
  const reciente = aterrizadas - 1;
  const onda1 = reciente > 0 ? vecinasMasCercanas(reciente, destinos) : [];
  const onda2 = Array.from(
    new Set(onda1.flatMap((vecina) => vecinasMasCercanas(vecina, destinos))),
  ).filter((index) => index !== reciente && !onda1.includes(index));
  function ondaDe(index: number): { grado: 1 | 2; dx: number; dy: number } | null {
    const grado = onda1.includes(index) ? 1 : onda2.includes(index) ? 2 : null;
    if (grado == null || reciente < 0) return null;
    const desde = geometria[reciente].destino;
    const hasta = geometria[index].destino;
    const distancia = Math.hypot(hasta.x - desde.x, hasta.y - desde.y) || 1;
    const amplitud = grado === 1 ? 3.5 : 1.75;
    return {
      grado: grado as 1 | 2,
      dx: ((hasta.x - desde.x) / distancia) * amplitud,
      dy: ((hasta.y - desde.y) / distancia) * amplitud,
    };
  }

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
            aria-label={`Estructura de la muestra: ${fmtInt(aterrizadas)} de ${fmtInt(total)} bolas ensambladas en el orden publicado del sorteo`}
          >
            {/* Tirantes (struts): la bola que llega se ata a sus DOS vecinas
                más cercanas. El del aterrizaje hace preview punteado ~120 ms
                antes del contacto y SNAP sólido al tensarse, vibrando con la
                misma senoide amortiguada del asentamiento. */}
            {tirantes.map((tirante) => {
              const desde = geometria[tirante.de];
              const hasta = geometria[tirante.a];
              const membrana = membranaGoo(
                { ...desde.destino, r: desde.r },
                { ...hasta.destino, r: hasta.r },
              );
              const esReciente = tirante.a === reciente && !reducido;
              return (
                <path
                  key={`tirante-${tirante.de}-${tirante.a}${esReciente ? "-snap" : ""}`}
                  className={`cmv2-relato-goo-membrana${esReciente ? " is-snap" : ""}`}
                  d={membrana.d}
                  style={{ strokeWidth: membrana.grosor.toFixed(2) }}
                />
              );
            })}
            {geometria.map((bola, index) => {
              const enCluster = index < aterrizadas;
              const esReciente = index === reciente && aterrizadas > 0;
              const onda = enCluster && !esReciente && !reducido ? ondaDe(index) : null;
              const bobbing = bobbingDeBola(index);
              const pos = enCluster ? bola.destino : bola.origen;
              const anillo = enCluster && !escena.encoge && (bola.paso.yaCubiertos ?? 0) > 0;
              const detalle = [
                bola.paso.etiqueta,
                bola.paso.facultad,
                cifraDeAterrizaje(bola.paso, escena.encoge),
                escena.encoge && bola.paso.bruto != null && bola.paso.neto != null
                  ? `${fmtInt(bola.paso.bruto)} → ${fmtInt(bola.paso.neto)} netos`
                  : "",
                (bola.paso.yaCubiertos ?? 0) > 0 ? `${fmtInt(bola.paso.yaCubiertos)} ya cubiertos` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <g
                  key={`${bola.paso.paso}-${bola.paso.code}${esReciente ? "-aterriza" : ""}${onda ? `-onda${aterrizadas}` : ""}`}
                  tabIndex={0}
                  className={[
                    "cmv2-relato-goo-bola",
                    "is-sorteada",
                    enCluster ? "is-ensamblada" : "is-espera",
                    esReciente && !reducido ? "is-aterrizando" : "",
                    onda ? `is-onda-${onda.grado}` : "",
                    bola.paso.certeza ? "is-certeza" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    // Estado en reposo: espera en el borde del bombo o ya en su
                    // sitio del cluster; las animaciones (aterrizaje/onda, con
                    // las vars del dato) mandan mientras corren.
                    transform: `translate(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px)`,
                    ["--relato-i" as string]: String(Math.min(index, 24)),
                    ["--goo-sombra" as string]: `${Math.max(0.4, bola.r * 0.14).toFixed(2)}px`,
                    ["--wob-dur" as string]: bobbing.duracion,
                    ["--wob-delay" as string]: bobbing.fase,
                    ["--ox" as string]: `${bola.origen.x.toFixed(2)}px`,
                    ["--oy" as string]: `${bola.origen.y.toFixed(2)}px`,
                    ["--mx" as string]: `${bola.arco.x.toFixed(2)}px`,
                    ["--my" as string]: `${bola.arco.y.toFixed(2)}px`,
                    ["--tx" as string]: `${bola.destino.x.toFixed(2)}px`,
                    ["--ty" as string]: `${bola.destino.y.toFixed(2)}px`,
                    // Estiramiento tangente en vuelo: el ángulo del arco.
                    ["--rot" as string]: `${anguloDeVuelo(bola.origen, bola.destino).toFixed(1)}deg`,
                    // Propagación atenuada: empujón unitario desde la reciente.
                    ...(onda
                      ? {
                          ["--ondx" as string]: `${onda.dx.toFixed(2)}px`,
                          ["--ondy" as string]: `${onda.dy.toFixed(2)}px`,
                        }
                      : {}),
                  }}
                >
                  <title>{`Paso ${fmtInt(bola.paso.paso)} · ${bola.paso.code} · ${detalle}`}</title>
                  <circle className="cmv2-relato-goo-cuerpo" r={bola.r.toFixed(2)} />
                  <circle
                    className="cmv2-relato-goo-brillo"
                    r={(bola.r * 0.34).toFixed(2)}
                    cx={(-bola.r * 0.32).toFixed(2)}
                    cy={(-bola.r * 0.36).toFixed(2)}
                  />
                  {bola.paso.certeza && (
                    <circle className="cmv2-relato-goo-doble" r={Math.max(0.8, bola.r - 1.1).toFixed(2)} />
                  )}
                  {anillo && <circle className="cmv2-relato-goo-anillo" r={(bola.r + 0.9).toFixed(2)} />}
                  {enCluster && (
                    <text className="cmv2-relato-goo-paso" dy="0.9">{fmtInt(bola.paso.paso)}</text>
                  )}
                  {enCluster ? (
                    <text
                      className={`cmv2-relato-goo-rotulo${esReciente ? " is-reciente" : ""}`}
                      y={bola.r + 2.6}
                    >
                      {bola.paso.code}
                      {esReciente ? ` · ${cifraDeAterrizaje(bola.paso, escena.encoge)}` : ""}
                    </text>
                  ) : (
                    /* Bola viva (c): hover/focus revela código y cifra AL
                       INSTANTE, sin transición de entrada. */
                    <text className="cmv2-relato-goo-rotulo is-hover" y={bola.r + 2.6}>
                      {bola.paso.code} · {cifraDeAterrizaje(bola.paso, escena.encoge)}
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
                ? ` · ${ultima.paso.code} · ${cifraDeAterrizaje(ultima.paso, escena.encoge)}`
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
