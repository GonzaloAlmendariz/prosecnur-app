/**
 * **La primitiva de overlay modal** (L1, spec remasterización §5.2).
 *
 * `Dialog` y `Sideover` son las dos caras de una sola pieza montada sobre
 * `@radix-ui/react-dialog`, que da el comportamiento que los 61 diálogos
 * artesanales no tenían: focus trap, Escape, bloqueo del scroll de fondo,
 * `aria-hidden` sobre el resto de la app y foco de vuelta al disparador.
 *
 * Dos modos de apertura, excluyentes:
 *
 * - **Direccionable** (`panel`): el overlay es un panel declarado y se abre por
 *   `?panel=<id>`. Usa `usePanelDireccionable` por dentro: abrir escribe el
 *   param, cerrar lo borra (con `replace`) y la raíz lleva `data-pulso-panel`.
 * - **Controlado** (`open` + `onOpenChange`): para los overlays que todavía no
 *   tienen panel declarado en el manifiesto.
 *
 * El portal sale del frame del módulo y con él del alcance de sus tokens; por
 * eso la raíz re-inyecta `moduleChromeVars` del módulo activo (resuelto desde
 * la ruta con la misma gramática de `direccion.ts`, o pasado por prop).
 */
import * as RadixDialog from "@radix-ui/react-dialog";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useInRouterContext, useLocation } from "react-router-dom";
import { X } from "../vendor/lucide-react";
import {
  PROSECNUR_MODULES,
  moduleChromeVars,
  type ProsecnurModuleMeta,
} from "../lib/modules";
import { moduloDesdePathname } from "../lib/navegacion/direccion";
import {
  usePanelDireccionable,
  type PanelDeclarado,
} from "../lib/navegacion/paneles";
import { PulsoButton } from "./PulsoButton";
import "./kit-dialog.css";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type DialogSize = "sm" | "md" | "lg";

/**
 * Política de alto del diálogo (Contrato de Superficie, C2).
 *
 * - `contenido`: el marco abraza su contenido hasta el tope del viewport. Solo
 *   para diálogos cuyo contenido no varía (un formulario fijo, una confirmación).
 * - `fijo`: el alto lo dan el `size` y el viewport, nunca `items.length`. La
 *   cabecera y el pie quedan fijos y el cuerpo posee el vacío y el scroll. Para
 *   listas, maestro-detalle y paneles que cambian de contenido.
 */
export type DialogAlto = "contenido" | "fijo";

/** Tono del tile de cabecera: acento del módulo, aviso o peligro. */
export type DialogTono = "modulo" | "aviso" | "peligro";

/**
 * Destino del foco al cerrar cuando el disparador ya no está en el DOM (p. ej.
 * un ítem de un menú que se desmontó al abrir el diálogo): un ref o un
 * selector CSS, resuelto en el momento de cerrar.
 */
export type RetornoDeFoco = RefObject<HTMLElement> | string;

