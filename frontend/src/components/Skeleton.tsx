import type { CSSProperties, ReactNode } from "react";

import "./kit-skeleton.css";

/**
 * Skeleton del kit (remasterización L24). Vara: maquetas L04 y L23 de
 * `docs/qa/maqueta-remasterizacion-2026-10-10/`.
 *
 * Una espera se dibuja con la SILUETA de la vista que viene, no con un
 * porcentaje mudo: cabecera de pestaña de 62 px, KPIs, filas, gráfico. Al
 * llegar los datos no hay salto de layout porque el hueco ya tenía su forma.
 *
 * Contrato de readiness (GOAL, trampa «Readiness ≠ render»): un skeleton NUNCA
 * escribe `data-audit-ready`, ni `true` ni `false`. La marca es de la vista que
 * pinta datos; si el skeleton la publicara, el runner capturaría la silueta
 * creyendo que es la pestaña. Lo fija `Skeleton.test.tsx`.
 *
 * Accesibilidad: las piezas son decorativas (`aria-hidden`). Quien anuncia es
 * el contenedor `SkeletonVista` (`role="status"`, `aria-busy`, texto «Cargando
 * …»), salvo que se monte `decorativo` dentro de otra región que ya anuncia.
 *
 * Movimiento: shimmer de 1,4 s (`--pulso-skeleton-shimmer-dur`, derivado de
 * `--motion-dur-panel`); con `prefers-reduced-motion: reduce` no se anima.
 */

export type SkeletonForma = "texto" | "titulo" | "fila" | "kpi" | "card" | "grafico" | "circulo";

export function Skeleton({
  forma = "texto",
  ancho,
  alto,
  className,
}: {
  forma?: SkeletonForma;
  /** Ancho CSS (`"40%"`, `120`). Sin él, la pieza ocupa su pista. */
  ancho?: number | string;
  /** Alto CSS; por defecto lo fija la forma. */
  alto?: number | string;
  className?: string;
}) {
  const style: CSSProperties = {};
  if (ancho !== undefined) style.inlineSize = ancho;
  if (alto !== undefined) style.blockSize = alto;
  return (
    <span
      aria-hidden="true"
      className={["pulso-skeleton", `pulso-skeleton--${forma}`, className].filter(Boolean).join(" ")}
      style={ancho !== undefined || alto !== undefined ? style : undefined}
    />
  );
}

/** Cabecera de pestaña (TabHeading estándar, 62 px): tile · copy · chips. */
function SkeletonCabecera() {
  return (
    <div className="pulso-skeleton-cabecera">
      <Skeleton forma="card" className="pulso-skeleton-cabecera-tile" />
      <div className="pulso-skeleton-cabecera-copy">
        <Skeleton forma="texto" ancho="14%" alto={9} />
        <Skeleton forma="titulo" ancho="24%" />
        <Skeleton forma="texto" ancho="32%" alto={9} />
      </div>
      <div className="pulso-skeleton-cabecera-chips">
        <Skeleton forma="texto" ancho={120} alto={24} className="pulso-skeleton--pastilla" />
        <Skeleton forma="texto" ancho={84} alto={24} className="pulso-skeleton--pastilla" />
      </div>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["pulso-skeleton-panel", className].filter(Boolean).join(" ")}>{children}</div>;
}

function Filas({ n }: { n: number }) {
  return (
    <div className="pulso-skeleton-filas">
      {Array.from({ length: n }, (_, i) => <Skeleton forma="fila" key={i} />)}
    </div>
  );
}

function Kpis({ n }: { n: number }) {
  return (
    <div className="pulso-skeleton-kpis" style={{ "--pulso-skeleton-kpis": n } as CSSProperties}>
      {Array.from({ length: n }, (_, i) => <Skeleton forma="kpi" key={i} />)}
    </div>
  );
}

function Lineas({ anchos }: { anchos: string[] }) {
  return (
    <div className="pulso-skeleton-lineas">
      {anchos.map((ancho, i) => <Skeleton forma="texto" ancho={ancho} key={i} />)}
    </div>
  );
}

