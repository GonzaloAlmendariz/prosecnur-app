// Las variables por las que se abre el comparativo de cruces, en un panel lateral
// (`?panel=comparativo-cruces`). Monta la lista de siempre; "Columnas del
// comparativo" dice lo elegido y lo abre.

import type { ComponentProps } from "react";

import { Sideover } from "../../../components/Sideover";
import { Grid3X3 } from "../../../vendor/lucide-react";
import { PANEL_COMPARATIVO_CRUCES } from "../panelesAnalitica";
import { ComparativosLista } from "../panes/ComparativosLista";

export function PanelDeCruces(props: Omit<ComponentProps<typeof ComparativosLista>, "id" | "titulo" | "ayuda" | "marca">) {
  return (
    <Sideover
      panel={PANEL_COMPARATIVO_CRUCES}
      title="Abrir por"
      subtitle="Variables de cruce del comparativo de cruces"
      icon={<Grid3X3 size={16} aria-hidden="true" />}
      alto="contenido"
      className="comparativos-ajuste-panel"
    >
      <ComparativosLista
        {...props}
        id="comparativos-cruces"
        titulo="Variables de cruce"
        ayuda="Cada pregunta se abre por las respuestas de la variable de cruce, y esa variable no se tabula como pregunta en ese archivo. Los segmentos de cruce del estudio vienen elegidos."
        marca="Segmento de cruce del estudio"
      />
    </Sideover>
  );
}