/** Apertura por dirección (`?panel=`) o controlada; nunca las dos. */
export type OverlayApertura =
  | {
      /** Panel declarado: se abre con `?panel=<id>` y cerrar borra el param. */
      panel: PanelDeclarado;
      open?: undefined;
      onOpenChange?: undefined;
    }
  | {
      panel?: undefined;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

export type OverlayChromeProps = {
  /** Título visible; también nombra el diálogo para el lector de pantalla. */
  title: ReactNode;
  /** Una línea bajo el título. Si existe, describe el diálogo (`aria-describedby`). */
  subtitle?: ReactNode;
  /** Ícono del tile de cabecera (lucide vía el shim). */
  icon?: ReactNode;
  /** Tono del tile: `modulo` (por defecto), `aviso` o `peligro`. */
  tono?: DialogTono;
  /** Banda opcional entre la cabecera y el cuerpo, para un stepper de pasos. */
  stepper?: ReactNode;
  children: ReactNode;
  /** Acciones del pie, alineadas a la derecha; la primaria va al final. */
  footer?: ReactNode;
  /**
   * Ayuda de teclado del lado izquierdo del pie. Por defecto, si hay pie y el
   * overlay se puede cerrar, «Esc cierra». Un nodo la reemplaza; `null` la
   * suprime.
   */
  footerHint?: ReactNode;
  /**
   * Estado vivo del pie (un contador, un resumen), junto a la ayuda de
   * teclado y sin reemplazarla. Se anuncia con `aria-live="polite"`.
   */
  footerStatus?: ReactNode;
  /** Elemento que abre el overlay; recibe el foco al cerrar. */
  trigger?: ReactNode;
  /**
   * Alternativa del foco de vuelta cuando lo enfocado al abrir ya no existe
   * (el disparador se desmontó). Ref o selector CSS.
   */
  returnFocusTo?: RetornoDeFoco;
  /**
   * `false` bloquea todo cierre (Escape, click fuera y botón cerrar), p. ej.
   * mientras se guarda. Por defecto `true`.
   */
  dismissible?: boolean;
  /** Cerrar con click/puntero fuera del overlay. Por defecto `true`. */
  closeOnOutside?: boolean;
  /** Nombre accesible del botón cerrar. */
  closeLabel?: string;
  /**
   * Módulo cuyo acento se re-inyecta en el portal. Si se omite se resuelve
   * desde la ruta activa; `null` deja el acento global.
   */
  module?: ProsecnurModuleMeta | null;
  /**
   * Selector del ancestro dentro del cual montar el portal (por defecto,
   * `document.body`). Para superficies con tema propio que solo resuelve
   * bajo su raíz, como `.dashboard-scope`.
   */
  portalScope?: string;
  className?: string;
  bodyClassName?: string;
  /**
   * Cuerpo sin relleno: para maestro-detalle que gestiona sus propios bordes.
   * Con `flush` el cuerpo NO se declara dueño del vacío: sus columnas de datos
   * llevan `data-qa-geometry-capacity="owned"`.
   */
  flush?: boolean;
};

export type DialogProps = OverlayChromeProps &
  OverlayApertura & {
    /** Ancho: `sm` 480 · `md` 720 · `lg` 980. Por defecto `md`. */
    size?: DialogSize;
    /** Política de alto (C2). Por defecto `contenido`. */
    alto?: DialogAlto;
  };

// ---------------------------------------------------------------------------
// Módulo activo (lógica pura)
// ---------------------------------------------------------------------------

/**
 * Módulo al que pertenece una ruta, con la gramática canónica de
 * `moduloDesdePathname`. Prueba también los prefijos de la ruta para que una
 * subruta (`/hojas-ruta/algo`) no pierda el acento de su módulo.
 */
export function moduloDeDialogo(pathname: string): ProsecnurModuleMeta | null {
  const partes = pathname.split("/").filter(Boolean);
  for (let n = partes.length; n > 0; n -= 1) {
    const slug = moduloDesdePathname(`/${partes.slice(0, n).join("/")}`);
    if (slug) return PROSECNUR_MODULES.find((modulo) => modulo.slug === slug) ?? null;
  }
  return null;
}

/**
 * Elemento que recibe el foco al cerrar: lo enfocado al abrir si sigue en el
 * DOM; si no, la alternativa declarada (`returnFocusTo`) si está conectada.
 * `null` deja el comportamiento por defecto de Radix.
 */
export function resolverRetornoDeFoco(
  recordado: HTMLElement | null,
  alternativa: RetornoDeFoco | undefined,
  doc: Document,
): HTMLElement | null {
  if (recordado && recordado.isConnected) return recordado;
  if (!alternativa) return null;
  const candidato =
    typeof alternativa === "string"
      ? doc.querySelector<HTMLElement>(alternativa)
      : alternativa.current;
  return candidato && candidato.isConnected ? candidato : null;
}

/** Cuánto se vigila el destino del foco tras devolverlo (ms). */
const VIGILANCIA_RETORNO_MS = 1000;

/**
 * Un disparador puede desmontarse DESPUÉS de recibir el foco de vuelta: el
 * ítem de un popover/menú que sigue montado mientras el diálogo está abierto
 * y se cierra con el mismo Escape (con su animación de salida). Si eso pasa
 * con el foco todavía en él, el foco cae en `body`. Durante un instante se
 * vigila el DOM y, si el destino desaparece dejando el foco huérfano, se pasa
 * a la alternativa. Devuelve la función que corta la vigilancia.
 */
export function vigilarRetornoDeFoco(
  destino: HTMLElement,
  alternativa: RetornoDeFoco | undefined,
  doc: Document,
  duracionMs: number = VIGILANCIA_RETORNO_MS,
): () => void {
  const vista = doc.defaultView;
  if (!alternativa || !vista || typeof vista.MutationObserver === "undefined") {
    return () => undefined;
  }
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const observador = new vista.MutationObserver(() => {
    if (destino.isConnected) return;
    cortar();
    const activo = doc.activeElement;
    if (activo && activo !== doc.body) return;
    resolverRetornoDeFoco(null, alternativa, doc)?.focus();
  });
  function cortar() {
    observador.disconnect();
    if (temporizador !== undefined) clearTimeout(temporizador);
  }
  observador.observe(doc.body, { childList: true, subtree: true });
  temporizador = setTimeout(cortar, duracionMs);
  return cortar;
}

// ---------------------------------------------------------------------------
// Pieza común Dialog / Sideover
// ---------------------------------------------------------------------------

export type OverlayVariante =
  | { tipo: "dialogo"; size: DialogSize; alto: DialogAlto }
  | { tipo: "sideover" };

type OverlayBaseProps = OverlayChromeProps & {
  variante: OverlayVariante;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelProps?: { "data-pulso-panel": string };
};

function unirClases(...clases: Array<string | false | undefined>): string {
  return clases.filter(Boolean).join(" ");
}

/**
 * Sin DOM (render en servidor, tests con `renderToStaticMarkup`) no hay donde
 * montar un portal: Radix devuelve `null` y el marcado se perdería. Ahí se
 * dibuja en línea; en el navegador siempre va por portal.
 */
function PortalDelOverlay({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return <>{children}</>;
  return <RadixDialog.Portal container={container ?? undefined}>{children}</RadixDialog.Portal>;
}

/** Resuelve el contenedor del portal a partir de un ancla en el árbol del dueño. */
function useContenedorDePortal(portalScope: string | undefined) {
  const ancla = useRef<HTMLSpanElement | null>(null);
  const [contenedor, setContenedor] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!portalScope) return;
    const encontrado = ancla.current?.closest<HTMLElement>(portalScope) ?? null;
    setContenedor(encontrado ?? document.body);
  }, [portalScope]);

  const listo = !portalScope || contenedor !== null || typeof document === "undefined";
  const anclaNodo = portalScope ? (
    <span ref={ancla} hidden data-pulso-overlay-ancla="" />
  ) : null;
  return { contenedor, listo, anclaNodo };
}

