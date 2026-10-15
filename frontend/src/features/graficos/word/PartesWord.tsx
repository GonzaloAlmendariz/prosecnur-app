// Las cinco partes del Word (W1 del rediseño, 2026-10-15) sobre el `foco` de la dirección, con la columna de partes
// compartida (`components/ListaPartes`, la misma de Identidad y del Impreso del editor de formularios: «más profesional
// y uniforme»). Sin estado: el Word no tiene uno real por parte; el detalle ya dice lo que hay («19 capítulos»).

import { ListaPartes, type GrupoDePartes } from "../../../components/ListaPartes";
import type { ParteWord } from "./modeloPestanaWord";

/** Prefijo de los ids de fila: el detalle cita `${PREFIJO_PARTE_WORD}-${parte}` en `aria-labelledby`. */
export const PREFIJO_PARTE_WORD = "f6-w-parte";

type Props = { partes: readonly { key: ParteWord; label: string; resumen: string }[]; actual: ParteWord; onElegir: (k: ParteWord) => void; idPanel: string };

export function PartesWord({ partes, actual, onElegir, idPanel }: Props) {
  const grupos: GrupoDePartes<ParteWord>[] = [{ id: "word", partes: partes.map((p) => ({ clave: p.key, rotulo: p.label, detalle: p.resumen })) }];
  return (
    <ListaPartes etiqueta="Partes del documento" grupos={grupos} actual={actual} onElegir={onElegir} idPanel={idPanel}
      prefijoId={PREFIJO_PARTE_WORD} className="pulso-f6-w-partes" />
  );
}
