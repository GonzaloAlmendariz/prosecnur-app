// U3 · «Por qué» (`?foco=<slide.id>&panel=diferencias-lamina`; propuesta de significancia §3.5). Una sola capa a la
// vez, anclada a quien la abrió («Ver por qué» del inspector o, desde un enlace, el visor de la lámina). Va por portal
// y en `position: fixed` con su propio scroll: ni el lienzo ni el inspector la recortan (C4). El portal cae en el marco
// de la página para conservar sus tokens; los de la cápsula viven en `:root` (tokens-datos.css) y resuelven igual.
//
// El par elegido es estado efímero del feature (store): `foco` ya nombra la lámina y no se reutiliza para la celda.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "../../../../vendor/lucide-react";
import type { ParDiferencias, ReglaDiferencias, ResultadoDiferencias } from "../../../../api/graficosDiferencias";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { PulsoButton } from "../../../../components/PulsoButton";
import { CabeceraPanel } from "../../../../components/CabeceraPanel";
import { toast } from "../../../../components/toasterStore";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { copiarTexto } from "../../../../lib/portapapeles";
import { formatoConteo, formatoDecimal } from "../../../../lib/formatoNumero";
import { PANEL_DIFERENCIAS_LAMINA } from "../../panelesGraficos";
import { capaVisibleFuera, escucharEscape } from "../cierreConEscape";
import { enfocarSinDesplazar } from "../enfocarSinDesplazar";
import { CajaDiferencias } from "./CajaDiferencias";
import { CodigoError } from "./CodigoError";
import { CargaDeBloque } from "../../../../components/CargaDeBloque";
import { Capsula } from "./Capsula";
import {
  condicionesPar,
  esMarcado,
  formatoP,
  formatoPuntos,
  frasePar,
  nombreCorreccion,
  nombrePrueba,
  parDeGrupos,
  parInicial,
  redaccionLamina,
} from "./modeloDiferencias";
import { bloqueConPares, bloquesDeLamina, type BloqueRanura } from "./modeloRanuras";
import { useDiferenciasUi } from "./store";
import { useClaveDiferencias, useDiferenciasLamina, useNombreDeGrafico } from "./useDiferencias";
import "./diferencias.css";
import "./ranurasDiferencias.css";

const MARGEN = 10;
const SEPARACION = 8;
const ANCHO = 720;

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
  const ranuraElegida = useDiferenciasUi((s) => s.ranuraElegida[slideId] ?? null);
  const nombreDe = useNombreDeGrafico(slideId);
  const elegirPar = useDiferenciasUi((s) => s.elegirPar);
  const raizRef = useRef<HTMLElement>(null);
  const anclaRef = useRef<HTMLElement | null>(null);
  const [estilo, setEstilo] = useState<CSSProperties>({ position: "fixed", top: MARGEN, left: MARGEN, visibility: "hidden" });

  const datos = carga && carga.estado !== "error" ? carga.datos : undefined;
  const lamina = datos?.lamina ?? null;
  // Un bloque por ranura con cruce, la del gráfico desde el que se abrió primero; el detalle es del par elegido.
  const bloques = lamina ? bloquesDeLamina(lamina, nombreDe, ranuraElegida) : [];
  const activo = bloqueConPares(bloques, ranuraElegida);
  const varios = bloques.length > 1;
  const pares = activo?.ranura.pares ?? [];
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

  useLayoutEffect(() => { reposicionar(); }, [reposicionar, lamina, indice, activo?.clave]);
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
      data-qa-geometry-group="graficos/diferencias-lamina"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-sig-porque-cabeza" data-qa-geometry-member="">
        <CabeceraPanel titulo="Diferencias de esta lámina" onCerrar={cerrar} etiquetaCerrar="Cerrar diferencias de esta lámina" />
      </header>
      <div className="pulso-sig-porque-cuerpo" data-qa-geometry-member="" data-qa-scroll-owner="diferencias-lamina" data-ranuras={bloques.length}>
        {carga?.estado === "error" ? (
          <CajaDiferencias tono="peligro" role="alert">
            <p className="pulso-sig-texto">
              {carga.message || "No se pudieron leer las diferencias."}<CodigoError code={carga.code} errorId={carga.error_id} />
            </p>
          </CajaDiferencias>
        ) : !lamina ? (
          <CargaDeBloque label="Leyendo las diferencias de la lámina…" />
        ) : !par || !datos || !activo ? (
          varios ? <BloquesSinPares bloques={bloques} /> : (
            <CajaDiferencias><p className="pulso-sig-texto">{lamina.estado === "abstencion" ? (lamina.motivo ?? lamina.nota) : "Esta lámina no tiene pares comparados."}</p></CajaDiferencias>
          )
        ) : (
          <>
            <DetallePar lamina={activo.ranura} titulo={varios ? activo.titulo : ""} regla={datos.regla} par={par} indice={indice} total={pares.length}
              onMover={(paso) => elegirPar(slideId, (indice + paso + pares.length) % pares.length, activo.clave)} />
            {varios ? (
              <div className="pulso-sig-ranuras">
                {bloques.map((b) => (
                  <BloqueDeRanura key={b.clave} bloque={b} indice={b.clave === activo.clave ? indice : null}
                    onElegir={(i) => elegirPar(slideId, i, b.clave)} />
                ))}
                <p className="pulso-sig-texto">{LEYENDA_MARCA}</p>
              </div>
            ) : (
              <TablaPares lamina={activo.ranura} indice={indice} onElegir={(i) => elegirPar(slideId, i, activo.clave)} />
            )}
          </>
        )}
      </div>
    </section>
  );
  return destino ? createPortal(contenido, destino) : contenido;
}

