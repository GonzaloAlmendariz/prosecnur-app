import { useEffect, useState } from "react";

import { apiPlannerEstado } from "../../api/planner";
import { EVENTO_ESTUDIO_DECLARADO } from "../estudio/useEstudioDeclarado";
import { useCalcMuestraStore } from "./store";

/**
 * La identidad del estudio (nombre y cliente) se declara en la Ficha del estudio (ADR 0124):
 * Cálculo de muestra la lee y no la escribe. `null` mientras carga o si la
 * ficha no se pudo leer; el que la pinta dice «sin título».
 */
export type IdentidadDelEstudio = { nombre: string; cliente: string };

type CampoDeCalculo = { titulo: string; cliente: string };

/**
 * Lo que Cálculo tiene que adoptar de la Ficha para que las dos pantallas digan lo mismo (4 nov 2026:
 * la Ficha salía «Sin declarar» mientras Cálculo › Estudio decía «Encuesta a estudiantes»). Manda la
 * Ficha; un campo vacío en la Ficha no borra lo que Cálculo ya tenía (no se destruye un dato viejo por
 * no estar declarado todavía). `null` si no hay nada que cambiar.
 */
export function loQueAdoptaCalculo(
  ficha: IdentidadDelEstudio | null,
  calculo: CampoDeCalculo,
): Partial<CampoDeCalculo> | null {
  if (!ficha) return null;
  const cambios: Partial<CampoDeCalculo> = {};
  const nombre = ficha.nombre.trim();
  const cliente = ficha.cliente.trim();
  if (nombre && nombre !== calculo.titulo) cambios.titulo = nombre;
  if (cliente && cliente !== calculo.cliente) cambios.cliente = cliente;
  return Object.keys(cambios).length ? cambios : null;
}

export function usePlannerIdentidad(): IdentidadDelEstudio | null {
  const [identidad, setIdentidad] = useState<IdentidadDelEstudio | null>(null);
  const titulo = useCalcMuestraStore((s) => s.estudio.titulo);
  const cliente = useCalcMuestraStore((s) => s.estudio.contexto.cliente);
  useEffect(() => {
    let vivo = true;
    const leer = () => apiPlannerEstado()
      .then((e) => { if (vivo) setIdentidad({ nombre: e.planner.estudio.nombre, cliente: e.planner.estudio.cliente }); })
      .catch(() => { if (vivo) setIdentidad(null); });
    void leer();
    window.addEventListener(EVENTO_ESTUDIO_DECLARADO, leer);
    return () => { vivo = false; window.removeEventListener(EVENTO_ESTUDIO_DECLARADO, leer); };
  }, []);
  // Cálculo guarda una copia del nombre y del cliente que leen sus entregables (paquete de defensa,
  // contexto del reporte, estado de la pestaña). Se alinea con la Ficha en cuanto se lee, y otra vez
  // si una hidratación posterior trae la copia vieja.
  useEffect(() => {
    const cambios = loQueAdoptaCalculo(identidad, { titulo, cliente: cliente ?? "" });
    if (!cambios) return;
    const { setTitulo, setContexto } = useCalcMuestraStore.getState();
    if (cambios.titulo !== undefined) setTitulo(cambios.titulo);
    if (cambios.cliente !== undefined) setContexto("cliente", cambios.cliente);
  }, [identidad, titulo, cliente]);
  return identidad;
}
