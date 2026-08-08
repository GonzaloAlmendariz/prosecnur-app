/**
 * Motor de asentamiento del goo (ADR 0067) — física por bola, determinista.
 *
 * POR QUÉ EXISTE
 *
 * El asentamiento vivía en un `@keyframes` CSS: una senoide amortiguada de
 * picos fijos (+8 % → −4 % → +2 % → −1 % → 0), idéntica para toda bola. Esa
 * curva única es el techo del feel: en World of Goo el movimiento se SIENTE
 * vivo porque emerge de una simulación masa-resorte donde cada pieza responde
 * según su masa, no porque todas repitan la misma animación. Con una bola de 12
 * elegibles y otra de 900 cayendo exactamente igual, la escena lee como un
 * gráfico con vibración pegada encima.
 *
 * Acá el asentamiento se INTEGRA: un resorte amortiguado por bola, con masa
 * derivada de su radio —que a su vez es su dato publicado (`eligible_n`)—. Una
 * bola grande se asienta lento y pesado; una chica rebota rápido y se calma
 * antes. La diferencia no se dibuja: sale de la ecuación.
 *
 * CÓMO NO ROMPE EL GATE 1 DEL ADR («cada cuadro es un hecho del sorteo»)
 *
 * No hay azar en ninguna parte: sin `Math.random`, sin ruido, sin semilla de
 * reloj. Los parámetros salen del dato (radio) y del índice (desfase), así que
 * dos aperturas del mismo deep-link producen la MISMA trayectoria cuadro a
 * cuadro. El reloj solo dice cuánto tiempo pasó, nunca qué pasa.
 *
 * POR QUÉ TIMESTEP FIJO
 *
 * Integrar con el delta crudo de `requestAnimationFrame` haría la trayectoria
 * función de la tasa de refresco: la misma bola rebotaría distinto en un
 * monitor de 60 Hz y en uno de 120 Hz, y un frame largo (una pestaña que vuelve
 * del fondo) la mandaría a volar por explosión numérica. Con acumulador y paso
 * fijo, el resultado es idéntico en cualquier máquina — que es lo que un gate
 * de determinismo puede verificar.
 */

/** Paso de integración: 240 Hz. Fino para que el sobrepico no se recorte. */
export const PASO_FIJO_MS = 1000 / 240;

/**
 * Tope de tiempo consumido por cuadro. Una pestaña que estuvo en segundo plano
 * vuelve con un delta enorme; sin este tope el bucle intentaría integrar miles
 * de pasos de golpe y congelaría el hilo. Se prefiere perder tiempo simulado
 * (la bola aparece ya asentada, que es el estado correcto) antes que colgar.
 */
export const MAX_MS_POR_CUADRO = 250;

/** Umbral de reposo: por debajo de esto la bola se considera asentada. */
const EPSILON_REPOSO = 0.0005;

export type EstadoResorte = {
  /** Desplazamiento respecto del equilibrio (0 = asentada). */
  x: number;
  /** Velocidad instantánea. */
  v: number;
};

export type ParametrosBola = {
  /** Rigidez del resorte. */
  k: number;
  /** Amortiguamiento. */
  c: number;
  /** Masa: es lo que hace distinta a una bola grande de una chica. */
  m: number;
};

/**
 * Parámetros físicos de UNA bola a partir de su radio.
 *
 * La masa va con el ÁREA (r²), no con el radio: es la lectura honesta de «una
 * bola grande pesa más», y es la que produce la diferencia perceptible entre
 * la que se desploma y la que rebota. Rigidez constante y amortiguamiento
 * proporcional a √(k·m) mantienen el sistema SIEMPRE subamortiguado (ζ ≈ 0.28)
 * — sin sobrepico no hay asentamiento vivo, y con ζ ≥ 1 la bola llega muerta.
 *
 * La consecuencia física que se busca: ω = √(k/m) baja cuando la masa sube, así
 * que la bola grande oscila más lento y tarda más en calmarse. Nadie la dibuja
 * distinta; la ecuación la hace distinta.
 */
export function parametrosDeBola(radio: number, radioMin = 2.2): ParametrosBola {
  const r = Math.max(radioMin, radio);
  const m = (r / radioMin) ** 2;
  const k = 520;
  const zeta = 0.28;
  return { k, c: 2 * zeta * Math.sqrt(k * m), m };
}

/**
 * Un paso de integración semi-implícita (Euler-Cromer): primero la velocidad
 * con la aceleración actual, después la posición con la velocidad YA
 * actualizada. Es lo que mantiene estable un oscilador; el Euler explícito
 * inyecta energía y la bola diverge en vez de calmarse.
 */
export function pasoResorte(
  estado: EstadoResorte,
  { k, c, m }: ParametrosBola,
  dtSegundos: number,
): EstadoResorte {
  const a = (-k * estado.x - c * estado.v) / m;
  const v = estado.v + a * dtSegundos;
  return { x: estado.x + v * dtSegundos, v };
}

/** ¿El oscilador ya se calmó? Posición y velocidad, ambas bajo el umbral. */
export function estaEnReposo(estado: EstadoResorte): boolean {
  return Math.abs(estado.x) < EPSILON_REPOSO && Math.abs(estado.v) < EPSILON_REPOSO;
}

