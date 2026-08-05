/**
 * El tooltip de los gráficos del módulo de cursos-horario.
 *
 * Gonzalo: «el hover es un hover del browser, y lo interesante es que sea un
 * hover profesional, elegante, minimalista que nosotros manejemos».
 *
 * El `title` nativo tiene tres defectos que aquí importan: tarda ~1 s en
 * aparecer, se pinta con la tipografía del sistema operativo (así que un
 * gráfico se ve distinto en macOS y en Windows), y no admite jerarquía, así que
 * un dato con título y tres cifras se aplana en una línea de texto corrido.
 *
 * Delegación, no un handler por nodo: la matriz de cadenas tiene 170 filas por
 * 8 columnas, y montar listeners en cada casilla costaría más que dibujarla.
 * El contenedor escucha una vez y resuelve con `closest`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./graficos.css";

export type TooltipDatos = {
  titulo: string;
  /** Filas del cuerpo: etiqueta a la izquierda, valor a la derecha. */
  filas?: { label: string; valor: string }[];
  /** Una frase al pie, para lo que no es una cifra. */
  nota?: string;
  /** Marca el tono del punto que encabeza el tooltip. */
  tono?: string;
};

/** Serializa los datos a un atributo, para poder leerlos desde la delegación. */
export function tip(datos: TooltipDatos): { "data-tip": string } {
  return { "data-tip": JSON.stringify(datos) };
}

/** Texto plano equivalente, para lectores de pantalla. */
export function tipAria(datos: TooltipDatos): string {
  return [
    datos.titulo,
    ...(datos.filas ?? []).map((f) => `${f.label}: ${f.valor}`),
    datos.nota ?? "",
  ]
    .filter(Boolean)
    .join(". ");
}

const MARGEN = 14;

export function useTooltipGrafico() {
  const [datos, setDatos] = useState<TooltipDatos | null>(null);
  const [punto, setPunto] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ultimo = useRef<Element | null>(null);

  const onMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const objetivo = (event.target as Element | null)?.closest?.("[data-tip]") ?? null;
    setPunto({ x: event.clientX, y: event.clientY });
    if (objetivo === ultimo.current) return;
    ultimo.current = objetivo;
    if (!objetivo) {
      setDatos(null);
      return;
    }
    try {
      setDatos(JSON.parse(objetivo.getAttribute("data-tip") ?? "") as TooltipDatos);
    } catch {
      // Un atributo mal formado deja el tooltip cerrado en vez de romper el
      // recorrido del mouse.
      setDatos(null);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    ultimo.current = null;
    setDatos(null);
  }, []);

  // Cerrar al hacer scroll: el tooltip se ancla al cursor, y si el contenido se
  // mueve debajo pasaría a describir otra casilla.
  useEffect(() => {
    if (!datos) return undefined;
    const cerrar = () => {
      ultimo.current = null;
      setDatos(null);
    };
    window.addEventListener("scroll", cerrar, true);
    return () => window.removeEventListener("scroll", cerrar, true);
  }, [datos]);

  return {
    manejadores: { onMouseMove, onMouseLeave },
    tooltip: <TooltipGrafico datos={datos} punto={punto} />,
  };
}

function TooltipGrafico({
  datos,
  punto,
}: {
  datos: TooltipDatos | null;
  punto: { x: number; y: number };
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Se mide después de pintar para poder voltearlo contra el borde: sin esto,
  // una casilla del extremo derecho de la matriz abriría el tooltip fuera de la
  // ventana, que es justo donde están las cadenas más profundas.
  useEffect(() => {
    if (!datos || !caja.current) {
      setPos(null);
      return;
    }
    const rect = caja.current.getBoundingClientRect();
    const left = punto.x + MARGEN + rect.width > window.innerWidth
      ? Math.max(MARGEN, punto.x - MARGEN - rect.width)
      : punto.x + MARGEN;
    const top = punto.y + MARGEN + rect.height > window.innerHeight
      ? Math.max(MARGEN, punto.y - MARGEN - rect.height)
      : punto.y + MARGEN;
    setPos({ left, top });
  }, [datos, punto.x, punto.y]);

  if (!datos) return null;

  return createPortal(
    <div
      ref={caja}
      className="cmv2-graf-tip"
      role="presentation"
      style={{
        left: pos?.left ?? punto.x + MARGEN,
        top: pos?.top ?? punto.y + MARGEN,
        // Invisible hasta tener medida: aparecer en el sitio equivocado y
        // saltar se nota más que aparecer un fotograma después.
        opacity: pos ? 1 : 0,
      }}
    >
      <p className="cmv2-graf-tip-titulo">
        {datos.tono ? <span className="cmv2-graf-tip-punto" data-tono={datos.tono} /> : null}
        {datos.titulo}
      </p>
      {datos.filas?.length ? (
        <dl className="cmv2-graf-tip-filas">
          {datos.filas.map((fila) => (
            <div key={fila.label}>
              <dt>{fila.label}</dt>
              <dd>{fila.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {datos.nota ? <p className="cmv2-graf-tip-nota">{datos.nota}</p> : null}
    </div>,
    document.body,
  );
}
