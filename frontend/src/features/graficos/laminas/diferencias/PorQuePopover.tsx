// U3 · «Por qué» (`?foco=<slide.id>&panel=diferencias-lamina`; propuesta de significancia §3.5). Una sola capa a la
// vez, anclada a quien la abrió («Ver por qué» del inspector o, desde un enlace, el visor de la lámina). Va por portal
// y en `position: fixed` con su propio scroll: ni el lienzo ni el inspector la recortan (C4). El portal cae en el marco
// de la página para conservar sus tokens; los de la cápsula viven en `:root` (tokens-datos.css) y resuelven igual.
//
// El par elegido es estado efímero del feature (store): `foco` ya nombra la lámina y no se reutiliza para la celda.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "../../../../vendor/lucide-react";
import type { LaminaDiferencias, ParDiferencias, ReglaDiferencias } from "../../../../api/graficosDiferencias";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { PulsoButton } from "../../../../components/PulsoButton";
import { toast } from "../../../../components/toasterStore";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { copiarTexto } from "../../../../lib/portapapeles";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { PANEL_DIFERENCIAS_LAMINA } from "../../panelesGraficos";
import { capaVisibleFuera, escucharEscape } from "../cierreConEscape";
import { enfocarSinDesplazar } from "../enfocarSinDesplazar";
import { Capsula } from "./Capsula";
import {
  condicionesPar,
  esMarcado,
  formatoP,
  formatoPuntos,
  frasePar,
  nombreCorreccion,
  nombrePrueba,
  parInicial,
  redaccionLamina,
} from "./modeloDiferencias";
import { useDiferenciasUi } from "./store";
import { useClaveDiferencias, useDiferenciasLamina } from "./useDiferencias";
import "./diferencias.css";

const MARGEN = 10;
const SEPARACION = 8;
const ANCHO = 640;

type Props = { slideId: string | null };

export function PorQuePopover({ slideId }: Props) {
  const panel = usePanelDireccionable(PANEL_DIFERENCIAS_LAMINA);
  if (!panel.abierto || !slideId) return null;
  return <CapaPorQue slideId={slideId} cerrarPanel={panel.cerrar} panelProps={panel.props} />;
}

/** El ancla visible: «Ver por qué» del inspector si está a la vista; si no, el visor de la lámina. */
function buscarAncla(): HTMLElement | null {
  const visibles = [...document.querySelectorAll<HTMLElement>("[data-sig-ancla]")].filter((el) => el.getClientRects().length > 0);
  return visibles[0] ?? document.querySelector<HTMLElement>(".pulso-f6-visor");
}

/** Posición de la capa: bajo el ancla y alineada a su borde derecho; arriba si no cabe; siempre dentro del viewport. */
export function posicionCapa(
  ancla: Pick<DOMRect, "top" | "bottom" | "left" | "right">,
  capa: { width: number; height: number },
  vista: { width: number; height: number },
  dentroDelAncla: boolean,
): { top: number; left: number } {
  const maxLeft = Math.max(MARGEN, vista.width - capa.width - MARGEN);
  const maxTop = Math.max(MARGEN, vista.height - capa.height - MARGEN);
  if (dentroDelAncla) {
    return { top: Math.min(Math.max(ancla.top + 16, MARGEN), maxTop), left: Math.min(Math.max(ancla.left + 16, MARGEN), maxLeft) };
  }
  let top = ancla.bottom + SEPARACION;
  if (top + capa.height > vista.height - MARGEN && ancla.top - capa.height - SEPARACION >= MARGEN) top = ancla.top - capa.height - SEPARACION;
  return { top: Math.min(Math.max(top, MARGEN), maxTop), left: Math.min(Math.max(ancla.right - capa.width, MARGEN), maxLeft) };
}

