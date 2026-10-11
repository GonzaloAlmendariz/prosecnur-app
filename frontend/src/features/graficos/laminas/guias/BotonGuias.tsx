// Botón «Guías» de la barra del visor y su panel (plan F6 §8). El panel es un popover no modal direccionable
// (`panel=guias`): capas activables y combinables, filtro por rol, resumen honesto de lo que la vista previa midió y la
// lista de elementos (la vía por teclado al nombre de cada caja, que con el mouse se lee al pasar sobre la lámina).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BoxSelect, Layers, LayoutTemplate, MoveHorizontal, Ruler, Type, X } from "../../../../vendor/lucide-react";
import type { LucideIcon } from "../../../../vendor/lucide-react";
import { Switch } from "../../../../components/Switch";
import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { escucharEscape } from "../cierreConEscape";
import { capasEncendidas, useGuiasUi } from "./guiasStore";
import { CAPAS_GUIA, rotuloDeRol, type CapaGuia, type ModeloGuias } from "./modeloGuias";
import { PANEL_GUIAS_LAMINA } from "./panelGuias";
import { posicionPanelGuias, type PosicionPanel } from "./posicionPanelGuias";
import "./guias.css";

const CAPA: Record<CapaGuia, { rotulo: string; detalle: string; Icono: LucideIcon }> = {
  cajas: { rotulo: "Cajas", detalle: "El contorno de cada elemento; su nombre al pasar el mouse.", Icono: BoxSelect },
  espacios: { rotulo: "Espacios", detalle: "Separaciones entre secciones y márgenes a los bordes, en cm.", Icono: MoveHorizontal },
  tipografia: { rotulo: "Tipografía", detalle: "El tamaño en pt de cada texto; en rojo si se aparta del estándar.", Icono: Type },
  medidas: { rotulo: "Medidas", detalle: "Ancho y alto de cada caja, en cm.", Icono: Ruler },
  recetario: { rotulo: "Ranuras", detalle: "Dónde va cada elemento en este tipo de lámina.", Icono: LayoutTemplate },
};

type Props = {
  modelo: ModeloGuias;
  /** Roles de la parte, con cuántos elementos tiene cada uno (base del filtro). */
  roles: { rol: string; n: number }[];
  /** La vista previa trajo las formas (K11). `false`: no se pidieron o el backend no las conoce. */
  disponible: boolean;
  /** La parte tiene ranuras del estándar (las láminas de estructura no). */
  hayRanuras: boolean;
};

const SALIDA_MS = 120;

