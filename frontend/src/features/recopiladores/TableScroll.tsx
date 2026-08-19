import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

// `.rec-table-scroll` recorta la tabla en anchos angostos -1024x600 es una de
// las medidas oficiales de la matriz de QA visual- sin ninguna pista de que
// quedan columnas fuera de vista: la barra de scroll del sistema es
// auto-oculta en la mayoría de equipos modernos, así que "Estado" (la
// columna que de verdad importa: Listo/Pendiente) podía desaparecer sin que
// nadie supiera que había que desplazarse para verla. La sombra sólo
// aparece del lado donde de verdad queda contenido sin ver.
export function TableScroll({ children, className, ...rest }: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMoreLeft, setHasMoreLeft] = useState(false);
  const [hasMoreRight, setHasMoreRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setHasMoreLeft(el.scrollLeft > 1);
      setHasMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    // ResizeObserver cubre cuando el contenedor cambia por el layout (el
    // panel de al lado se abre/cierra, por ejemplo); `resize` de window
    // cubre el caso más común -cambiar el ancho de la ventana- con una señal
    // que todo navegador dispara de forma confiable. Ninguno de los dos solo
    // alcanza.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const classes = [
    "rec-table-scroll",
    hasMoreLeft ? "has-scroll-left" : "",
    hasMoreRight ? "has-scroll-right" : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
}
