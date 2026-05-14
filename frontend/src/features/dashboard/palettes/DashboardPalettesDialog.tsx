import { useEffect, useMemo, useState } from "react";
import { Palette, Search, Trash2, X } from "lucide-react";
import { IconAI } from "../../../lib/icons";
import {
  apiDashboardPaletasListas,
  type DashboardChoiceList,
} from "../../../api/client";
import { EmptyState } from "../shared/EmptyState";
import { useDashboardStore } from "../store";

const PRESETS = [
  {
    id: "likert",
    label: "Likert",
    colors: ["#B91C1C", "#F97316", "#E5E7EB", "#60A5FA", "#1D4ED8"],
  },
  {
    id: "celeste",
    label: "Azul celeste",
    colors: ["#0B3A67", "#1B679D", "#4F9EDB", "#93C4EB", "#D9ECFA", "#EAF6FF"],
  },
  {
    id: "semaforo",
    label: "Semáforo",
    colors: ["#8B0000", "#D9534F", "#F6C370", "#A8D08D", "#4F8B46"],
  },
  {
    id: "tableau10",
    label: "Tableau 10",
    colors: [
      "#4E79A7",
      "#F28E2B",
      "#E15759",
      "#76B7B2",
      "#59A14F",
      "#EDC948",
      "#B07AA1",
      "#FF9DA7",
      "#9C755F",
      "#BAB0AC",
    ],
  },
  {
    id: "observable10",
    label: "Observable 10",
    colors: [
      "#4269D0",
      "#EFB118",
      "#FF725C",
      "#6CC5B0",
      "#3CA951",
      "#FF8AB7",
      "#A463F2",
      "#97BBF5",
      "#9C6B4E",
      "#9498A0",
    ],
  },
  {
    id: "brewer_set2",
    label: "ColorBrewer Set2",
    colors: [
      "#66C2A5",
      "#FC8D62",
      "#8DA0CB",
      "#E78AC3",
      "#A6D854",
      "#FFD92F",
      "#E5C494",
      "#B3B3B3",
    ],
  },
  {
    id: "ibm_carbon",
    label: "IBM Carbon",
    colors: [
      "#6929C4",
      "#1192E8",
      "#005D5D",
      "#9F1853",
      "#FA4D56",
      "#570408",
      "#198038",
      "#002D9C",
      "#EE538B",
      "#B28600",
    ],
  },
];

export function DashboardPalettesDialog({ onClose }: { onClose: () => void }) {
  const paletas = useDashboardStore((s) => s.config.paletas_listas);
  const setPaletaLista = useDashboardStore((s) => s.setPaletaLista);
  const setColorEnPaletaLista = useDashboardStore((s) => s.setColorEnPaletaLista);
  const removePaletaLista = useDashboardStore((s) => s.removePaletaLista);

  const [listas, setListas] = useState<DashboardChoiceList[]>([]);
  const [active, setActive] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDashboardPaletasListas()
      .then((r) => {
        if (cancelled) return;
        setListas(r.listas);
        setActive((cur) => cur || r.listas[0]?.list_name || "");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeList = useMemo(
    () => listas.find((l) => l.list_name === active) ?? null,
    [listas, active],
  );
  const activePalette = active ? paletas[active] ?? {} : {};
  const filteredListas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listas;
    return listas.filter((lista) => {
      if (lista.list_name.toLowerCase().includes(q)) return true;
      return lista.choices.some((choice) =>
        choice.label.toLowerCase().includes(q) || choice.name.toLowerCase().includes(q),
      );
    });
  }, [listas, query]);

  function applyPreset(colors: string[]) {
    if (!activeList) return;
    const next: Record<string, string> = {};
    activeList.choices.forEach((choice, index) => {
      next[choice.label] = colors[index % colors.length];
    });
    setPaletaLista(activeList.list_name, next);
  }

  return (
    <div className="dash-modal-backdrop" role="presentation">
      <section
        className="dash-modal dash-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Paletas del dashboard"
      >
        <header className="dash-modal-head">
          <div>
            <h2>Paletas por lista</h2>
            <p>Colores estéticos para las opciones del XLSForm.</p>
          </div>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={15} />
          </button>
        </header>

        {loading && <EmptyState title="Cargando listas…" />}
        {error && <EmptyState title="No se pudieron cargar las listas" subtitle={error} />}
        {!loading && !error && listas.length === 0 && (
          <EmptyState
            title="No hay listas disponibles"
            subtitle="Carga primero la fuente del dashboard."
          />
        )}

        {!loading && !error && listas.length > 0 && activeList && (
          <div className="dash-palette-layout">
            <aside className="dash-palette-list">
              <label className="dash-palette-search">
                <Search size={13} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar lista..."
                  aria-label="Buscar lista de opciones"
                />
              </label>
              {filteredListas.map((lista) => {
                const hasPalette = Object.keys(paletas[lista.list_name] ?? {}).length > 0;
                return (
                  <button
                    key={lista.list_name}
                    type="button"
                    className={`dash-palette-list-item ${lista.list_name === active ? "is-active" : ""}`}
                    onClick={() => setActive(lista.list_name)}
                  >
                    <code>{lista.list_name}</code>
                    <span>{hasPalette ? "paleta" : lista.choices.length}</span>
                  </button>
                );
              })}
              {filteredListas.length === 0 && (
                <div className="dash-palette-list-empty">Sin coincidencias.</div>
              )}
            </aside>

            <main className="dash-palette-main">
              <div className="dash-palette-main-head">
                <span className="dash-palette-icon"><Palette size={15} /></span>
                <div>
                  <h3>{activeList.list_name}</h3>
                  <p>{activeList.choices.length} opciones</p>
                </div>
                {Object.keys(activePalette).length > 0 && (
                  <button
                    type="button"
                    className="dash-subtle-btn"
                    onClick={() => removePaletaLista(activeList.list_name)}
                  >
                    <Trash2 size={12} /> Vaciar
                  </button>
                )}
              </div>

              <div className="dash-palette-presets">
                <span><IconAI size={12} /> Predeterminadas</span>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="dash-preset-btn"
                    onClick={() => applyPreset(preset.colors)}
                  >
                    <Swatches colors={preset.colors} />
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="dash-palette-table">
                {activeList.choices.map((choice) => {
                  const color = activePalette[choice.label] ?? "";
                  return (
                    <div key={choice.name} className="dash-palette-row">
                      <code>{choice.name}</code>
                      <span>{choice.label}</span>
                      <input
                        type="color"
                        value={color || "#cccccc"}
                        onChange={(e) =>
                          setColorEnPaletaLista(activeList.list_name, choice.label, e.target.value)
                        }
                        aria-label={`Color de ${choice.label}`}
                      />
                      <input
                        type="text"
                        value={color}
                        placeholder="#cccccc"
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (/^#?[0-9a-fA-F]{0,6}$/.test(raw)) {
                            setColorEnPaletaLista(
                              activeList.list_name,
                              choice.label,
                              raw && !raw.startsWith("#") ? `#${raw}` : raw,
                            );
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </main>
          </div>
        )}
      </section>
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="dash-preset-swatches">
      {colors.slice(0, 5).map((color) => (
        <span key={color} style={{ background: color }} />
      ))}
    </span>
  );
}
