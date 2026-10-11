/**
 * TabHeading — la cabecera única de pestaña (remasterización L14).
 *
 * Hoy hay doce maneras de decir «estás en esta pestaña» (Carga «Pestaña 2 de
 * 5», Validación «Vista actual», Monitoreo con breadcrumb y bandas, Cálculo en
 * una fila…). Este componente es la única: un grid de cuatro pistas
 *
 *   tile de ícono · copy · control de sección · chips de contexto
 *
 * y tres variantes del MISMO marco: estándar (62 px), compacta (40 px, sin
 * eyebrow visible ni detalle) y con control de sección (lo que manda sobre
 * toda la sección —el selector de facultad de Cursos-horario— vive aquí y no se
 * mueve con el scroll).
 *
 * Reglas que el componente garantiza y un patrón copiado no:
 *
 * - **El `h2` es el nombre de la pestaña**, solo. El estado va al lado como
 *   PALABRA (Listo · Parcial · Bloqueado), fuera del `h2`, para que el nombre
 *   accesible del encabezado no sea «Resumen Listo». Nunca un punto sobre el
 *   ícono.
 * - **El detalle se omite si repite el título** (medido en Telefónico ›
 *   Fuentes: «Fuentes / Universo y barrido / Universo y barrido»).
 * - **«pestaña n de m» solo con ambos números**: es para pipelines reales, no
 *   un adorno que cada página inventa.
 * - **El marco no deriva de los datos (C2)**: el alto lo fija la variante, no
 *   cuántos chips llegan. Los chips son una fila que no envuelve; cuando el
 *   ancho no alcanza se recogen a un menú, con la misma escalera de rangos que
 *   `ModuleCommandBar` (`rank: 1` no se recoge jamás). Un chip recogido sigue a
 *   un click y conserva su base.
 *
 * El acento del módulo no se inyecta: el tile lo hereda de `--module-accent`,
 * que declara el frame del módulo. Un `style` con el tono sería un segundo
 * mecanismo de paleta.
 */

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Popover } from "./Popover";
import { PulsoButton } from "./PulsoButton";
import { MoreHorizontal, type LucideIcon } from "../vendor/lucide-react";
import "./kit-tab-heading.css";

export type TabHeadingEstado = "listo" | "parcial" | "bloqueado";

export const ETIQUETA_ESTADO_TAB: Readonly<Record<TabHeadingEstado, string>> = {
  listo: "Listo",
  parcial: "Parcial",
  bloqueado: "Bloqueado",
};

/** Cuánto sobrevive un chip cuando el ancho aprieta. Misma escala que la command bar. */
export type TabHeadingChipRank = 1 | 2 | 3;

export type TabHeadingChipTono = "neutral" | "ok" | "warn" | "accent";

export type TabHeadingChip = {
  id: string;
  /** Lo que se cuenta: «válidas», «fuentes», «meta». */
  label: string;
  /** La cifra, ya formateada por quien la conoce. Se pinta tabular y en negrita. */
  valor: string | number;
  /** El denominador de la cifra: «13» en «13/13 fuentes». Una cifra sin base miente por omisión. */
  base?: string | number;
  /** 1 = nunca se recoge; 2 por defecto; 3 = lo primero en irse al menú. */
  rank?: TabHeadingChipRank;
  tono?: TabHeadingChipTono;
};

/** Cuántos chips caben sueltos antes de recoger. Deriva del ancho, no del gusto. */
export type TabHeadingDensidad = "normal" | "compact" | "tight";

export type TabHeadingProps = {
  /** Sección (o módulo) a la que pertenece la pestaña. 11/600 en versalitas. */
  eyebrow: string;
  /** Nombre de la pestaña activa. Se pinta como `h2`. */
  titulo: string;
  /** El mismo ícono que la pestaña activa del rail: cierra el vínculo rail → cabecera. */
  icono: LucideIcon;
  estado?: TabHeadingEstado;
  /** El `detail` del catálogo. Se omite si repite el título. */
  detalle?: string;
  /** «pestaña n de m»: solo se pinta cuando llegan los dos números. */
  pestanaN?: number;
  pestanaDe?: number;
  /** Control que manda sobre TODA la sección (selector de facultad, de base…). */
  control?: ReactNode;
  chips?: readonly TabHeadingChip[];
  /** Variante de 40 px: sin eyebrow visible ni detalle. */
  compacta?: boolean;
  /**
   * Fuerza la densidad de los chips. Sin ella se deriva del ancho real de la
   * cabecera (ResizeObserver); en el servidor y en el primer render es `normal`.
   */
  densidad?: TabHeadingDensidad;
  /** Solo para el QA visual o un anclaje de layout. No para estilar. */
  className?: string;
};

