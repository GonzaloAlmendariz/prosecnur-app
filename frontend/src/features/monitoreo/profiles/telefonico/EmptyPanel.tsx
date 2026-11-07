import { ClipboardCheck } from "lucide-react";
import { EstadoVacio } from "../../../../components/EstadoVacio";

// Estado vacío canónico del perfil, extraído del page-file congelado
// (TelefonicoMonitoreoPage.tsx). Copia por perfil deliberada (ver formato.ts).
// Ocupa la superficie entera: va por la receta del kit en tamaño `normal`.

export function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return <EstadoVacio tamano="normal" icono={<ClipboardCheck size={18} />} titulo={title} descripcion={detail} />;
}
