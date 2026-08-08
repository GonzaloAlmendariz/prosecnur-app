/**
 * Piezas del goo del relato (dirección congelada 2026-08-07, ADR 0067).
 *
 * El layout es una función DETERMINISTA de los datos: espiral de ángulo áureo
 * indexada por el orden que el dato ya trae (tamaño publicado en el bombo,
 * `discount_step` en el ensamblaje). Cero azar: dos aperturas del mismo
 * deep-link pintan exactamente el mismo campo de bolas.
 */
import { useEffect, useId, useRef, useState } from "react";

import { fmtInt, fmtPct } from "../../../../sharedCore";
import { MotorGoo, motorDisponible } from "../motorGoo";
import type { RelatoBola, RelatoMasaBombo } from "../relatoModel";

/**
 * UN motor para toda la app: el bucle de rAF es compartido por construcción
 * (ver `MotorGoo`), y tener uno por escena reintroduciría justo el problema que
 * la clase evita — varios acumuladores compitiendo, desincronía no determinista
 * y un `requestAnimationFrame` por componente.
 */
const motorCompartido = new MotorGoo();

/**
 * Conecta una bola al motor de asentamiento. Devuelve el ref del grupo animado
 * y si el motor quedó a cargo.
 *
 * Cuando el motor NO está disponible —reduced-motion, jsdom, SSR— el hook no
 * hace nada y el `@keyframes` CSS sigue siendo el camino: realce progresivo, no
 * sustitución. Por eso la clase `is-motor` se agrega sólo cuando hay motor; es
 * la que apaga la animación declarativa para que las dos no se peleen el mismo
 * `transform`.
 */
export function useAsentamientoGoo(radio: number, index: number) {
  const id = useId();
  const ref = useRef<SVGGElement | null>(null);
  const [conMotor] = useState(motorDisponible);

  useEffect(() => {
    const nodo = ref.current;
    if (!conMotor || !nodo) return undefined;
    motorCompartido.soltar(id, radio, index, (escala) => {
      // Se escribe en el estilo, no en el estado de React: un re-render por
      // cuadro y por bola convertiría 60 bolas en 3,600 renders por segundo.
      nodo.style.setProperty("--goo-escala", escala.toFixed(4));
    });
    return () => motorCompartido.quitar(id);
  }, [conMotor, id, index, radio]);

  return { ref, conMotor };
}

/** Ángulo áureo en radianes: espiral de Vogel, constante y determinista. */
const ANGULO_AUREO = 2.399963229728653;

export type PosicionGoo = { x: number; y: number };

/** Posición i-ésima (0-based) de una espiral de Vogel en un viewBox 0–100. */
export function posicionGoo(index: number, total: number): PosicionGoo {
  const radio = 41 * Math.sqrt((index + 0.5) / Math.max(1, total));
  return {
    x: 50 + radio * Math.cos(index * ANGULO_AUREO),
    y: 50 + radio * Math.sin(index * ANGULO_AUREO),
  };
}

/**
 * Radio de la bola en unidades del viewBox: escala monótona del dato real
 * (`eligible_n` o el neto del paso). Sin dato publicado, radio mínimo.
 */
export function radioGoo(elegibles: number | null, maxElegibles: number): number {
  if (elegibles == null || elegibles <= 0 || maxElegibles <= 0) return 2.2;
  return 2.6 + 5.2 * Math.sqrt(Math.min(1, elegibles / maxElegibles));
}

export function maxElegiblesDeBolas(bolas: Array<{ elegibles: number | null }>): number {
  return Math.max(1, ...bolas.map((bola) => bola.elegibles ?? 0));
}

/**
 * Origen de la bola k en el borde del bombo (perímetro), antes de despegar
 * hacia el cluster. Misma espiral áurea: función pura del índice.
 */
export function origenBombo(index: number): PosicionGoo {
  const angulo = index * ANGULO_AUREO;
  return {
    x: 50 + 46 * Math.cos(angulo),
    y: 50 + 46 * Math.sin(angulo),
  };
}

/**
 * Punto de control del arco de vuelo origen → destino: el punto medio
 * desplazado perpendicularmente un 18 % de la distancia. Determinista: dos
 * renders del mismo paso dibujan exactamente el mismo arco.
 */
export function arcoGoo(origen: PosicionGoo, destino: PosicionGoo): PosicionGoo {
  const dx = destino.x - origen.x;
  const dy = destino.y - origen.y;
  return {
    x: (origen.x + destino.x) / 2 - dy * 0.18,
    y: (origen.y + destino.y) / 2 + dx * 0.18,
  };
}

/**
 * Membrana/tirante entre dos bolas vecinas del cluster (el «goo» de verdad):
 * curva cuadrática entre centros con curvatura leve y determinista. El punto
 * de control es fijo; la vibración de cuerda al tensarse se emula con un
 * keyframe amortiguado sobre el path (CSS no puede reanimar el bezier).
 */
export function membranaGoo(
  a: PosicionGoo & { r: number },
  b: PosicionGoo & { r: number },
): { d: string; grosor: number } {
  const control = arcoGoo(a, b);
  return {
    d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
    grosor: Math.max(0.8, Math.min(a.r, b.r) * 0.7),
  };
}

/**
 * Las DOS vecinas más cercanas de la bola k entre las ya colocadas (0..k-1),
 * por distancia euclidiana sobre el layout YA calculado. Es la topología de
 * los tirantes (red masa-resorte destilada) y el primer grado de la
 * propagación. Determinista: desempata por índice.
 */
