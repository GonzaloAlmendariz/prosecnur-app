import { Dialog } from "../../components/Dialog";
import { nombreDeAtajo } from "../../lib/teclado";
import { Keyboard } from "../../vendor/lucide-react";
import { modulosDelDock } from "./atajosDeModulos";
import { PANEL_ATAJOS_APP } from "./panelesHome";
import { useProjectModules } from "../project/ProjectModulesContext";
import "./paleta-de-comandos.css";

// Atajos de la app (L30): lo que funciona en cualquier pantalla. Cada módulo
// suma los suyos en su propia ayuda (Gráficos tiene la suya con «?»). Las
// teclas se rotulan con la del sistema en que se mira: ⌘ en macOS, Ctrl en
// Windows (lib/teclado).
export function AtajosDeLaApp() {
  const { addedSlugs } = useProjectModules();
  const modulos = modulosDelDock(addedSlugs).slice(0, 8);
  const filas: Array<{ teclas: string; que: string }> = [
    { teclas: nombreDeAtajo("K"), que: "Ir a cualquier vista (paleta de comandos)" },
    ...modulos.map((modulo, i) => ({ teclas: nombreDeAtajo(String(i + 1)), que: `Abrir ${modulo.title}` })),
    { teclas: "?", que: "Esta ayuda (dentro de Gráficos abre la suya)" },
  ];
  return (
    <Dialog panel={PANEL_ATAJOS_APP} size="sm" title="Atajos de teclado" icon={<Keyboard size={16} aria-hidden="true" />}>
      <dl className="pulso-atajos-lista">
        {filas.map((fila) => (
          <div className="pulso-atajos-fila" key={fila.teclas}>
            <dt><kbd>{fila.teclas}</kbd></dt>
            <dd>{fila.que}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
