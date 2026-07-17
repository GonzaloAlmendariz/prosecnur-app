/**
 * Botón secundario "Partir de los criterios HST 2025": precarga el BORRADOR de
 * la suite con la selección canónica de la reunión del diseño muestral. Antes
 * de aplicar muestra la mini-lista de lo que va a precargar y, si el borrador
 * tiene cambios sin confirmar, lo advierte y pide confirmación explícita.
 * Control explícito y explicado: nada se confirma ni se aplica al marco desde
 * aquí — cada variable conserva su flujo confirmar/descartar (ADR 0035).
 */
import { useMemo, useState } from "react";
import { Sparkles, TriangleAlert } from "lucide-react";
import type { CriteriosCatalogo, CriteriosSeleccionMarco } from "../../../../api/client";
import { planPresetCanonico, type PresetCanonicoPlan } from "./presetCanonicoModel";

export function PresetCanonicoButton({
  catalogo,
  seleccion,
  borradoresSinConfirmar,
  onPrecargar,
}: {
  catalogo: CriteriosCatalogo;
  /** Selección CONFIRMADA vigente (base sobre la que se calcula el plan). */
  seleccion: CriteriosSeleccionMarco;
  /** Nº de variables con ediciones sin confirmar (la precarga las pisaría). */
  borradoresSinConfirmar: number;
  onPrecargar: (plan: PresetCanonicoPlan) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const plan = useMemo(() => planPresetCanonico(catalogo, seleccion), [catalogo, seleccion]);
  const restrictivos = plan.items.filter((item) => item.restringe);
  const sinCambios = plan.pendientes.length === 0;

  function aplicar() {
    onPrecargar(plan);
    setAbierto(false);
  }

  return (
    <div className="cmv2-crit-preset">
      <button
        type="button"
        className="cmv2-crit-preset-btn"
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => setAbierto((v) => !v)}
        title="Precarga el borrador con los criterios de inclusión de la reunión del diseño muestral (HST 2025); confirmas cada variable después"
      >
        <Sparkles size={14} aria-hidden="true" />
        Partir de los criterios HST 2025
      </button>
      {abierto ? (
        <div className="cmv2-crit-preset-panel" role="dialog" aria-label="Precargar los criterios HST 2025">
          <strong className="cmv2-crit-preset-title">Esto se precarga en el borrador</strong>
          <p className="cmv2-crit-preset-copy">
            Los criterios de inclusión acordados en la reunión del diseño muestral (excluir seminarios,
            tesis, asesorías, investigación, prácticas supervisadas y actividades artísticas). Solo
            cambia el borrador: confirmas cada variable y recalculas el marco cuando decidas.
          </p>
          {restrictivos.length > 0 ? (
            <ul className="cmv2-crit-preset-list">
              {restrictivos.map((item) => (
                <li key={item.variableId}>
                  <strong>{item.label}</strong> · {item.detalle}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cmv2-crit-preset-copy">
              En esta base ninguna variable reconoce categorías canónicas: la precarga deja todo
              incluido (no filtra).
            </p>
          )}
          {restrictivos.length > 0 && restrictivos.length < plan.items.length ? (
            <p className="cmv2-crit-preset-foot">
              Las demás variables quedan con todas sus categorías (no filtran).
            </p>
          ) : null}
          {borradoresSinConfirmar > 0 ? (
            <p className="cmv2-crit-preset-warn" role="alert">
              <TriangleAlert size={13} aria-hidden="true" />
              Tienes {borradoresSinConfirmar}{" "}
              {borradoresSinConfirmar === 1 ? "variable con cambios sin confirmar" : "variables con cambios sin confirmar"}:
              precargar el preset reemplaza esos borradores.
            </p>
          ) : null}
          {sinCambios ? (
            <p className="cmv2-crit-preset-foot">
              Lo confirmado ya coincide con el preset: precargar no deja nada pendiente.
            </p>
          ) : null}
          <div className="cmv2-crit-preset-actions">
            <button type="button" className="cmv2-crit-preset-cancel" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button type="button" className="cmv2-crit-preset-apply" onClick={aplicar}>
              Precargar borrador
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
