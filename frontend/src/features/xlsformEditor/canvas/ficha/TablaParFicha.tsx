// Ficha de la tabla de un par de un experimento de elección por pares (checklist elección por pares C9, 2026-11-07).
// La tabla la arma el diseño del experimento: aquí se ve como la verá el encuestado, con un sorteo de ejemplo, y se
// edita en la pestaña Experimentos. El markdown con las referencias queda abajo como texto en XLSForm, sólo de lectura.

import { useMemo, useState } from "react";
import { Shuffle } from "../../../../vendor/lucide-react";
import { renderMarkdownInline } from "../../helpers/markdown";
import { conTablasHtml } from "../../helpers/markdownTabla";
import "../../helpers/markdownTabla.css";
import { calcularValores, semillaNueva } from "../../shell/simulador/calculosPrueba";
import type { BuilderNode, BuilderStructure } from "../../types";
import { BloqueFicha } from "./piezasFicha";

export function TablaParFicha({ node, structure, tarea, onEditarDiseno }: {
  node: BuilderNode;
  structure: BuilderStructure | null;
  tarea: number;
  onEditarDiseno: () => void;
}) {
  const [semilla, setSemilla] = useState(semillaNueva);
  const html = useMemo(() => {
    const valores = calcularValores(structure?.outline ?? [], {}, semilla);
    return conTablasHtml(node.label.replace(/\$\{([^}]+)\}/g, (_m, n: string) => valores[n] ?? ""), renderMarkdownInline);
  }, [node.label, structure, semilla]);
  return (
    <BloqueFicha
      titulo={`Tabla del par ${tarea}`}
      accion={
        <button type="button" className="xfh-boton" onClick={onEditarDiseno}>
          Editar en Experimentos
        </button>
      }
    >
      <div className="xfh-tabla-par" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="xfh-tabla-par__pie">
        <span>Un sorteo de ejemplo; cada entrevista sortea el suyo.</span>
        <button type="button" className="xfh-boton" onClick={() => setSemilla(semillaNueva())}>
          <Shuffle size={13} aria-hidden="true" /> Otro sorteo
        </button>
      </div>
      <div className="xfp-codigo-xls">
        <span className="xfp-codigo-xls__rot">Texto en XLSForm</span>
        <code className="xfh-tabla-par__xls">{node.label}</code>
      </div>
    </BloqueFicha>
  );
}
