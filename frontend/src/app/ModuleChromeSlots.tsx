/**
 * Ranuras del chrome del shell.
 *
 * Existe por un caso concreto: la familia Procesamiento. Sus secciones son rutas
 * hermanas (`/carga`, `/validacion`, …) y comparten una sola banda montada en el
 * layout, pero cada página necesita poner algo suyo ahí —el resumen de estado, el
 * selector de base—. Sin un mecanismo, cada página dibujaba su PROPIA banda
 * debajo de la del shell: dos bandas y entre 92 y 114px de chrome antes del
 * contenido, en seis rutas.
 *
 * La página publica su contenido en una ranura y el shell lo renderiza dentro de
 * su banda. Se hace con portal y no con estado compartido a propósito: el shell
 * no se re-renderiza cuando la página cambia su contexto, y no hay que sincronizar
 * dos árboles.
 *
 * Degradación: si la ranura no está montada —porque el módulo dibuja su propia
 * banda, que es el caso de los otros siete— el portal no renderiza nada y
 * `hayRanura` devuelve `false`, así que la página puede decidir dibujarlo inline.
 * El peor caso es lo que ya había, nunca una pantalla vacía.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ZonaChrome = "contexto" | "acciones";

type Registro = Partial<Record<ZonaChrome, HTMLElement>>;

type ValorContexto = {
  registrar: (zona: ZonaChrome, nodo: HTMLElement | null) => void;
  nodos: Registro;
};

const ContextoRanuras = createContext<ValorContexto | null>(null);

export function ModuleChromeSlotsProvider({ children }: { children: ReactNode }) {
  const [nodos, setNodos] = useState<Registro>({});

  const registrar = useCallback((zona: ZonaChrome, nodo: HTMLElement | null) => {
    setNodos((previo) => {
      if (previo[zona] === (nodo ?? undefined)) return previo;
      const siguiente = { ...previo };
      if (nodo) siguiente[zona] = nodo;
      else delete siguiente[zona];
      return siguiente;
    });
  }, []);

  const valor = useMemo(() => ({ registrar, nodos }), [registrar, nodos]);

  return <ContextoRanuras.Provider value={valor}>{children}</ContextoRanuras.Provider>;
}

/**
 * Marca dónde vive una ranura dentro de la banda del shell. Es un contenedor
 * vacío que solo existe para que las páginas tengan a dónde apuntar.
 */
export function ChromeSlotHost({ zona }: { zona: ZonaChrome }) {
  const ctx = useContext(ContextoRanuras);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ctx) return;
    ctx.registrar(zona, ref.current);
    return () => ctx.registrar(zona, null);
    // `ctx.registrar` es estable; `nodos` cambiando no debe reregistrar.
  }, [ctx?.registrar, zona]);

  return <div ref={ref} className="pulso-chrome-slot" data-zona={zona} />;
}

/** ¿Existe la ranura? Le dice a la página si tiene que dibujarlo ella. */
export function useHayRanura(zona: ZonaChrome): boolean {
  const ctx = useContext(ContextoRanuras);
  return Boolean(ctx?.nodos[zona]);
}

/**
 * Publica contenido en una ranura del shell. Se puede declarar en cualquier
 * parte del árbol de la página; el portal lo lleva a la banda.
 */
export function ChromeSlotPortal({
  zona,
  children,
}: {
  zona: ZonaChrome;
  children: ReactNode;
}) {
  const ctx = useContext(ContextoRanuras);
  const destino = ctx?.nodos[zona];
  if (!destino) return null;
  return createPortal(children, destino);
}