/** Banco de trabajo: barra de herramientas, carril de filas y panel lateral. */
function SiluetaWorkbench() {
  return (
    <>
      <div className="pulso-skeleton-barra">
        <Skeleton forma="texto" ancho="28%" alto={34} className="pulso-skeleton--pastilla" />
        <Skeleton forma="texto" ancho="18%" />
      </div>
      <div className="pulso-skeleton-rejilla pulso-skeleton-rejilla--workbench">
        <Panel>
          <Skeleton forma="titulo" ancho="34%" />
          <Filas n={5} />
        </Panel>
        <Panel>
          <Skeleton forma="titulo" ancho="48%" />
          <Kpis n={3} />
          <Lineas anchos={["72%", "54%", "64%"]} />
        </Panel>
      </div>
    </>
  );
}

/** Tabla: franja de KPIs y una tabla con cabecera y filas. */
function SiluetaTabla() {
  return (
    <>
      <Kpis n={4} />
      <Panel className="pulso-skeleton-panel--tabla">
        <Skeleton forma="fila" className="pulso-skeleton--cabecera-tabla" />
        <Filas n={8} />
      </Panel>
    </>
  );
}

/** Tablero: resumen con anillo y KPIs, gráfico, y dos paneles de cifras. */
function SiluetaTablero() {
  return (
    <div className="pulso-skeleton-rejilla pulso-skeleton-rejilla--tablero">
      <Panel>
        <div className="pulso-skeleton-resumen">
          <Lineas anchos={["40%", "70%", "86%"]} />
          <Skeleton forma="circulo" />
        </div>
        <Kpis n={2} />
      </Panel>
      <Panel>
        <Skeleton forma="titulo" ancho="30%" />
        <Skeleton forma="grafico" />
      </Panel>
      <Panel>
        <Skeleton forma="titulo" ancho="56%" />
        <Kpis n={3} />
      </Panel>
      <Panel>
        <Skeleton forma="titulo" ancho="28%" />
        <Kpis n={3} />
      </Panel>
    </div>
  );
}

/** Documento: columna de lectura con título, párrafos y una tarjeta. */
function SiluetaDocumento() {
  return (
    <div className="pulso-skeleton-documento">
      <Skeleton forma="titulo" ancho="46%" />
      <Lineas anchos={["96%", "92%", "88%", "60%"]} />
      <Skeleton forma="card" />
      <Lineas anchos={["94%", "90%", "72%"]} />
    </div>
  );
}

export type SkeletonRail = "estrecho" | "ancho";
export type SkeletonBanda = "seccion" | "comandos";

/**
 * Rail de pestañas a la izquierda. `estrecho`: el de Procesamiento (pista de
 * 40 px dentro de una columna de 56 con gutter). `ancho`: el ContextTabRail de
 * 56 px de Monitoreo.
 */
function SkeletonRailColumna({ tipo }: { tipo: SkeletonRail }) {
  return (
    <div className="pulso-skeleton-rail-columna" data-skeleton-rail={tipo}>
      <div className="pulso-skeleton-rail">
        {Array.from({ length: 5 }, (_, i) => <Skeleton forma="card" className="pulso-skeleton-rail-tile" key={i} />)}
      </div>
    </div>
  );
}

/**
 * Banda propia del módulo, encima de la superficie: `seccion` es la command
 * bar de 52 px con el selector de secciones (Monitoreo, Recopiladores…);
 * `comandos` es la barra de comandos de dos filas del Editor de formularios.
 * Se reserva para que la vista, al montar, no empuje el contenido hacia abajo.
 */