function DetallePar({ lamina, titulo, regla, par, indice, total, onMover }: {
  lamina: ResultadoDiferencias; titulo: string; regla: ReglaDiferencias; par: ParDiferencias; indice: number; total: number; onMover: (paso: number) => void;
}) {
  const nA = par.n_a ?? lamina.grupos.find((g) => g.letra === par.a)?.n ?? null;
  const nB = par.n_b ?? lamina.grupos.find((g) => g.letra === par.b)?.n ?? null;
  const condiciones = condicionesPar(par, lamina.grupos, regla);
  const copiar = () => {
    copiarTexto(par.redaccion).then(() => toast.exito("Redacción copiada")).catch(() => toast.error("No se pudo copiar la redacción"));
  };
  return (
    <article className="pulso-sig-detalle" aria-live="polite">
      {titulo && <p className="pulso-sig-ranura-titulo">{titulo}</p>}
      <div className="pulso-sig-detalle-cabeza">
        {esMarcado(par) && <Capsula letras={par.a === "resto" ? "" : par.b} menor={par.a === "resto"} fragil={par.veredicto === "fragil"} />}
        <strong>{par.fila}</strong>
        <span className="pulso-sig-espacio" />
        <span className="pulso-sig-texto">{indice + 1} de {total}</span>
        <PulsoButton variant="icon" tone="quiet" size="sm" aria-label="Par anterior" onClick={() => onMover(-1)} disabled={total < 2}>
          <ChevronLeft size={14} aria-hidden="true" />
        </PulsoButton>
        <PulsoButton variant="icon" tone="quiet" size="sm" aria-label="Par siguiente" onClick={() => onMover(1)} disabled={total < 2}>
          <ChevronRight size={14} aria-hidden="true" />
        </PulsoButton>
      </div>
      <p className="pulso-sig-frase">{frasePar(par, lamina.grupos)}</p>
      <dl className="pulso-sig-datos">
        <dt>p ajustado</dt><dd>{formatoP(par.p_ajustado)}</dd>
        <dt>Prueba</dt><dd>{nombrePrueba(regla)}, {nombreCorreccion(regla)}</dd>
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
        <CajaDiferencias tono="aviso"><p className="pulso-sig-texto">Frágil: p ajustado entre 0.01 y {regla.alfa.toFixed(2)}. Redáctala con prudencia y no la lleves a conclusiones.</p></CajaDiferencias>
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

/** Una ranura de la lámina con varias: su nombre, y su tabla de pares o la línea que dice por qué no compara. */
function BloqueDeRanura({ bloque, indice, onElegir }: { bloque: BloqueRanura; indice: number | null; onElegir: (i: number) => void }) {
  const r = bloque.ranura;
  return (
    <section className="pulso-sig-ranura" aria-label={bloque.titulo} data-ranura={bloque.clave} data-estado={r.estado}>
      <h3 className="pulso-sig-ranura-titulo">{bloque.titulo}</h3>
      {bloque.aviso ? (
        <p className={`pulso-sig-texto pulso-sig-ranura-aviso${r.estado === "error" ? " is-peligro" : ""}`}>
          {bloque.aviso}{r.estado === "error" && <CodigoError code={r.error?.code} errorId={r.error?.error_id} />}
        </p>
      ) : r.pares.length ? (
        <TablaPares lamina={r} indice={indice} onElegir={onElegir} etiqueta={`Pares de grupos de ${bloque.titulo}`} sinTope />
      ) : (
        <p className="pulso-sig-texto pulso-sig-ranura-aviso">Sin pares comparados.</p>
      )}
    </section>
  );
}

/** Ninguna ranura con pares: un bloque por ranura con su motivo. */
function BloquesSinPares({ bloques }: { bloques: readonly BloqueRanura[] }) {
  return (
    <div className="pulso-sig-ranuras is-completa">
      {bloques.map((b) => <BloqueDeRanura key={b.clave} bloque={b} indice={null} onElegir={() => undefined} />)}
    </div>
  );
}

function TablaPares({ lamina, indice, onElegir, etiqueta = "Pares de grupos de la lámina", sinTope = false }: {
  lamina: ResultadoDiferencias; indice: number | null; onElegir: (i: number) => void; etiqueta?: string;
  /** Con varias ranuras la tabla no se recorta (el cuerpo de la capa es el único que desplaza, C4) y la leyenda va una
   *  sola vez, al pie de los bloques. */
  sinTope?: boolean;
}) {
  const filas: FilaPar[] = lamina.pares.map((par, i) => ({ par, i }));
  const columnas: PulsoTableColumna<FilaPar>[] = [
    // La capa mide 720 px y la tabla vive en su columna derecha (~378 px): 4 columnas, 358 px, sin scroll horizontal aun
    // con la barra de Windows (C4). R12-7: «Fila y par» a 190 px para que el par («36 a 45 años y 24 a 35 años») se lea.
    // El par (B > A) lo dice la cápsula; el veredicto sin marca va abreviado y entero en el `title`.
    // R11-10: cada fila dice qué par compara (antes seis «Masculino» seguidos sin decir entre qué grupos).
    {
      id: "fila", encabezado: "Fila y par", ancho: 190, valor: ({ par }) => `${par.fila}: ${parDeGrupos(par, lamina.grupos)}`,
      celda: ({ par }) => (
        <span className="pulso-sig-fila-par" title={`${par.fila}: ${parDeGrupos(par, lamina.grupos)}`}>
          <span>{par.fila}</span>
          <small>{parDeGrupos(par, lamina.grupos)}</small>
        </span>
      ),
    },
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
      <PulsoTable columnas={columnas} filas={filas} idDeFila={(f) => String(f.i)} ariaLabel={etiqueta} densidad="compacta"
        seleccionada={indice === null ? null : String(indice)} onSeleccionar={(id) => onElegir(Number(id))} altoMaximo={sinTope ? 2000 : 260} vacio="Sin pares comparados." />
      {!sinTope && <p className="pulso-sig-texto">{LEYENDA_MARCA}</p>}
      {redaccion && (
        <CajaDiferencias>
          <strong className="pulso-sig-titulo">Redacción sugerida</strong>
          <p className="pulso-sig-texto">{redaccion}</p>
        </CajaDiferencias>
      )}
    </div>
  );
}

const LEYENDA_MARCA = "Las cifras sin marca son el grupo menor de su par: la marca la lleva el mayor.";

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
