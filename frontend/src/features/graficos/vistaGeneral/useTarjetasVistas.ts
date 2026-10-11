// Qué tarjetas llegaron a verse (F6.3; plan F6 §7 R7: «nunca render masivo al montar»). La Vista general sólo pide al
// lote de miniaturas las láminas que entraron en el área visible de su contenedor; una vez vista, una lámina sigue en
// el pedido (si no, un lote reemplazado la dejaría en esqueleto al desplazarse ida y vuelta). Las demás muestran su
// composición o su ficha hasta que se vean.

import { useEffect, useRef, useState, type RefObject } from "react";

const SELECTOR = "[data-vg-tarjeta]";

export function useTarjetasVistas(raiz: RefObject<HTMLElement>, firma: string): ReadonlySet<string> {
  const [vistas, setVistas] = useState<ReadonlySet<string>>(() => new Set());
  const pendientes = useRef(new Set<string>());

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Sin observador (entorno de prueba): todo cuenta como visto, como hacía la tira.
      setVistas(new Set([...el.querySelectorAll<HTMLElement>(SELECTOR)].map((n) => n.dataset.vgTarjeta ?? "").filter(Boolean)));
      return;
    }
    let marco = 0;
    const volcar = () => {
      marco = 0;
      const nuevos = [...pendientes.current];
      pendientes.current.clear();
      setVistas((prev) => (nuevos.every((id) => prev.has(id)) ? prev : new Set([...prev, ...nuevos])));
    };
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        const id = (e.target as HTMLElement).dataset.vgTarjeta;
        if (e.isIntersecting && id) pendientes.current.add(id);
      }
      if (pendientes.current.size && !marco) marco = requestAnimationFrame(volcar);
    }, { root: el, rootMargin: "120px 0px" });
    el.querySelectorAll<HTMLElement>(SELECTOR).forEach((n) => io.observe(n));
    return () => { io.disconnect(); if (marco) cancelAnimationFrame(marco); };
  }, [raiz, firma]);

  return vistas;
}