function SkeletonBandaModulo({ tipo }: { tipo: SkeletonBanda }) {
  if (tipo === "comandos") {
    return (
      <div className="pulso-skeleton-banda" data-skeleton-banda={tipo}>
        <div className="pulso-skeleton-banda-fila">
          <Skeleton forma="texto" ancho={160} alto={26} className="pulso-skeleton--pastilla" />
          <Skeleton forma="texto" ancho={96} alto={18} />
          <span className="pulso-skeleton-banda-hueco" />
          <Skeleton forma="texto" ancho={200} alto={30} className="pulso-skeleton--pastilla" />
        </div>
        <div className="pulso-skeleton-banda-fila">
          <Skeleton forma="texto" ancho={160} alto={26} className="pulso-skeleton--pastilla" />
          <span className="pulso-skeleton-banda-hueco" />
          <Skeleton forma="texto" ancho={320} alto={32} className="pulso-skeleton--pastilla" />
        </div>
      </div>
    );
  }
  return (
    <div className="pulso-skeleton-banda" data-skeleton-banda={tipo}>
      <Skeleton forma="texto" ancho={140} alto={30} className="pulso-skeleton--pastilla" />
      <span className="pulso-skeleton-banda-hueco" />
      <Skeleton forma="texto" ancho="min(46%, 560px)" alto={34} className="pulso-skeleton--pastilla" />
      <span className="pulso-skeleton-banda-hueco" />
      <Skeleton forma="texto" ancho={180} alto={28} className="pulso-skeleton--pastilla" />
    </div>
  );
}

export type SkeletonVistaVariante = "workbench" | "tabla" | "tablero" | "documento";

const SILUETAS: Record<SkeletonVistaVariante, () => JSX.Element> = {
  workbench: SiluetaWorkbench,
  tabla: SiluetaTabla,
  tablero: SiluetaTablero,
  documento: SiluetaDocumento,
};

/**
 * Silueta de una vista completa: banda del módulo (opcional), y una superficie
 * con rail (opcional), cabecera de pestaña (opcional) y el cuerpo según el
 * tipo de vista destino. Ocupa la superficie que la contiene y recorta lo que
 * no cabe (es decorativa: no hay nada que alcanzar, así que no crea scroll).
 *
 * La geometría fina (alto de cabecera, gutters) se ajusta con variables CSS
 * `--pulso-skeleton-*` que fija quien la monta, para calzar con la vista real.
 */
export function SkeletonVista({
  variante = "workbench",
  etiqueta,
  decorativo = false,
  rail,
  banda,
  cabecera = true,
  className,
}: {
  variante?: SkeletonVistaVariante;
  /** Rail de pestañas a la izquierda. `true` equivale a `"ancho"`. */
  rail?: boolean | SkeletonRail;
  /** Banda propia del módulo encima de la superficie. */
  banda?: SkeletonBanda;
  /** Cabecera de pestaña (TabHeading). Sin ella, el cuerpo empieza arriba. */
  cabecera?: boolean;
  /** Qué se carga, para el texto accesible: «Cargando Monitoreo…». */
  etiqueta?: string;
  /**
   * `true` cuando la monta una región que ya anuncia (p. ej. la pantalla de
   * warm start, que es `role="status"`): se oculta del árbol accesible.
   */
  decorativo?: boolean;
  className?: string;
}) {
  const Silueta = SILUETAS[variante];
  const tipoRail: SkeletonRail | null = rail === true ? "ancho" : rail || null;
  const clases = [
    "pulso-skeleton-vista",
    `pulso-skeleton-vista--${variante}`,
    tipoRail ? "pulso-skeleton-vista--con-rail" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const silueta = (
    <div className="pulso-skeleton-vista-silueta" aria-hidden={decorativo ? undefined : "true"}>
      {banda ? <SkeletonBandaModulo tipo={banda} /> : null}
      <div className="pulso-skeleton-superficie">
        {tipoRail ? <SkeletonRailColumna tipo={tipoRail} /> : null}
        <div className="pulso-skeleton-vista-principal">
          {cabecera ? <SkeletonCabecera /> : null}
          <div className="pulso-skeleton-vista-cuerpo">
            <Silueta />
          </div>
        </div>
      </div>
    </div>
  );
  if (decorativo) {
    return (
      <div className={clases} data-skeleton-variante={variante} aria-hidden="true">
        {silueta}
      </div>
    );
  }
  return (
    <div
      className={clases}
      data-skeleton-variante={variante}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="pulso-sr-only">{etiquetaDeCarga(etiqueta)}</span>
      {silueta}
    </div>
  );
}

/** Texto accesible de la espera. Puro para poder testearlo. */
export function etiquetaDeCarga(etiqueta?: string): string {
  const limpia = etiqueta?.trim();
  return limpia ? `Cargando ${limpia}…` : "Cargando…";
}
