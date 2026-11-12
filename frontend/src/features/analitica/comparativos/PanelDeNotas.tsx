// Las notas al pie de los dos comparativos, en un panel lateral
// (`?panel=comparativo-notas`). Monta el editor único de notas al pie.

import { Sideover } from "../../../components/Sideover";
import { FileText } from "../../../vendor/lucide-react";
import { PANEL_COMPARATIVO_NOTAS } from "../panelesAnalitica";
import { NotasPieEditor, type NotasPieEditorProps } from "../panes/NotasPieEditor";

export function PanelDeNotas(props: Omit<Extract<NotasPieEditorProps, { variante: "comparativo" }>, "variante">) {
  return (
    <Sideover
      panel={PANEL_COMPARATIVO_NOTAS}
      title="Notas al pie"
      subtitle="Van bajo las tablas de los dos comparativos"
      icon={<FileText size={16} aria-hidden="true" />}
      alto="contenido"
      className="comparativos-ajuste-panel"
    >
      <NotasPieEditor {...props} variante="comparativo" abierta />
    </Sideover>
  );
}
