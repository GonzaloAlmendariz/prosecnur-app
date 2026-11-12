/**
 * Las opciones (código y etiqueta) de una pregunta de opción única o múltiple,
 * pedidas una vez por panel.
 *
 * Era `useVariableOptions` de `components/ReglaEditor.tsx`, que pedía la lista
 * en cada campo. Aquí el panel pone un `OpcionesProvider` y todos sus campos, y
 * "Casos que marca hoy", comparten la misma promesa por pregunta mientras el
 * panel está abierto. Fuera de un proveedor cada campo pide la suya, como
 * antes.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiV2ExplorarValores, type ExplorarValoresResult } from "../../../../api/validacion";

export type OpcionDeVariable = ExplorarValoresResult["opciones"][number];

type Cache = Map<string, Promise<OpcionDeVariable[]>>;

const ContextoDeOpciones = createContext<{ cache: Cache; baseNombre: string | null } | null>(null);

export function OpcionesProvider({ baseNombre, children }: { baseNombre: string | null; children: ReactNode }) {
  const [cache] = useState<Cache>(() => new Map());
  const valor = useMemo(() => ({ cache, baseNombre }), [cache, baseNombre]);
  return (
    <ContextoDeOpciones.Provider value={valor}>
      {children}
    </ContextoDeOpciones.Provider>
  );
}

function pedir(variable: string, baseNombre: string | null | undefined, cache: Cache | null): Promise<OpcionDeVariable[]> {
  const clave = `${baseNombre ?? ""}\u0000${variable}`;
  const guardada = cache?.get(clave);
  if (guardada) return guardada;
  const promesa = apiV2ExplorarValores(variable, baseNombre)
    .then((res) => normalizarOpciones(res.opciones))
    .catch(() => {
      cache?.delete(clave);
      return [];
    });
  cache?.set(clave, promesa);
  return promesa;
}

/**
 * Código y etiqueta como texto. R manda los códigos como números (`1`, no
 * `"1"`): sin esto el desplegable no encuentra la opción elegida, que se
 * guarda como texto, y se queda en blanco.
 */
export function normalizarOpciones(crudas: unknown): OpcionDeVariable[] {
  if (!Array.isArray(crudas)) return [];
  return crudas
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => {
      const code = o.code === null || o.code === undefined ? "" : String(o.code);
      const label = o.label === null || o.label === undefined || String(o.label).trim() === "" ? code : String(o.label);
      const n = Number(o.n);
      return { code, label, n: Number.isFinite(n) ? n : 0 };
    })
    .filter((o) => o.code !== "");
}

/** Las opciones de la pregunta; vacías mientras cargan, si no las tiene o si no se pudieron leer. */
export function useOpcionesDeVariable(variable: string | null | undefined, baseNombre?: string | null) {
  const contexto = useContext(ContextoDeOpciones);
  const base = baseNombre ?? contexto?.baseNombre ?? null;
  const [estado, setEstado] = useState<{ loading: boolean; options: OpcionDeVariable[] }>({ loading: false, options: [] });

  useEffect(() => {
    if (!variable) {
      setEstado({ loading: false, options: [] });
      return;
    }
    let cancelado = false;
    setEstado((prev) => ({ ...prev, loading: true }));
    void pedir(variable, base, contexto?.cache ?? null).then((options) => {
      if (!cancelado) setEstado({ loading: false, options });
    });
    return () => {
      cancelado = true;
    };
  }, [variable, base, contexto]);

  return estado;
}

/** Las opciones de varias preguntas a la vez, por nombre (para leer los valores de una tabla). */
export function useOpcionesDeVariables(variables: readonly string[]): ReadonlyMap<string, OpcionDeVariable[]> {
  const contexto = useContext(ContextoDeOpciones);
  const [mapa, setMapa] = useState<ReadonlyMap<string, OpcionDeVariable[]>>(new Map());
  const clave = variables.join("\u0000");
  useEffect(() => {
    const lista = clave ? clave.split("\u0000") : [];
    if (!lista.length) {
      setMapa(new Map());
      return;
    }
    let cancelado = false;
    void Promise.all(lista.map((v) => pedir(v, contexto?.baseNombre, contexto?.cache ?? null).then((o) => [v, o] as const))).then(
      (pares) => {
        if (!cancelado) setMapa(new Map(pares));
      },
    );
    return () => {
      cancelado = true;
    };
  }, [clave, contexto]);
  return mapa;
}

/** "Hombre (1)": la etiqueta, con el código al lado si es distinto. Sin etiqueta, el código. */
export function etiquetaDeOpcion(opcion: OpcionDeVariable | undefined, codigo: string): string {
  if (!opcion) return codigo;
  const etiqueta = opcion.label || opcion.code;
  return opcion.code && opcion.code !== etiqueta ? `${etiqueta} (${opcion.code})` : etiqueta;
}