function CapaPorQue({ slideId, cerrarPanel, panelProps }: { slideId: string; cerrarPanel: () => void; panelProps: { "data-pulso-panel": string } }) {
  const clave = useClaveDiferencias(slideId);
  const { carga } = useDiferenciasLamina(slideId, clave, true);
  const elegido = useDiferenciasUi((s) => s.parElegido[slideId]);
  const elegirPar = useDiferenciasUi((s) => s.elegirPar);
  const raizRef = useRef<HTMLElement>(null);
  const anclaRef = useRef<HTMLElement | null>(null);
  const [estilo, setEstilo] = useState<CSSProperties>({ position: "fixed", top: MARGEN, left: MARGEN, visibility: "hidden" });

  const datos = carga && carga.estado !== "error" ? carga.datos : undefined;
  const lamina = datos?.lamina ?? null;
  const pares = lamina?.pares ?? [];
  const indice = pares.length ? Math.min(Math.max(elegido ?? parInicial(pares), 0), pares.length - 1) : 0;

  const reposicionar = useCallback(() => {
    const ancla = anclaRef.current?.isConnected ? anclaRef.current : buscarAncla();
    anclaRef.current = ancla;
    const capa = raizRef.current;
    if (!capa) return;
    const vista = { width: window.innerWidth, height: window.innerHeight };
    const ancho = Math.min(ANCHO, vista.width - 2 * MARGEN);
    capa.style.width = `${ancho}px`;
    const rect = ancla?.getBoundingClientRect() ?? { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN + ancho };
    const { top, left } = posicionCapa(rect, { width: ancho, height: capa.offsetHeight }, vista, !ancla || ancla.matches(".pulso-f6-visor"));
    setEstilo({ position: "fixed", top: Math.round(top), left: Math.round(left), width: ancho, maxHeight: vista.height - 2 * MARGEN });
  }, []);

  useLayoutEffect(() => { reposicionar(); }, [reposicionar, lamina, indice]);
  useEffect(() => {
    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    return () => {
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("scroll", reposicionar, true);
    };
  }, [reposicionar]);

  const cerrar = useCallback(() => {
    const volver = anclaRef.current;
    cerrarPanel();
    requestAnimationFrame(() => enfocarSinDesplazar(volver?.isConnected ? volver : null));
  }, [cerrarPanel]);
  useEffect(() => escucharEscape(document, cerrar, () => capaVisibleFuera(document, raizRef.current)), [cerrar]);
  // Un clic fuera la cierra (una sola capa a la vez); en el ancla no, que la volvería a abrir.
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (raizRef.current?.contains(t) || anclaRef.current?.contains(t)) return;
      if ((t as Element).closest?.("[role=dialog], [role=listbox], .pulso-toaster")) return;
      cerrar();
    };
    window.addEventListener("pointerdown", fuera, true);
    return () => window.removeEventListener("pointerdown", fuera, true);
  }, [cerrar]);
  // Al abrir, el foco entra a la capa (teclado: Tab recorre sus controles, Escape la cierra).
  useEffect(() => {
    const marco = requestAnimationFrame(() => enfocarSinDesplazar(raizRef.current));
    return () => cancelAnimationFrame(marco);
  }, []);

  const destino = typeof document === "undefined" ? null : (anclaRef.current ?? buscarAncla())?.closest<HTMLElement>(".pulso-page-frame") ?? document.body;
  const par = pares[indice] ?? null;
  const contenido = (
    <section
      ref={raizRef}
      {...panelProps}
      className="pulso-sig-porque"
      style={estilo}
      tabIndex={-1}
      aria-label={par ? `Por qué se marca: ${par.fila}` : "Por qué se marca"}
      data-audit-ready={datos || carga?.estado === "error" ? "graficos-diferencias-lamina" : "false"}
      data-qa-surface="graficos/diferencias-lamina"
      data-qa-scroll-owner="diferencias-lamina"
      data-qa-geometry-group="graficos/diferencias-lamina"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-sig-porque-cabeza" data-qa-geometry-member="">
        <h2>Diferencias de esta lámina</h2>
        <span className="pulso-sig-espacio" />
        <PulsoButton variant="icon" size="sm" aria-label="Cerrar «Por qué»" onClick={cerrar}>
          <X size={16} aria-hidden="true" />
        </PulsoButton>
      </header>
      <div className="pulso-sig-porque-cuerpo" data-qa-geometry-member="">
        {carga?.estado === "error" ? (
          <p className="pulso-sig-caja is-peligro pulso-sig-texto" role="alert">
            {carga.message || "No se pudieron leer las diferencias."}{carga.code ? <> · <code>{carga.code}</code></> : null}
          </p>
        ) : !lamina ? (
          <p className="pulso-sig-texto" role="status">Leyendo las diferencias de la lámina…</p>
        ) : !par || !datos ? (
          <p className="pulso-sig-caja pulso-sig-texto">{lamina.estado === "abstencion" ? (lamina.motivo ?? lamina.nota) : "Esta lámina no tiene pares comparados."}</p>
        ) : (
          <>
            <DetallePar lamina={lamina} regla={datos.regla} par={par} indice={indice} total={pares.length}
              onMover={(paso) => elegirPar(slideId, (indice + paso + pares.length) % pares.length)} />
            <TablaPares lamina={lamina} indice={indice} onElegir={(i) => elegirPar(slideId, i)} />
          </>
        )}
      </div>
    </section>
  );
  return destino ? createPortal(contenido, destino) : contenido;
}

