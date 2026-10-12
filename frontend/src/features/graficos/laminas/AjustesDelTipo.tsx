// «Usar estos ajustes en todos los gráficos de este tipo» (reemplaza la pestaña PowerPoint, Gonzalo 2026-10-11): los
// ajustes de forma que el usuario hizo en ESTE gráfico pasan a ser los del tipo para todo el informe. Sólo se copian
// ajustes de forma; lo propio del gráfico (título, preguntas, filtros, nota) se queda en él.

import type { GraficadorRef } from "../../../api/graficos";
import { toast } from "../../../components/toasterStore";
import { graficadorDisplayName } from "../graficadorDisplay";
import { graficadorToPresetType } from "../graficadorPresetMap";
import { usePlanStore } from "../store";
import { useGraficosRegistry } from "../useGraficosRegistry";

/** Lo que es de este gráfico y no un ajuste de forma del tipo. */
const PROPIOS = new Set(["titulo", "subtitulo", "nota_pie", "etiqueta_corta", "etiquetas_cortas", "var", "vars", "variable",
  "variables", "bloques", "filtros", "titulos_grupo", "orden_categorias", "top2box_labels", "bottom2box_labels", "excluir_opciones"]);

export function ajustesDeForma(args: Record<string, unknown>): Record<string, unknown> {
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  return Object.fromEntries(Object.entries(ov).filter(([k, v]) => !PROPIOS.has(k) && v !== undefined && v !== null));
}

export function conAjustesEnElTipo(presets: Record<string, Record<string, unknown>>, tipo: string, ajustes: Record<string, unknown>) {
  return { ...presets, [tipo]: { ...(presets[tipo] ?? {}), ...ajustes } };
}

export function AjustesDelTipo({ valor }: { valor: GraficadorRef }) {
  const presets = usePlanStore((s) => s.presets);
  const setPresets = usePlanStore((s) => s.setPresets);
  const undo = usePlanStore((s) => s.undo);
  const { graficadoresById } = useGraficosRegistry();
  const tipo = graficadorToPresetType(valor.graficador);
  if (!tipo) return null;
  const ajustes = ajustesDeForma((valor.args ?? {}) as Record<string, unknown>);
  const n = Object.keys(ajustes).length;
  const nombre = graficadorDisplayName(valor.graficador, graficadoresById[valor.graficador]).toLowerCase();
  const aplicar = () => {
    setPresets(conAjustesEnElTipo(presets as Record<string, Record<string, unknown>>, tipo, ajustes));
    toast.exito(`Los gráficos de ${nombre} usan ahora estos ajustes`, {
      detalle: `${n} ${n === 1 ? "ajuste" : "ajustes"} pasan a todo el informe; cada gráfico conserva lo que cambió a mano.`,
      accion: { label: "Deshacer", onSelect: () => undo() },
    });
  };
  return (
    <div className="pulso-f6-dato" data-qa="ajustes-del-tipo">
      <span className="pulso-f6-dato-rotulo">Para todos los gráficos de {nombre}</span>
      <button type="button" className="pulso-f6-boton pulso-f6-dato-accion" disabled={n === 0} onClick={aplicar}
        title={n === 0 ? "Este gráfico no tiene ajustes propios que compartir" : undefined}>
        Usar estos ajustes
      </button>
    </div>
  );
}
