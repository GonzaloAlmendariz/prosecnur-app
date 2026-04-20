import { FileText } from "lucide-react";
import { Panel } from "../../../components/Panel";

// SPSS pane — sin argumentos configurables; solo explicación.

export function SpssPane() {
  return (
    <Panel
      eyebrow="Configuración"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FileText size={14} /> Exportar SPSS</span>}
      hint={<>Exporta el dataset etiquetado como <code>.sav</code> y la sintaxis de niveles como <code>.sps</code>, empaquetados en un zip.</>}
    >
      <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        Este reporte no tiene argumentos configurables. Se genera con la data preparada en el paso 1 e incluye
        todas las variables del instrumento con sus value-labels y measures correspondientes.
      </div>
    </Panel>
  );
}
