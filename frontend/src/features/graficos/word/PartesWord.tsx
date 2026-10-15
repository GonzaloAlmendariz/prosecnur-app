// Menú de las cinco partes del Word (W1 del rediseño, 2026-10-15) sobre el `foco` de la dirección. Usa el mismo menú
// lateral que las piezas de Identidad (MenuLateral, 2026-10-15: «más profesional y uniforme»). Bajo 1280 px se pone en
// fila (word.css).

import { BarChart3, BookOpen, Bookmark, FileText, ListOrdered } from "../../../vendor/lucide-react";
import { MenuLateral } from "../subpestanas/MenuLateral";
import type { ParteWord } from "./modeloPestanaWord";

type Props = { partes: readonly { key: ParteWord; label: string; resumen: string }[]; actual: ParteWord; onElegir: (k: ParteWord) => void; idPanel: string };

const ICONOS = { documento: FileText, portada: BookOpen, capitulos: ListOrdered, graficos: BarChart3, cierre: Bookmark } as const;

export function PartesWord({ partes, actual, onElegir, idPanel }: Props) {
  return (
    <MenuLateral items={partes.map((p) => ({ clave: p.key, titulo: p.label, resumen: p.resumen, icono: ICONOS[p.key] }))}
      actual={actual} onElegir={onElegir} idPanel={idPanel} etiqueta="Partes del documento" idDe={(k) => `f6-w-parte-${k}`}
      className="pulso-f6-w-partes" grupoQa="graficos/f6-w-partes" contratoQa="intrinsic" />
  );
}
