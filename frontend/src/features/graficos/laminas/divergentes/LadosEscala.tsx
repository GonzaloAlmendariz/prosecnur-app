// «Lados de la escala» de la divergente (oleada I2, ítem 4): reemplaza a `n_negativas`, `incluir_neutro` y
// `direccion_escala` en la lista genérica. Una tira con los niveles sustantivos coloreados en negativo, neutro y
// positivo; el asa es el borde del lado negativo y se arrastra con el mouse o con las flechas (rol de slider). Clic en
// el nivel central lo parte o no a cada lado; el botón de flechas invierte los lados. Debajo, «Negativo 21%, Positivo
// 64%» del detalle del motor con el reparto que se está viendo (también mientras se arrastra). R7-7: mientras llega el
// detalle, la silueta de la tira (no los tres controles, que asomaban más de 2,5 s y luego se cambiaban por la tira); sólo
// sin detalle (o sin categorías) quedan los tres controles de siempre (`respaldo`).
//
// Superficie intrínseca (C1): crece con su tira; los niveles reparten el ancho y su rótulo se recorta con title (C4).

import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ArrowLeftRight } from "../../../../vendor/lucide-react";
import { AyudaGlobo } from "../AyudaGlobo";
import { rotuloVisible } from "../rotuloCortoDeLista";
import { useRotulosCortos } from "../useRotulosCortos";
import { Skeleton } from "../../../../components/Skeleton";
import { CifraEstado } from "../cifrasInspector/CifraEstado";
import { useDetalleCifras } from "../cifrasInspector/useDetalleCifras";
import { useCifraEnVivo } from "../reglaPreguntas/useCifraEnVivo";
import { bordeVisual, central, kDesdeBorde, leerLados, parcheLados, repartoLados, sustantivas, textoLados, trasClicCentral, type Lados } from "./modeloLados";
import "./ladosEscala.css";

type Props = {
  id: string;
  graficador: string;
  scope: "active" | "consolidated";
  args: Readonly<Record<string, unknown>>;
  onCambio: (patch: Record<string, unknown>) => void;
  /** Los tres controles de siempre, para cuando no hay detalle. */
  respaldo: ReactNode;
};

const AYUDA = "Arrastra el asa (o usa las flechas) para decidir cuántos niveles van al lado negativo. Clic en el nivel central lo parte mitad a cada lado.";
const NOMBRE_LADO = { neg: "negativo", neu: "neutro, partido", pos: "positivo" } as const;