/**
 * Impulso inicial del aterrizaje: la bola llega con velocidad y se pasa del
 * equilibrio. Se escala con el índice SOLO para desincronizar (misma fórmula
 * determinista del bobbing, `i % 5`), nunca para variar la física.
 */
export function impulsoDeAterrizaje(index: number): EstadoResorte {
  return { x: 0, v: -2.6 - (index % 5) * 0.12 };
}

/**
 * Simula la trayectoria completa y devuelve la ESCALA por cuadro. Es la función
 * que los tests congelan: pura, sin rAF y sin DOM.
 *
 * `escala = 1 − x`, con x el desplazamiento: el sobrepico de la caída se lee
 * como el achatamiento y el rebote posterior como el estiramiento.
 */
export function simularAsentamiento(
  radio: number,
  index = 0,
  cuadros = 240,
  pasoMs = PASO_FIJO_MS,
): number[] {
  const parametros = parametrosDeBola(radio);
  let estado = impulsoDeAterrizaje(index);
  const dt = pasoMs / 1000;
  const salida: number[] = [];
  for (let i = 0; i < cuadros; i += 1) {
    estado = pasoResorte(estado, parametros, dt);
    salida.push(1 - estado.x);
  }
  return salida;
}

/** Una bola registrada en el motor, con su estado vivo. */
type BolaViva = {
  id: string;
  parametros: ParametrosBola;
  estado: EstadoResorte;
  aplicar: (escala: number) => void;
};

/**
 * Bucle compartido: UN `requestAnimationFrame` para todas las bolas de la
 * escena, no uno por bola. Con 60 bolas, 60 bucles compitiendo por el hilo es
 * la diferencia entre 60 fps y un tartamudeo — y además cada uno tendría su
 * propio acumulador, con lo que la desincronía dejaría de ser determinista.
 */
export class MotorGoo {
  private bolas = new Map<string, BolaViva>();
  private acumuladorMs = 0;
  private ultimoMs: number | null = null;
  private handle: number | null = null;
  private readonly pedirCuadro: (cb: (t: number) => void) => number;
  private readonly cancelarCuadro: (h: number) => void;

  constructor(
    pedirCuadro?: (cb: (t: number) => void) => number,
    cancelarCuadro?: (h: number) => void,
  ) {
    this.pedirCuadro = pedirCuadro ??
      ((cb) => globalThis.requestAnimationFrame(cb));
    this.cancelarCuadro = cancelarCuadro ??
      ((h) => globalThis.cancelAnimationFrame(h));
  }

  /** Registra (o reinicia) una bola y le da su impulso de aterrizaje. */
  soltar(id: string, radio: number, index: number, aplicar: (escala: number) => void): void {
    this.bolas.set(id, {
      id,
      parametros: parametrosDeBola(radio),
      estado: impulsoDeAterrizaje(index),
      aplicar,
    });
    this.arrancar();
  }

  quitar(id: string): void {
    this.bolas.delete(id);
    if (!this.bolas.size) this.detener();
  }

  detener(): void {
    if (this.handle != null) this.cancelarCuadro(this.handle);
    this.handle = null;
    this.ultimoMs = null;
    this.acumuladorMs = 0;
  }

  get activo(): boolean {
    return this.handle != null;
  }

  private arrancar(): void {
    if (this.handle != null) return;
    this.handle = this.pedirCuadro((t) => this.cuadro(t));
  }

  /**
   * Un cuadro: consume el tiempo real en pasos fijos y publica la escala. La
   * bola que llegó al reposo se retira del mapa —deja de costar— y recibe una
   * última aplicación en 1 exacto, para que no quede clavada en un 0.9998.
   */
  private cuadro(ahoraMs: number): void {
    this.handle = null;
    const anterior = this.ultimoMs;
    this.ultimoMs = ahoraMs;
    const transcurrido = anterior == null
      ? PASO_FIJO_MS
      : Math.min(MAX_MS_POR_CUADRO, ahoraMs - anterior);
    this.acumuladorMs += Math.max(0, transcurrido);

    const dt = PASO_FIJO_MS / 1000;
    while (this.acumuladorMs >= PASO_FIJO_MS) {
      this.acumuladorMs -= PASO_FIJO_MS;
      for (const bola of this.bolas.values()) {
        bola.estado = pasoResorte(bola.estado, bola.parametros, dt);
      }
    }

    for (const bola of [...this.bolas.values()]) {
      if (estaEnReposo(bola.estado)) {
        bola.aplicar(1);
        this.bolas.delete(bola.id);
        continue;
      }
      bola.aplicar(1 - bola.estado.x);
    }

    if (this.bolas.size) this.arrancar();
    else this.detener();
  }
}

/**
 * ¿Corre el motor? No corre si el usuario pidió menos movimiento —el ADR manda
 * documento estático, no una versión suavizada— ni donde no hay rAF (jsdom,
 * SSR), en cuyo caso el `@keyframes` CSS queda como el camino declarativo.
 */
export function motorDisponible(): boolean {
  if (typeof globalThis.requestAnimationFrame !== "function") return false;
  const consulta = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  return !consulta?.matches;
}
