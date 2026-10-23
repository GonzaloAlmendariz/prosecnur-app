import { AvanceCuotasVista } from "./AvanceCuotasVista";
import { useConfiguracionDeCuotas } from "./useConfiguracionDeCuotas";

// Monitoreo › Acreditación › Avance › Cuotas (checklist T2, 2026-10-22).
//
// Contenedor: la configuración (lectura, dirección, proponer, guardar y quitar)
// vive en `useConfiguracionDeCuotas`, que comparte con Modelo › Cuotas; aquí
// solo se monta la vista de lectura con su panel.

export function AvanceCuotas() {
  const { s, foco, irA, cargar, panelNode } = useConfiguracionDeCuotas();
  return (
    <AvanceCuotasVista
      s={s}
      foco={foco}
      onElegir={(id) => irA({ panel: false, foco: id })}
      onAgregar={() => irA({ panel: true, foco: "" })}
      onEditar={(id) => irA({ panel: true, foco: id })}
      onReintentar={() => { void cargar(); }}
      panel={panelNode}
    />
  );
}

export default AvanceCuotas;
