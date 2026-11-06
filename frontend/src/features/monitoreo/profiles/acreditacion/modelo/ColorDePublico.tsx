import { useRef, useState, type RefObject } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { apiMonitoreoConfig, type MonitoreoState } from "../../../../../api/client";
import { Popover } from "../../../../../components/Popover";
import { clasePublico, hexValido, paletaDePublicos } from "../paletaPublicos";
import "../paletaPublicos.css";
import "./colorDePublico.css";

/** Muestras para elegir de un clic; cualquier otro color va por el selector o por el hex. */
export const MUESTRAS_DE_COLOR = [
  "#1f6f8b", "#2f855a", "#b7791f", "#c05621", "#c53030", "#b83280",
  "#6b46c1", "#3c366b", "#2c7a7b", "#4a5568", "#7b341e", "#276749",
] as const;

/** «rgb(31, 111, 139)» -> «#1f6f8b»; `null` si el navegador devuelve otra cosa. */
function rgbAHex(color: string): string | null {
  const partes = color.match(/\d+(\.\d+)?/g);
  if (!partes || partes.length < 3) return null;
  return `#${partes.slice(0, 3).map((parte) => Math.round(Number(parte)).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Modelo › Cuotas: el recuadro con el color del público. Al hacer clic abre un
 * popover con muestras, el selector del sistema y el código hex (Gonzalo, 30/10:
 * «poder escoger nuestro color en Modelo»). Se guarda en la configuración del
 * estudio (`publico_colores`) y desde ahí pinta al público en todas las vistas.
 */
export function ColorDePublico({
  publico,
  publicos,
  state,
  onStateChange,
}: {
  publico: string;
  /** Todos los públicos del estudio: el tono de la paleta depende de sus vecinos. */
  publicos: readonly string[];
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const propio = state?.config?.publico_colores?.[publico] ? hexValido(state.config.publico_colores[publico]) : null;
  const muestraRef = useRef<HTMLButtonElement | null>(null);
  // Cada guardado cambia la marca y el Popover se cierra solo: el que abrió ya eligió.
  const [guardados, setGuardados] = useState(0);
  const clase = clasePublico(paletaDePublicos(publicos), publico);
  return (
    <span className="acr-color">
      <Popover
        side="bottom"
        align="start"
        maxWidth={300}
        className="acr-color-popover"
        ariaLabel={`Color de ${publico}`}
        cerrarAlCambiar={guardados}
        trigger={
          <button
            // Ref en función: la primitiva sólo encadena refs de función al clonar el disparador.
            ref={(nodo) => { muestraRef.current = nodo; }}
            type="button"
            className={`acr-color-muestra ${clase}`}
            aria-label={`Color de ${publico}${propio ? `, ${propio}` : ", el de la paleta"}`}
            title="Cambiar el color del público"
          />
        }
      >
        <EditorDeColor
          publico={publico}
          propio={propio}
          muestraRef={muestraRef}
          state={state}
          onGuardado={(siguiente) => { onStateChange?.(siguiente); setGuardados((n) => n + 1); }}
        />
      </Popover>
    </span>
  );
}

/** El contenido del popover; se monta al abrir, así el borrador parte del color que se ve. */
function EditorDeColor({
  publico,
  propio,
  muestraRef,
  state,
  onGuardado,
}: {
  publico: string;
  propio: string | null;
  muestraRef: RefObject<HTMLButtonElement | null>;
  state: MonitoreoState | null | undefined;
  onGuardado: (state: MonitoreoState) => void;
}) {
  const [borrador, setBorrador] = useState(() => {
    const visto = muestraRef.current ? rgbAHex(getComputedStyle(muestraRef.current).backgroundColor) : null;
    return propio ?? visto ?? MUESTRAS_DE_COLOR[0];
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hex = hexValido(borrador);
  const puedeGuardar = Boolean(state?.config) && !guardando;

  async function guardar(color: string | null) {
    if (!state?.config) return;
    setGuardando(true);
    setError(null);
    try {
      const siguiente = { ...(state.config.publico_colores ?? {}) };
      if (color) siguiente[publico] = color;
      else delete siguiente[publico];
      const result = await apiMonitoreoConfig({ ...state.config, publico_colores: siguiente });
      onGuardado(result.state);
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  return (
    <div className="acr-color-cuerpo">
      <header className="acr-color-cabecera">
        <span className="acr-av-antetitulo">Color del público</span>
        <strong>{publico}</strong>
      </header>
      <div className="acr-color-vista" aria-hidden="true">
        <i style={{ background: hex ?? "transparent" }} />
        <span>{hex ?? "Código no válido"}</span>
      </div>
      <ul className="acr-color-muestras" aria-label="Muestras">
        {MUESTRAS_DE_COLOR.map((muestra) => (
          <li key={muestra}>
            <button
              type="button"
              className={hex === muestra ? "is-activo" : undefined}
              style={{ background: muestra }}
              aria-label={muestra}
              aria-pressed={hex === muestra}
              onClick={() => setBorrador(muestra)}
            >
              {hex === muestra ? <Check size={13} aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="acr-color-campos">
        <label className="acr-color-sistema" title="Elegir con el selector del sistema">
          <input type="color" value={hex ?? "#000000"} onChange={(event) => setBorrador(event.currentTarget.value)} aria-label="Elegir con el selector del sistema" />
        </label>
        <label className="acr-color-hex">
          <span className="acr-av-antetitulo">Hex</span>
          <input
            value={borrador}
            onChange={(event) => setBorrador(event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && hex && puedeGuardar) void guardar(hex); }}
            spellCheck={false}
            maxLength={7}
            aria-invalid={!hex}
            aria-label="Código hex del color"
          />
        </label>
      </div>
      {error ? <p className="acr-color-error" role="alert">{error}</p> : null}
      <footer className="acr-color-pie">
        <button type="button" className="acr-av-boton" onClick={() => { void guardar(null); }} disabled={!propio || !puedeGuardar}>
          <RotateCcw size={13} aria-hidden="true" /> Color de la paleta
        </button>
        <button type="button" className="acr-av-boton is-primario" onClick={() => { if (hex) void guardar(hex); }} disabled={!hex || !puedeGuardar || hex === propio}>
          {guardando ? <Loader2 size={13} className="pulso-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} Usar este color
        </button>
      </footer>
    </div>
  );
}