function DetallePar({ lamina, regla, par, indice, total, onMover }: {
  lamina: LaminaDiferencias; regla: ReglaDiferencias; par: ParDiferencias; indice: number; total: number; onMover: (paso: number) => void;
}) {
  const nA = par.n_a ?? lamina.grupos.find((g) => g.letra === par.a)?.n ?? null;
  const nB = par.n_b ?? lamina.grupos.find((g) => g.letra === par.b)?.n ?? null;
  const condiciones = condicionesPar(par, lamina.grupos, regla);
  const copiar = () => {
    copiarTexto(par.redaccion).then(() => toast.exito("Redacción copiada")).catch(() => toast.error("No se pudo copiar la redacción"));
  };
  return (
    <article className="pulso-sig-detalle" aria-live="polite">
      <div className="pulso-sig-detalle-cabeza">
        {esMarcado(par) && <Capsula letras={par.a === "resto" ? "" : par.b} menor={par.a === "resto"} fragil={par.veredicto === "fragil"} />}
        <strong>{par.fila}</strong>
        <span className="pulso-sig-espacio" />
        <span className="pulso-sig-texto">{indice + 1} de {total}</span>
        <PulsoButton variant="icon" size="sm" aria-label="Par anterior" onClick={() => onMover(-1)} disabled={total < 2}>
          <ChevronLeft size={14} aria-hidden="true" />
        </PulsoButton>
        <PulsoButton variant="icon" size="sm" aria-label="Par siguiente" onClick={() => onMover(1)} disabled={total < 2}>
          <ChevronRight size={14} aria-hidden="true" />
        </PulsoButton>
      </div>
      <p className="pulso-sig-frase">{frasePar(par, lamina.grupos)}</p>
      <dl className="pulso-sig-datos">
        <dt>p ajustado</dt><dd>{formatoP(par.p_ajustado)}</dd>
        <dt>Prueba</dt><dd>{nombrePrueba(regla)} · {nombreCorreccion(regla)}</dd>
        <dt>Bases</dt><dd>{nA !== null && nB !== null ? `${formatoConteo(nA)} y ${formatoConteo(nB)} casos` : "—"}</dd>
        <dt>Efecto de diseño</dt><dd>{par.deff === null ? "—" : formatoDecimal(par.deff, 2)}</dd>
        <dt>Intervalo</dt><dd>{par.ic ? `${formatoPuntos(par.ic[0])} a ${formatoPuntos(par.ic[1])} puntos` : "—"}</dd>
      </dl>
      <ul className="pulso-sig-condiciones" aria-label="Condiciones para marcar">
        {condiciones.map((c) => (
          <li key={c.clave} className={c.cumple ? "is-cumple" : "is-falla"}>
            {c.cumple ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
            <span className="pulso-sr-only">{c.cumple ? "Cumple: " : "No cumple: "}</span>{c.rotulo}
          </li>
        ))}
      </ul>
      {par.veredicto === "fragil" && (
        <p className="pulso-sig-caja is-aviso pulso-sig-texto">Frágil: p ajustado entre 0.01 y {regla.alfa.toFixed(2)}. Redáctala con prudencia y no la lleves a conclusiones.</p>
      )}
      {par.redaccion && (
        <div className="pulso-sig-acciones">
          <PulsoButton variant="secondary" size="sm" onClick={copiar}><Copy size={14} aria-hidden="true" /> Copiar redacción</PulsoButton>
        </div>
      )}
    </article>
  );
}

type FilaPar = { par: ParDiferencias; i: number };

function TablaPares({ lamina, indice, onElegir }: { lamina: LaminaDiferencias; indice: number; onElegir: (i: number) => void }) {
  const filas: FilaPar[] = lamina.pares.map((par, i) => ({ par, i }));
  const columnas: PulsoTableColumna<FilaPar>[] = [
    // La capa mide 640 px y la tabla vive en su columna derecha (~300 px): 4 columnas, 276 px, sin scroll horizontal (C4).
    // El par (B > A) lo dice la cápsula; el veredicto sin marca va abreviado y entero en el `title`.
    { id: "fila", encabezado: "Fila", ancho: 108, celda: ({ par }) => par.fila, valor: ({ par }) => par.fila },
    { id: "dif", encabezado: "Dif.", ancho: 46, tipo: "cifra", celda: ({ par }) => formatoPuntos(par.dif) },
    { id: "p", encabezado: "p aj.", ancho: 62, tipo: "cifra", celda: ({ par }) => formatoP(par.p_ajustado) },
    {
      id: "marca", encabezado: "Marca", ancho: 60, valor: ({ par }) => `${par.a} > ${par.b}: ${ROTULO_VEREDICTO[par.veredicto]}`,
      celda: ({ par }) => (esMarcado(par) ? <Capsula letras={par.a === "resto" ? "" : par.b} menor={par.a === "resto"} fragil={par.veredicto === "fragil"} /> : <span className="pulso-sig-texto">{ABREVIADO[par.veredicto]}</span>),
    },
  ];
  const redaccion = redaccionLamina(lamina.pares);
  return (
    <div className="pulso-sig-pares">
      <PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => String(f.i)} ariaLabel="Pares de grupos de la lámina" densidad="compacta"
        seleccionada={String(indice)} onSeleccionar={(id) => onElegir(Number(id))} altoMaximo={260} vacio="Sin pares comparados." />
      <p className="pulso-sig-texto">Las cifras sin marca son el grupo menor de su par: la marca la lleva el mayor.</p>
      {redaccion && (
        <div className="pulso-sig-caja">
          <strong className="pulso-sig-titulo">Redacción sugerida</strong>
          <p className="pulso-sig-texto">{redaccion}</p>
        </div>
      )}
    </div>
  );
}

const ABREVIADO: Readonly<Record<ParDiferencias["veredicto"], string>> = {
  marcada: "▲", fragil: "△", bajo_umbral: "< umbral", no_significativa: "n. s.", no_comparable: "n. c.",
};

const ROTULO_VEREDICTO: Readonly<Record<ParDiferencias["veredicto"], string>> = {
  marcada: "Marcada",
  fragil: "Frágil",
  bajo_umbral: "Bajo el umbral",
  no_significativa: "No sig.",
  no_comparable: "No se compara",
};