function OverlayRender({
  variante,
  open,
  onOpenChange,
  panelProps,
  module,
  title,
  subtitle,
  icon,
  tono = "modulo",
  stepper,
  children,
  footer,
  footerHint,
  footerStatus,
  trigger,
  returnFocusTo,
  dismissible = true,
  closeOnOutside = true,
  closeLabel = "Cerrar",
  portalScope,
  className,
  bodyClassName,
  flush = false,
}: Omit<OverlayBaseProps, "module"> & { module: ProsecnurModuleMeta | null }) {
  const { contenedor, listo, anclaNodo } = useContenedorDePortal(portalScope);

  // Foco de vuelta al disparador. Radix solo lo devuelve a su `Trigger`; un
  // overlay abierto por dirección o desde un botón externo perdería el foco
  // en `body`. Se recuerda lo enfocado al abrir y se restaura al cerrar; si
  // ya no está en el DOM (un ítem de menú desmontado) se usa `returnFocusTo`.
  const retorno = useRef<HTMLElement | null>(null);
  const alternativa = useRef(returnFocusTo);
  alternativa.current = returnFocusTo;
  const alAbrirFoco = useCallback(() => {
    const activo = document.activeElement;
    retorno.current = activo instanceof HTMLElement && activo !== document.body ? activo : null;
  }, []);
  const alCerrarFoco = useCallback((event: Event) => {
    const destino = resolverRetornoDeFoco(retorno.current, alternativa.current, document);
    retorno.current = null;
    if (destino) {
      event.preventDefault();
      destino.focus();
      vigilarRetornoDeFoco(destino, alternativa.current, document);
    }
  }, []);

  const cambiar = useCallback(
    (siguiente: boolean) => {
      if (!siguiente && !dismissible) return;
      onOpenChange(siguiente);
    },
    [dismissible, onOpenChange],
  );

  const esDialogo = variante.tipo === "dialogo";
  const raiz = esDialogo ? "pulso-dialog" : "pulso-sideover";
  const pistaPorDefecto = dismissible ? (
    <>
      <kbd className="pulso-dialog__kbd">Esc</kbd>
      <span>cierra</span>
    </>
  ) : null;
  const pista = footerHint === undefined ? pistaPorDefecto : footerHint;
  const hayPie = footer !== undefined || footerHint !== undefined || footerStatus !== undefined;
  const altoFijo = esDialogo && variante.alto === "fijo";

  return (
    <RadixDialog.Root open={open && listo} onOpenChange={cambiar}>
      {anclaNodo}
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <PortalDelOverlay container={contenedor}>
        <RadixDialog.Overlay className="pulso-dialog-overlay" />
        <RadixDialog.Content
          {...panelProps}
          className={unirClases(
            "pulso-overlay",
            raiz,
            esDialogo && `pulso-dialog--${variante.size}`,
            altoFijo && "pulso-dialog--alto-fijo",
            className,
          )}
          // C1: el marco es un grupo de secciones independientes (cabecera,
          // stepper, cuerpo, pie); el cuerpo es el único que posee vacío.
          data-qa-geometry-group={raiz}
          data-qa-geometry-contract="intrinsic"
          data-alto={esDialogo ? variante.alto : undefined}
          data-module={module?.slug}
          style={module ? moduleChromeVars(module) : undefined}
          aria-modal="true"
          {...(subtitle ? {} : { "aria-describedby": undefined })}
          onOpenAutoFocus={alAbrirFoco}
          onCloseAutoFocus={alCerrarFoco}
          onEscapeKeyDown={(event) => {
            if (!dismissible) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (!dismissible || !closeOnOutside) event.preventDefault();
          }}
        >
          <header className="pulso-dialog__head" data-qa-geometry-member="">
            {icon ? (
              <span
                className={unirClases(
                  "pulso-dialog__tile",
                  tono !== "modulo" && `pulso-dialog__tile--${tono}`,
                )}
                data-tono={tono}
                aria-hidden="true"
              >
                {icon}
              </span>
            ) : null}
            <div className="pulso-dialog__titles">
              <RadixDialog.Title className="pulso-dialog__title">{title}</RadixDialog.Title>
              {subtitle ? (
                <RadixDialog.Description className="pulso-dialog__subtitle">
                  {subtitle}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <PulsoButton
                variant="icon"
                aria-label={closeLabel}
                disabled={!dismissible}
                className="pulso-dialog__close"
              >
                <X size={16} aria-hidden="true" />
              </PulsoButton>
            </RadixDialog.Close>
          </header>

          {stepper ? (
            <div className="pulso-dialog__stepper" data-qa-geometry-member="">
              {stepper}
            </div>
          ) : null}

          <div
            className={unirClases(
              "pulso-dialog__body",
              flush && "pulso-dialog__body--flush",
              bodyClassName,
            )}
            data-qa-geometry-member=""
            // En alto fijo el cuerpo posee el vacío. Con `flush` no: ahí el
            // cuerpo es solo el marco de un maestro-detalle y el vacío es de sus
            // columnas, que se declaran `owned` ellas mismas (C1/C3).
            data-qa-geometry-capacity={altoFijo && !flush ? "owned" : undefined}
          >
            {children}
          </div>

          {hayPie ? (
            <footer className="pulso-dialog__foot" data-qa-geometry-member="">
              <div className="pulso-dialog__hint">
                {pista}
                {footerStatus !== undefined ? (
                  <span className="pulso-dialog__status" aria-live="polite">
                    {footerStatus}
                  </span>
                ) : null}
              </div>
              {footer !== undefined ? (
                <div className="pulso-dialog__actions">{footer}</div>
              ) : null}
            </footer>
          ) : null}
        </RadixDialog.Content>
      </PortalDelOverlay>
    </RadixDialog.Root>
  );
}

function OverlayConRuta(props: OverlayBaseProps) {
  const { pathname } = useLocation();
  return <OverlayRender {...props} module={moduloDeDialogo(pathname)} />;
}

/** Pieza compartida: resuelve el módulo (prop o ruta) y dibuja el overlay. */
export function OverlayBase(props: OverlayBaseProps) {
  const enRouter = useInRouterContext();
  if (props.module !== undefined || !enRouter) {
    return <OverlayRender {...props} module={props.module ?? null} />;
  }
  return <OverlayConRuta {...props} />;
}

type OverlayDePanelProps = Omit<OverlayBaseProps, "open" | "onOpenChange" | "panelProps"> & {
  panel: PanelDeclarado;
};

/** Modo direccionable: la URL manda; abrir/cerrar reescribe `?panel=`. */
export function OverlayDePanel({ panel, ...resto }: OverlayDePanelProps) {
  const control = usePanelDireccionable(panel);
  const { abrir, cerrar } = control;
  const onOpenChange = useCallback(
    (abierto: boolean) => (abierto ? abrir() : cerrar()),
    [abrir, cerrar],
  );
  return (
    <OverlayBase
      {...resto}
      open={control.abierto}
      onOpenChange={onOpenChange}
      panelProps={control.props}
    />
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/**
 * Diálogo centrado: cabecera (tile + título + subtítulo + cerrar), stepper
 * opcional, cuerpo con scroll propio y pie con la acción primaria a la
 * derecha y la ayuda de teclado a la izquierda.
 */
export function Dialog(props: DialogProps) {
  const { size = "md", alto = "contenido", panel, open, onOpenChange, ...chrome } = props;
  const variante: OverlayVariante = { tipo: "dialogo", size, alto };
  if (panel) return <OverlayDePanel {...chrome} variante={variante} panel={panel} />;
  return (
    <OverlayBase
      {...chrome}
      variante={variante}
      open={open ?? false}
      onOpenChange={onOpenChange ?? (() => undefined)}
    />
  );
}
