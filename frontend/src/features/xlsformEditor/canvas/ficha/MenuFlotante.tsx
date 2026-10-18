// Menú desplegable de la cabecera de la ficha (cambiar tipo, mover a otra sección). Se cierra con Esc o al tocar
// fuera y devuelve el foco a su botón; las flechas recorren las opciones.

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

export function MenuFlotante({ ancla, etiqueta, onCerrar, children, alinear = "inicio" }: {
  ancla: RefObject<HTMLButtonElement | null>;
  etiqueta: string;
  onCerrar: () => void;
  children: ReactNode;
  alinear?: "inicio" | "fin";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const primero = ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    primero?.focus();
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla.current?.contains(t)) return;
      onCerrar();
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [ancla, onCerrar]);

  return (
    <div
      ref={ref}
      className={`xfh-menu is-${alinear}`}
      role="menu"
      aria-label={etiqueta}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCerrar();
          ancla.current?.focus();
          return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const i = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        next?.focus();
      }}
    >
      {children}
    </div>
  );
}