export function BotonGuias({ modelo, roles, disponible, hayRanuras }: Props) {
  const panel = usePanelDireccionable(PANEL_GUIAS_LAMINA);
  const capas = useGuiasUi((s) => s.capas);
  const encendidas = capasEncendidas(capas);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const porClic = useRef(false);

  const { cerrar: cerrarPanel } = panel;
  const cerrar = useCallback((devolverFoco: boolean) => {
    cerrarPanel();
    if (devolverFoco) botonRef.current?.focus();
  }, [cerrarPanel]);

  const alternar = () => {
    porClic.current = !panel.abierto;
    panel.alternar();
  };

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className={`pulso-f6-boton pulso-f6-guias-boton${encendidas > 0 ? " is-activo" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={panel.abierto}
        aria-controls={panel.abierto ? panelId : undefined}
        aria-label={`Guías de la lámina${encendidas ? `: ${encendidas} ${encendidas === 1 ? "capa encendida" : "capas encendidas"}` : ""}`}
        title="Guías de la lámina: cajas, espacios, tipografía, medidas y ranuras"
        onClick={alternar}
      >
        <Layers size={14} aria-hidden="true" />
        <span className="pulso-f6-rotulo-medio">Guías</span>
        {encendidas > 0 && <span className="pulso-f6-guias-cuenta" aria-hidden="true">{encendidas}</span>}
      </button>
      <PanelGuias
        id={panelId}
        abierto={panel.abierto}
        propsPanel={panel.props}
        ancla={botonRef}
        enfocarAlAbrir={porClic}
        onCerrar={cerrar}
        modelo={modelo}
        roles={roles}
        disponible={disponible}
        hayRanuras={hayRanuras}
      />
    </>
  );
}

type PropsPanel = Props & {
  id: string;
  abierto: boolean;
  propsPanel: { "data-pulso-panel": string };
  ancla: RefObject<HTMLButtonElement>;
  enfocarAlAbrir: MutableRefObject<boolean>;
  onCerrar: (devolverFoco: boolean) => void;
};

function PanelGuias({ id, abierto, propsPanel, ancla, enfocarAlAbrir, onCerrar, modelo, roles, disponible, hayRanuras }: PropsPanel) {
  const capas = useGuiasUi((s) => s.capas);
  const alternarCapa = useGuiasUi((s) => s.alternarCapa);
  const apagarCapas = useGuiasUi((s) => s.apagarCapas);
  const rolesOcultos = useGuiasUi((s) => s.rolesOcultos);
  const alternarRol = useGuiasUi((s) => s.alternarRol);
  const mostrarTodos = useGuiasUi((s) => s.mostrarTodosLosRoles);
  const resaltada = useGuiasUi((s) => s.resaltada);
  const setResaltada = useGuiasUi((s) => s.setResaltada);
  const raizRef = useRef<HTMLDivElement>(null);
  const tituloId = `${id}-titulo`;
  const montado = useMontadoConSalida(abierto, SALIDA_MS);
  const { estilo, anclado } = usePosicionBajo(ancla, montado);

  // Escape cierra y devuelve el foco al botón; un clic fuera (que no sea el botón) cierra sin moverlo.
  useEffect(() => {
    if (!abierto || typeof document === "undefined") return;
    const quitar = escucharEscape(document, () => onCerrar(true));
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || raizRef.current?.contains(t) || ancla.current?.contains(t)) return;
      onCerrar(false);
    };
    document.addEventListener("pointerdown", fuera, true);
    return () => { quitar(); document.removeEventListener("pointerdown", fuera, true); };
  }, [abierto, ancla, onCerrar]);

  // Abierto con el botón, el foco entra al primer control; abierto por enlace, se queda donde estaba.
  useEffect(() => {
    if (!abierto || !enfocarAlAbrir.current) return;
    enfocarAlAbrir.current = false;
    raizRef.current?.querySelector<HTMLElement>('[role="switch"]')?.focus({ preventScroll: true });
  }, [abierto, enfocarAlAbrir]);

  // Al cerrar se suelta el elemento señalado: fuera del panel no hay lista que lo explique.
  useEffect(() => { if (!abierto) setResaltada(null); }, [abierto, setResaltada]);

  if (!montado || typeof document === "undefined") return null;
  const destino = (ancla.current?.closest(".pulso-page-frame") as HTMLElement | null) ?? document.body;
  const { resumen } = modelo;
  const encendidas = capasEncendidas(capas);

  return createPortal(
    <div
      ref={raizRef}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      className="pulso-f6-guias-panel"
      data-state={abierto ? "open" : "closing"}
      style={estilo}
      data-ancla={anclado ?? undefined}
      {...propsPanel}
    >
      <header className="pulso-f6-guias-panel-cabeza">
        <h2 id={tituloId}>Guías de la lámina</h2>
        <button type="button" className="pulso-f6-texto-boton" disabled={encendidas === 0} onClick={apagarCapas}>
          Apagar todas
        </button>
        <button type="button" className="pulso-f6-icono-boton" aria-label="Cerrar las guías" onClick={() => onCerrar(true)}>
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <div className="pulso-f6-guias-panel-cuerpo" data-qa-geometry-group="graficos/f6-guias-panel" data-qa-geometry-contract="intrinsic">
        <ul className="pulso-f6-guias-capas" aria-label="Capas" data-qa-geometry-group="graficos/f6-guias-capas" data-qa-geometry-contract="equal">
          {CAPAS_GUIA.map((c) => {
            const { rotulo, detalle, Icono } = CAPA[c];
            const sw = `${id}-${c}`;
            return (
              <li key={c} className={`pulso-f6-guias-capa-fila${capas[c] ? " is-on" : ""}`} data-qa-geometry-member="true">
                <Icono size={15} aria-hidden="true" className="pulso-f6-guias-capa-icono" />
                <label htmlFor={sw} className="pulso-f6-guias-capa-texto">
                  <strong>{rotulo}</strong>
                  <span id={`${sw}-detalle`}>{detalle}</span>
                </label>
                <Switch id={sw} checked={capas[c]} onToggle={() => alternarCapa(c)} ariaLabel={rotulo} />
              </li>
            );
          })}
        </ul>

        {roles.length > 0 && (
          <fieldset className="pulso-f6-guias-roles">
            <legend>Mostrar sólo</legend>
            <div className="pulso-f6-guias-roles-lista" data-qa-geometry-group="graficos/f6-guias-roles" data-qa-geometry-contract="intrinsic">
              {roles.map(({ rol, n }) => {
                const visible = !rolesOcultos.includes(rol);
                return (
                  <button
                    key={rol}
                    type="button"
                    className={`pulso-f6-guias-rol${visible ? " is-on" : ""}`}
                    aria-pressed={visible}
                    onClick={() => alternarRol(rol)}
                  >
                    {rotuloDeRol(rol)} <span className="pulso-f6-guias-rol-n">{n}</span>
                  </button>
                );
              })}
            </div>
            {rolesOcultos.length > 0 && (
              <button type="button" className="pulso-f6-texto-boton" onClick={mostrarTodos}>Mostrar todos los roles</button>
            )}
          </fieldset>
        )}

        <div className="pulso-f6-guias-estado" role="status">
          <EstadoGuias modelo={modelo} disponible={disponible} hayRanuras={hayRanuras} recetario={capas.recetario} tipografia={capas.tipografia} />
        </div>

        {disponible && modelo.elementos.length > 0 && (
          <details className="pulso-f6-guias-elementos">
            <summary>Elementos ({resumen.elementos})</summary>
            <ul aria-label="Elementos de la lámina" data-qa-geometry-capacity="owned">
              {modelo.elementos.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`pulso-f6-guias-elemento${resaltada === e.id ? " is-senalado" : ""}`}
                    aria-pressed={resaltada === e.id}
                    onClick={() => setResaltada(resaltada === e.id ? null : e.id)}
                  >
                    <span className="pulso-f6-guias-elemento-nombre">{e.nombre}</span>
                    <span className="pulso-f6-guias-elemento-dato">
                      {rotuloDeRol(e.rol)} · {e.medidas}
                      {e.pt && <> · <span className={e.ptFuera ? "is-fuera" : undefined}>{e.pt}{e.ptFuera ? " (fuera del estándar)" : ""}</span></>}
                      {e.recortado && " · recortado"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>,
    destino,
  );
}

function EstadoGuias({ modelo, disponible, hayRanuras, recetario, tipografia }: {
  modelo: ModeloGuias; disponible: boolean; hayRanuras: boolean; recetario: boolean; tipografia: boolean;
}) {
  // C5: cada vacío dice de dónde viene. Sin formas es una desconexión, no una lámina vacía.
  if (!disponible) return <p>Esta vista previa no trae las medidas de los elementos; las guías aparecen cuando el motor las informa.</p>;
  const { resumen } = modelo;
  if (!resumen.elementos) return <p>El motor no informó elementos medibles en esta parte, o el filtro los oculta todos.</p>;
  const lineas: string[] = [`${resumen.elementos} ${resumen.elementos === 1 ? "elemento" : "elementos"}, ${resumen.textos} con texto.`];
  if (resumen.fueraDeRecetario) lineas.push(`${resumen.fueraDeRecetario} ${resumen.fueraDeRecetario === 1 ? "texto se aparta" : "textos se apartan"} del tamaño estándar.`);
  if (resumen.recortados) lineas.push(`${resumen.recortados} ${resumen.recortados === 1 ? "texto no cabe" : "textos no caben"} en su caja.`);
  if (tipografia && resumen.sinReferencia) lineas.push("Los tamaños se muestran sin comparar con el estándar.");
  if (recetario && !hayRanuras) lineas.push("Este tipo de lámina no tiene ranuras en el estándar.");
  return <>{lineas.map((l) => <p key={l}>{l}</p>)}</>;
}

/** Mantiene el panel montado lo que dura su salida, para que se vaya con fundido y no de golpe. */
function useMontadoConSalida(abierto: boolean, ms: number): boolean {
  const [montado, setMontado] = useState(abierto);
  useEffect(() => {
    if (abierto) { setMontado(true); return; }
    const t = window.setTimeout(() => setMontado(false), ms);
    return () => window.clearTimeout(t);
  }, [abierto, ms]);
  return abierto || montado;
}

/** Bajo el botón (o, sin botón visible, bajo la barra del visor), contenido en la ventana (`posicionPanelGuias`). */
function usePosicionBajo(ancla: RefObject<HTMLElement>, activo: boolean): { estilo: CSSProperties; anclado: PosicionPanel["anclado"] | null } {
  const [estilo, setEstilo] = useState<CSSProperties>({});
  const [anclado, setAnclado] = useState<PosicionPanel["anclado"] | null>(null);
  useLayoutEffect(() => {
    if (!activo) return;
    const ubicar = () => {
      const boton = ancla.current;
      const visor = boton?.closest<HTMLElement>(".pulso-f6-visor") ?? null;
      const { anclado, ...pos } = posicionPanelGuias(
        boton?.getBoundingClientRect() ?? null,
        visor?.getBoundingClientRect() ?? null,
        { ancho: window.innerWidth, alto: window.innerHeight },
      );
      setEstilo(pos);
      setAnclado(anclado);
    };
    ubicar();
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => { window.removeEventListener("resize", ubicar); window.removeEventListener("scroll", ubicar, true); };
  }, [activo, ancla]);
  return { estilo, anclado };
}
