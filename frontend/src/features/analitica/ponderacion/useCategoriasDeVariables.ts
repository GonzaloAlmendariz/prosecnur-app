// Categorías de las variables que la ponderación usa (ajuste, estrato y las que
// se asignan a un margen del censo), leídas una vez por variable.
//
// Antes un fallo de lectura se tragaba y la fila quedaba en "Cargando" para
// siempre. Ahora la variable que falla se publica en `fallidas`, y volver a
// pedirla la reintenta.

import { useCallback, useEffect, useRef, useState } from "react";

import { apiAnaliticaColumnValues, type ValorColumna } from "../../../api/analitica";

export type CategoriasDeVariables = {
  categorias: Record<string, ValorColumna[]>;
  fallidas: readonly string[];
  pedir: (variable: string) => void;
};

export function useCategoriasDeVariables(enUso: readonly string[]): CategoriasDeVariables {
  const [categorias, setCategorias] = useState<Record<string, ValorColumna[]>>({});
  const [fallidas, setFallidas] = useState<readonly string[]>([]);
  const pedidas = useRef(new Set<string>());
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const pedir = useCallback((variable: string) => {
    if (!variable || pedidas.current.has(variable)) return;
    pedidas.current.add(variable);
    setFallidas((antes) => (antes.includes(variable) ? antes.filter((v) => v !== variable) : antes));
    apiAnaliticaColumnValues(variable).then(
      (r) => {
        if (montado.current) setCategorias((c) => ({ ...c, [variable]: r.values }));
      },
      () => {
        pedidas.current.delete(variable);
        if (montado.current) setFallidas((antes) => (antes.includes(variable) ? antes : [...antes, variable]));
      },
    );
  }, []);

  const clave = enUso.filter(Boolean).join("\n");
  useEffect(() => {
    for (const variable of clave ? clave.split("\n") : []) pedir(variable);
  }, [clave, pedir]);

  return { categorias, fallidas, pedir };
}
