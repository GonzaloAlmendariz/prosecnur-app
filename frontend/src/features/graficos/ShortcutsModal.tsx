import { Keyboard, X } from "../../vendor/lucide-react";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import { resolverPestanaGraficos, type GraficosTabId } from "./pestanaGraficos";

// Modal de referencia rápida de los atajos disponibles en Gráficos. Se abre con `?`. Pequeño y frontal: el analista
// lo consulta y cierra. Lista los atajos del editor de la pestaña activa (C22): Láminas y Vista general no tienen
// Timeline, Canvas, N, F ni zoom; ésos sólo se anuncian en el Editor anterior.

export type Atajo = { keys: string[]; label: string; group: string };

const AYUDA: Atajo = { keys: ["?"], label: "Abrir esta ayuda (Mayús + /)", group: "Ayuda" };

/** Atajos que anuncia el modal para la pestaña `pestana`; `mod` es «⌘» en Mac y «Ctrl» en el resto. */
export function atajosDePestana(pestana: GraficosTabId, mod: string): Atajo[] {
  const deshacer: Atajo[] = [
    { keys: [mod, "Z"], label: "Deshacer el último cambio", group: "Edición" },
    { keys: [mod, "Shift", "Z"], label: "Rehacer", group: "Edición" },
  ];
  switch (pestana) {
    case "laminas":
      return [
        ...deshacer,
        { keys: [mod, "D"], label: "Duplicar la lámina activa", group: "Edición" },
        { keys: ["Alt", "↑"], label: "Subir la lámina activa", group: "Edición" },
        { keys: ["Alt", "↓"], label: "Bajar la lámina activa", group: "Edición" },
        { keys: ["J"], label: "Lámina siguiente", group: "Navegación" },
        { keys: ["K"], label: "Lámina anterior", group: "Navegación" },
        { keys: ["/"], label: "Buscar una lámina en la Estructura", group: "Navegación" },
        { keys: [mod, "1"], label: "Mostrar u ocultar la Estructura", group: "Paneles" },
        { keys: [mod, "."], label: "Mostrar u ocultar los Ajustes", group: "Paneles" },
        AYUDA,
      ];
    case "vista-general":
      return [
        ...deshacer,
        { keys: ["←", "→"], label: "Lámina anterior / siguiente", group: "Recorrer las tarjetas" },
        { keys: ["↑", "↓"], label: "Capítulo anterior / siguiente", group: "Recorrer las tarjetas" },
        { keys: ["Inicio", "Fin"], label: "Primera / última lámina", group: "Recorrer las tarjetas" },
        { keys: ["Enter"], label: "Abrir la lámina en Láminas", group: "Recorrer las tarjetas" },
        { keys: ["Mayús", "flecha"], label: "Extender la selección", group: "Selección" },
        { keys: ["Espacio"], label: "Agregar o quitar de la selección", group: "Selección" },
        { keys: [mod, "A"], label: "Elegir todas", group: "Selección" },
        { keys: ["Esc"], label: "Vaciar la selección", group: "Selección" },
        { keys: ["Alt", "←", "↑"], label: "Mover la selección un lugar antes", group: "Ordenar" },
        { keys: ["Alt", "→", "↓"], label: "Mover la selección un lugar después", group: "Ordenar" },
        { keys: [mod, "D"], label: "Duplicar la selección", group: "Ordenar" },
        { keys: ["Supr"], label: "Eliminar la selección (pide confirmar)", group: "Ordenar" },
        AYUDA,
      ];
    case "estilo":
    case "estilo-informe":
      return [...deshacer, AYUDA];
    case "clasico":
      return [
        ...deshacer,
        { keys: [mod, "D"], label: "Duplicar el slide activo", group: "Edición" },
        { keys: ["Alt", "↑"], label: "Mover slide activo arriba", group: "Edición" },
        { keys: ["Alt", "↓"], label: "Mover slide activo abajo", group: "Edición" },
        { keys: ["J"], label: "Slide siguiente", group: "Navegación" },
        { keys: ["K"], label: "Slide anterior", group: "Navegación" },
        { keys: ["/"], label: "Foco al buscador del timeline", group: "Navegación" },
        { keys: ["N"], label: "Abrir picker para agregar slide", group: "Navegación" },
        { keys: ["T"], label: "Modo Timeline", group: "Vista" },
        { keys: ["V"], label: "Modo Canvas", group: "Vista" },
        { keys: ["1"], label: "Tab Contenido (en modo Timeline)", group: "Vista" },
        { keys: ["2"], label: "Tab Datos", group: "Vista" },
        { keys: ["3"], label: "Tab Estilo", group: "Vista" },
        { keys: ["4"], label: "Tab Avanzado", group: "Vista" },
        { keys: ["F"], label: "Ajustar canvas al lienzo", group: "Canvas" },
        { keys: ["+", "/", "-"], label: "Zoom in / out", group: "Canvas" },
        { keys: ["0"], label: "Reset zoom 100%", group: "Canvas" },
        { keys: ["Esc"], label: "Limpiar selección", group: "Canvas" },
        { keys: ["Shift", "+ Click"], label: "Añadir/quitar slide de la selección", group: "Canvas" },
        AYUDA,
      ];
  }
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";
  const pestana = resolverPestanaGraficos(useSeccion("procesamiento").pestana);
  const shortcuts = atajosDePestana(pestana, mod);
  const nota = pestana === "vista-general" ? " Los de la Vista general actúan con el foco en una tarjeta." : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atajos de teclado"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "85vh",
          background: "white", borderRadius: 12,
          boxShadow: "var(--pulso-shadow-high)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Keyboard size={16} color="var(--pulso-primary)" />
          <h2 style={{ margin: 0, fontSize: 14, flex: 1 }}>Atajos de teclado</h2>
          <button
            type="button"
            onClick={onClose}
            className="pulso-icon"
            aria-label="Cerrar"
          >
            <X size={13} />
          </button>
        </header>
        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          {Array.from(new Set(shortcuts.map((s) => s.group))).map((group) => (
            <section key={group} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.5, color: "var(--pulso-text-soft)",
                marginBottom: 6, paddingBottom: 4,
                borderBottom: "1px solid var(--pulso-border)",
              }}>
                {group}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {shortcuts.filter((s) => s.group === group).map((s, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "inline-flex", gap: 3, minWidth: 110 }}>
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 11, fontWeight: 600,
                            padding: "3px 7px",
                            border: "1px solid var(--pulso-border)",
                            borderBottomWidth: 2,
                            borderRadius: 4,
                            background: "var(--pulso-surface)",
                            color: "var(--pulso-text)",
                            minWidth: 20, textAlign: "center",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span style={{ color: "var(--pulso-text)" }}>{s.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 11, color: "var(--pulso-text-soft)",
              lineHeight: 1.5,
            }}
          >
            Los atajos se ignoran mientras tipeas en un input, textarea o campo
            editable — ahí {mod}+Z usa el undo nativo del texto.{nota}
          </p>
        </div>
      </div>
    </div>
  );
}