/* -------------------------------------------------------------------------- */
/* Lógica pura (testeable sin DOM)                                             */
/* -------------------------------------------------------------------------- */

function normalizar(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

/** El detalle que vale la pena pintar: ninguno si está vacío o repite el título. */
export function detalleUtil(titulo: string, detalle: string | undefined): string | null {
  if (!detalle || !detalle.trim()) return null;
  return normalizar(detalle) === normalizar(titulo) ? null : detalle;
}

/** «Carga · pestaña 2 de 5», o solo «Carga» si falta alguno de los dos números. */
export function textoEyebrow(eyebrow: string, pestanaN?: number, pestanaDe?: number): string {
  const tieneNumeracion =
    typeof pestanaN === "number"
    && typeof pestanaDe === "number"
    && Number.isFinite(pestanaN)
    && Number.isFinite(pestanaDe)
    && pestanaN >= 1
    && pestanaDe >= pestanaN;
  if (!tieneNumeracion) return eyebrow;
  return eyebrow ? `${eyebrow} · pestaña ${pestanaN} de ${pestanaDe}` : `Pestaña ${pestanaN} de ${pestanaDe}`;
}

/** Cuántos chips no-forzados se muestran sueltos, por densidad. */
export const CHIPS_VISIBLES_POR_DENSIDAD: Readonly<Record<TabHeadingDensidad, number>> = {
  normal: 4,
  compact: 2,
  tight: 0,
};

/**
 * Reparte los chips entre la fila y el menú. Mismo criterio que
 * `ModuleCommandBar`: el orden de supervivencia es el rank, y `rank: 1` no se
 * recoge jamás. Dentro de la fila se conserva el orden de declaración, porque
 * es el orden de lectura que eligió la página.
 */
export function repartirChips(
  chips: readonly TabHeadingChip[],
  densidad: TabHeadingDensidad,
): { visibles: TabHeadingChip[]; recogidos: TabHeadingChip[] } {
  const rankDe = (chip: TabHeadingChip) => chip.rank ?? 2;
  const forzados = chips.filter((chip) => rankDe(chip) === 1);
  const opcionales = chips
    .map((chip, indice) => ({ chip, indice }))
    .filter(({ chip }) => rankDe(chip) !== 1)
    .sort((a, b) => rankDe(a.chip) - rankDe(b.chip) || a.indice - b.indice);
  const libres = Math.max(0, CHIPS_VISIBLES_POR_DENSIDAD[densidad] - forzados.length);
  const sueltos = new Set<TabHeadingChip>([...forzados, ...opcionales.slice(0, libres).map(({ chip }) => chip)]);
  return {
    visibles: chips.filter((chip) => sueltos.has(chip)),
    recogidos: opcionales.slice(libres).map(({ chip }) => chip),
  };
}

/** Umbrales sobre el ancho de la cabecera completa (px). */
export function densidadPorAncho(ancho: number, conControl: boolean): TabHeadingDensidad {
  // El control de sección ocupa la pista que de otro modo usarían los chips.
  const holgura = conControl ? 220 : 0;
  if (ancho >= 960 + holgura) return "normal";
  if (ancho >= 680 + holgura) return "compact";
  return "tight";
}

/** Texto plano del chip, para el nombre accesible y el `title`. */
export function textoChip(chip: TabHeadingChip): string {
  const cifra = chip.base === undefined || chip.base === "" ? `${chip.valor}` : `${chip.valor}/${chip.base}`;
  return `${cifra} ${chip.label}`;
}

/* -------------------------------------------------------------------------- */
/* Presentación                                                               */
/* -------------------------------------------------------------------------- */

function useDensidadPorAncho(
  ref: RefObject<HTMLElement>,
  conControl: boolean,
  forzada: TabHeadingDensidad | undefined,
): TabHeadingDensidad {
  const [medida, setMedida] = useState<TabHeadingDensidad>("normal");
  useLayoutEffect(() => {
    if (forzada) return undefined;
    const nodo = ref.current;
    if (!nodo || typeof ResizeObserver === "undefined") return undefined;
    const medir = () => setMedida(densidadPorAncho(nodo.getBoundingClientRect().width, conControl));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [ref, conControl, forzada]);
  return forzada ?? medida;
}

function ChipCifra({ chip }: { chip: TabHeadingChip }) {
  const tieneBase = chip.base !== undefined && chip.base !== "";
  return (
    <>
      <b className="pulso-tab-heading-chip-valor">
        {chip.valor}
        {tieneBase ? <span className="pulso-tab-heading-chip-base">/{chip.base}</span> : null}
      </b>
      <span className="pulso-tab-heading-chip-label">{chip.label}</span>
    </>
  );
}

function TabHeadingChipsMenu({ chips }: { chips: readonly TabHeadingChip[] }) {
  if (chips.length === 0) return null;
  const nombre = `Más datos de la pestaña (${chips.length})`;
  return (
    <Popover
      side="bottom"
      align="end"
      maxWidth={280}
      ariaLabel="Datos de la pestaña"
      trigger={
        <PulsoButton variant="icon" size="sm" aria-label={nombre} title={nombre}>
          <MoreHorizontal size={16} aria-hidden />
        </PulsoButton>
      }
    >
      <ul className="pulso-tab-heading-menu" aria-label="Datos de la pestaña">
        {chips.map((chip) => (
          <li key={chip.id} className="pulso-tab-heading-menu-item" data-tono={chip.tono ?? "neutral"}>
            <ChipCifra chip={chip} />
          </li>
        ))}
      </ul>
    </Popover>
  );
}

export function TabHeading({
  eyebrow,
  titulo,
  icono: Icono,
  estado,
  detalle,
  pestanaN,
  pestanaDe,
  control,
  chips = [],
  compacta = false,
  densidad,
  className,
}: TabHeadingProps) {
  const ref = useRef<HTMLElement>(null);
  const conControl = control !== undefined && control !== null && control !== false;
  const densidadEfectiva = useDensidadPorAncho(ref, conControl, densidad);
  const { visibles, recogidos } = repartirChips(chips, densidadEfectiva);
  const eyebrowTexto = textoEyebrow(eyebrow, pestanaN, pestanaDe);
  const detalleVisible = compacta ? null : detalleUtil(titulo, detalle);

  return (
    <header
      ref={ref}
      className={["pulso-tab-heading", className].filter(Boolean).join(" ")}
      data-variante={compacta ? "compacta" : "estandar"}
      data-con-control={conControl ? "true" : undefined}
      data-densidad={densidadEfectiva}
      data-estado={estado}
      data-qa-geometry-group="tab-heading"
      data-qa-geometry-contract="intrinsic"
    >
      <span className="pulso-tab-heading-icon" aria-hidden="true">
        <Icono size={compacta ? 14 : 17} />
      </span>

      <div className="pulso-tab-heading-copy">
        {eyebrowTexto ? (
          <span className={compacta ? "pulso-sr-only" : "pulso-section-eyebrow pulso-tab-heading-eyebrow"}>
            {eyebrowTexto}
          </span>
        ) : null}
        <div className="pulso-tab-heading-title">
          <h2>{titulo}</h2>
          {estado ? (
            <span className="pulso-tab-heading-estado" data-estado={estado}>
              {ETIQUETA_ESTADO_TAB[estado]}
            </span>
          ) : null}
        </div>
        {detalleVisible ? <p className="pulso-tab-heading-detalle">{detalleVisible}</p> : null}
      </div>

      {conControl ? <div className="pulso-tab-heading-control">{control}</div> : null}

      {chips.length > 0 ? (
        <div className="pulso-tab-heading-chips" role="group" aria-label="Contexto de la pestaña">
          {visibles.map((chip) => (
            <span
              key={chip.id}
              className="pulso-tab-heading-chip"
              data-tono={chip.tono ?? "neutral"}
              title={textoChip(chip)}
            >
              <ChipCifra chip={chip} />
            </span>
          ))}
          <TabHeadingChipsMenu chips={recogidos} />
        </div>
      ) : null}
    </header>
  );
}