export function vecinasMasCercanas(k: number, posiciones: PosicionGoo[]): number[] {
  const propia = posiciones[k];
  if (!propia) return [];
  return posiciones
    .slice(0, k)
    .map((posicion, index) => ({
      index,
      distancia: (posicion.x - propia.x) ** 2 + (posicion.y - propia.y) ** 2,
    }))
    .sort((a, b) => a.distancia - b.distancia || a.index - b.index)
    .slice(0, 2)
    .map((vecina) => vecina.index);
}

/**
 * Bola viva (idle): duración y fase del bobbing DISTINTAS por bola, con la
 * fórmula determinista de la dirección (3s + (i % 5) · 0.35s; fase i · 0.13s).
 * La desincronía es lo que hace orgánico el bombo — jamás todas al unísono.
 */
export function bobbingDeBola(index: number): { duracion: string; fase: string } {
  return {
    duracion: `${(3 + (index % 5) * 0.35).toFixed(2)}s`,
    fase: `${(index * 0.13).toFixed(2)}s`,
  };
}

/**
 * Una bola del goo. La certeza lleva doble contorno (forma, no solo color) y
 * su rótulo es «certeza · sin sorteo»; la sorteada lleva su π al lado.
 */
export function BolaGoo({
  bola,
  index,
  total,
  maxElegibles,
  anillo = null,
  etiquetaExtra,
}: {
  bola: RelatoBola;
  index: number;
  total: number;
  maxElegibles: number;
  /** Traslape anotado al ensamblarse (`ya_cubiertos` post-hoc); null = sin anillo. */
  anillo?: number | null;
  etiquetaExtra?: string;
}) {
  const { x, y } = posicionGoo(index, total);
  const r = radioGoo(bola.elegibles, maxElegibles);
  const asentamiento = useAsentamientoGoo(r, index);
  const clase = [
    "cmv2-relato-goo-bola",
    bola.seleccionada ? "is-sorteada" : "is-candidata",
    bola.certeza ? "is-certeza" : "",
    asentamiento.conMotor ? "is-motor" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const descripcion = [
    bola.etiqueta,
    bola.facultad,
    bola.elegibles != null ? `${fmtInt(bola.elegibles)} elegibles` : "elegibles no publicados",
    bola.certeza ? "certeza · sin sorteo" : bola.pi != null ? `π ${fmtPct(bola.pi)}` : "",
    anillo != null && anillo > 0 ? `${fmtInt(anillo)} ya cubiertos` : "",
    etiquetaExtra ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  const bobbing = bobbingDeBola(index);
  return (
    // Posición y animación viven en grupos DISTINTOS: un transform de CSS
    // (entrada/escala) pisa el atributo transform del mismo elemento, y con
    // fill "both" el pisotón es permanente — todas las bolas colapsaban al
    // origen. El g exterior solo posiciona; el interior anima.
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
    <g
      ref={asentamiento.ref}
      className={clase}
      tabIndex={0}
      style={{
        ["--relato-i" as string]: String(Math.min(index, 24)),
        ["--goo-sombra" as string]: `${Math.max(0.4, r * 0.14).toFixed(2)}px`,
        ["--wob-dur" as string]: bobbing.duracion,
        ["--wob-delay" as string]: bobbing.fase,
      }}
    >
      <title>{`${bola.code} · ${descripcion}`}</title>
      <circle className="cmv2-relato-goo-cuerpo" r={r.toFixed(2)} />
      <circle
        className="cmv2-relato-goo-brillo"
        r={(r * 0.34).toFixed(2)}
        cx={(-r * 0.32).toFixed(2)}
        cy={(-r * 0.36).toFixed(2)}
      />
      {bola.certeza && (
        <circle className="cmv2-relato-goo-doble" r={Math.max(0.8, r - 1.1).toFixed(2)} />
      )}
      {anillo != null && anillo > 0 && (
        <circle className="cmv2-relato-goo-anillo" r={(r + 0.9).toFixed(2)} />
      )}
      {bola.seleccionada ? (
        <text className="cmv2-relato-goo-rotulo" y={r + 2.6}>
          {bola.code}
          {bola.certeza ? " · sin sorteo" : bola.pi != null ? ` · π ${fmtPct(bola.pi)}` : ""}
        </text>
      ) : (
        /* Bola viva (c): hover/focus revela el marcador y su cifra AL INSTANTE
           (opacity sin transición); el nombre accesible ya viaja en <title>. */
        <text className="cmv2-relato-goo-rotulo is-hover" y={r + 2.6}>
          {bola.code}
          {bola.elegibles != null ? ` · ${fmtInt(bola.elegibles)} elegibles` : ""}
        </text>
      )}
    </g>
    </g>
  );
}

/** Masa agregada del bombo, rotulada: un hecho, no bolas imaginadas. */
export function MasaGoo({ masa }: { masa: RelatoMasaBombo[] }) {
  if (!masa.length) return null;
  return (
    <ul className="cmv2-relato-goo-masa" aria-label="Resto del bombo, agregado">
      {masa.map((item) => (
        <li key={item.facultad || "estudio"}>
          <strong>{fmtInt(item.aulas)}</strong> cursos-horario más en el bombo
          {item.facultad ? ` de ${item.facultad}` : " del estudio"}
          {/* Cuántas de las agregadas fueron sorteadas: sin este dato, quien
              cuenta las bolas visibles cree que ese es el tamaño de la muestra.
              Va primero porque es lo que cambia la lectura de la escena. */}
          {item.sorteadas > 0 ? (
            <>
              {" · "}
              <strong>{fmtInt(item.sorteadas)} sorteadas</strong>
            </>
          ) : (
            ""
          )}
          {item.elegibles != null ? ` · ${fmtInt(item.elegibles)} elegibles` : ""}
        </li>
      ))}
    </ul>
  );
}
