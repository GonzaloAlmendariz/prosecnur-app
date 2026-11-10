// Una entrega cuyo archivo trae algo que decir en palabras (qué lleva dentro el
// libro, cuántos aplicadores trae escritos la plantilla): la nota va al pie del
// contenedor cuando el archivo está listo, no en un aviso suelto de la página.

import { useState, type ReactNode } from "react";

import type { Articulo } from "../../../components/entregables/generacionModelo";
import { useEntrega, type EntregaMonitoreo } from "./useEntrega";
import "./entregas.css";

export type EntregaConNota = { entrega: EntregaMonitoreo; pedir: () => void; pie: ReactNode };

export function useEntregaConNota<T>(
  titulo: string,
  opciones: { formato?: string | null; articulo?: Articulo | null },
  generar: (() => Promise<T>) | null | undefined,
  notaDe: (resultado: T) => string,
): EntregaConNota {
  const entrega = useEntrega(titulo, opciones);
  const [nota, setNota] = useState("");
  const pedir = () => {
    if (!generar) return;
    setNota("");
    void entrega.ejecutar(async () => {
      const resultado = await generar();
      setNota(notaDe(resultado));
      return resultado;
    });
  };
  const pie = nota && entrega.estado.fase === "lista" ? <span className="mon-entrega-nota">{nota}</span> : undefined;
  return { entrega, pedir, pie };
}