export function LadosEscala({ id, graficador, scope, args, onCambio, respaldo }: Props) {
  const cortos = useRotulosCortos();
  const tira = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  // Las categorías salen del detalle de lo guardado (o del último que llegó).
  const base = useDetalleCifras(graficador, scope, [{ clave: "guardado", args }]).guardado;
  const cats = sustantivas(base?.detalle ?? null);
  const n = cats.length;
  const guardado = leerLados(args, Math.max(n, 2));
  const enVivo = useCifraEnVivo(guardado.k, `${n}|${guardado.direccion}|${guardado.incluirNeutro}`, (k) => onCambio(parcheLados({ ...guardado, k })));
  const vista: Lados = { ...guardado, k: enVivo.valor };
  // Las cifras del reparto que se ve: con el borrador, antes de soltar (sin borrador no se pide nada más).
  const borrador = useDetalleCifras(graficador, scope, enVivo.enVivo ? [{ clave: "vista", args: { ...args, ...parcheLados(vista) } }] : []).vista;
  // Mientras llega la primera cifra del borrador, la de lo guardado atenuada.
  const cifras = !enVivo.enVivo ? base : borrador && (borrador.detalle || borrador.vigente) ? borrador : base && { ...base, vigente: false };
  // Cargando: aún no llegó ningún detalle de lo guardado (ni uno anterior). Sin detalle: llegó y no hay.
  const cargando = !!base && !base.sinDetalle && !base.detalle;
  if (n < 2 && cargando) return <SiluetaLados />;
  if (n < 2) return <>{respaldo}</>;

  const lados = repartoLados(n, vista);
  const borde = bordeVisual(n, vista);
  const medio = central(n);
  const partido = lados.includes("neu");
  const moverA = (b: number) => enVivo.mover(kDesdeBorde(n, b, vista.direccion));
  const bordeDe = (x: number) => {
    const r = tira.current?.getBoundingClientRect();
    return r && r.width > 0 ? ((x - r.left) / r.width) * n : borde;
  };
  const alPresionar = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    arrastrando.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    moverA(bordeDe(e.clientX));
  };
  const alSoltar = () => { if (!arrastrando.current) return; arrastrando.current = false; enVivo.soltar(); };
  const alTeclear = (e: KeyboardEvent<HTMLSpanElement>) => {
    const destino = e.key === "ArrowRight" || e.key === "ArrowUp" ? borde + 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? borde - 1
      : e.key === "Home" ? 1 : e.key === "End" ? n - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    moverA(destino);
  };
  const idRotulo = `${id}-rotulo`;
  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-lados" data-campo="n_negativas"
      data-qa-geometry-group="graficos/f6-lados" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-lados-cabeza">
        <span className="pulso-f6-dato-rotulo" id={idRotulo}>Lados de la escala<AyudaGlobo rotulo="Lados de la escala" detalle={AYUDA} /></span>
        <button type="button" className="pulso-f6-icono-boton" aria-pressed={vista.direccion === "positivo_negativo"}
          aria-label="Invertir los lados" title="Invertir los lados: los primeros niveles son los positivos"
          onClick={() => onCambio(parcheLados({ ...vista, direccion: vista.direccion === "positivo_negativo" ? "negativo_positivo" : "positivo_negativo" }))}>
          <ArrowLeftRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div ref={tira} className="pulso-f6-lados-tira" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        onPointerDown={alPresionar} onPointerMove={(e) => { if (arrastrando.current) moverA(bordeDe(e.clientX)); }}
        onPointerUp={alSoltar} onPointerCancel={alSoltar}>
        {cats.map((c, i) => {
          const r = rotuloVisible(cortos, c);
          const titulo = `${r.completo ?? r.texto}: ${NOMBRE_LADO[lados[i]]}`;
          return i === medio ? (
            <button key={c} type="button" className={`pulso-f6-lados-nivel is-${lados[i]} is-central`} aria-pressed={partido}
              aria-label={`Partir el neutro: ${r.completo ?? r.texto}`} title={titulo}
              onClick={() => onCambio(parcheLados(trasClicCentral(n, vista)))}>{r.texto}</button>
          ) : (
            <span key={c} className={`pulso-f6-lados-nivel is-${lados[i]}`} title={titulo}>{r.texto}</span>
          );
        })}
        <span className="pulso-f6-lados-carril" style={{ transform: `translateX(${(borde / n) * 100}%)` }}>
          <span role="slider" tabIndex={0} className="pulso-f6-lados-asa" aria-labelledby={idRotulo} aria-orientation="horizontal"
            aria-valuemin={1} aria-valuemax={n - 1} aria-valuenow={vista.k}
            aria-valuetext={`${vista.k} ${vista.k === 1 ? "nivel negativo" : "niveles negativos"} de ${n}`}
            onKeyDown={alTeclear} onKeyUp={() => enVivo.soltar()} onBlur={() => enVivo.soltar()} />
        </span>
      </div>
      <CifraEstado texto={textoLados(cifras?.detalle ?? null)} vigente={!!cifras?.vigente} esperando={!!cifras && !cifras.vigente} qa="lados-cifra" />
    </div>
  );
}

/** La silueta de la tira mientras llega el detalle: misma cabecera, una tira y la línea de la cifra (R7-7). */
function SiluetaLados() {
  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-lados" data-campo="n_negativas" role="status" aria-busy="true" data-qa="lados-silueta"
      data-qa-geometry-group="graficos/f6-lados" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-lados-cabeza">
        <span className="pulso-f6-dato-rotulo">Lados de la escala</span>
      </div>
      <Skeleton forma="fila" className="pulso-f6-lados-silueta" />
      <Skeleton forma="texto" ancho="14ch" />
      <span className="pulso-sr-only">Cargando los niveles de la escala</span>
    </div>
  );
}
