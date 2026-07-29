/**
 * Marcas de un eje de valores, para dibujarlo FUERA del área que se desplaza.
 *
 * El gráfico de ritmo se desplaza en horizontal cuando el campo es largo, y con
 * el eje dentro del contenedor desplazable se iba de la vista al scrollear. La
 * solución es sacar los dos ejes del scroll y dibujarlos a los lados, pero para
 * eso hay que saber dónde cae cada marca sin preguntárselo a Plotly.
 *
 * Es replicable porque la geometría es determinista: el área de trazado empieza
 * en `margenSuperior` y mide `alto − margenSuperior − margenInferior`, y el
 * valor se reparte linealmente sobre ella. Medido contra Plotly en acrconta:
 * con alto 360, márgenes 36/86 y rango [0, 64], sus marcas caían cada ~37 px
 * empezando en el borde inferior del área.
 */

export type MarcaDeEje = {
  valor: number;
  /** Distancia desde el borde superior del gráfico, en píxeles. */
  y: number;
  etiqueta: string;
};

/**
 * Paso "redondo" para un rango: 1, 2, 5 o 10 por su potencia de diez.
 *
 * Es el mismo criterio que usa Plotly, y por eso las marcas coinciden: para 64
 * elige 10 y para 500 elige 100. Las 8 marcas de referencia no son estéticas,
 * son las que hacen que coincida: con 6 el paso de 64 salía 20 y el eje dibujado
 * al lado quedaba a la mitad de densidad que las barras que acompaña.
 */
export function pasoDeEje(maximo: number, marcasDeseadas = 8): number {
  if (!Number.isFinite(maximo) || maximo <= 0) return 1;
  const crudo = maximo / Math.max(1, marcasDeseadas);
  const magnitud = 10 ** Math.floor(Math.log10(crudo));
  const normalizado = crudo / magnitud;
  const escala = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return escala * magnitud;
}

export function marcasDeEje(
  maximo: number,
  alto: number,
  margenSuperior: number,
  margenInferior: number,
  formatear: (valor: number) => string = (valor) => valor.toLocaleString("es-PE"),
): MarcaDeEje[] {
  const altoTrazado = alto - margenSuperior - margenInferior;
  // Sin alto útil o sin escala no hay eje que dibujar: devolver marcas
  // apiladas en el mismo píxel sería peor que no dibujar nada.
  if (!Number.isFinite(maximo) || maximo <= 0 || altoTrazado <= 0) return [];

  const paso = pasoDeEje(maximo);
  const marcas: MarcaDeEje[] = [];
  for (let valor = 0; valor <= maximo + paso / 1000; valor += paso) {
    // `valor / maximo` invertido: en pantalla el cero está abajo.
    const y = margenSuperior + altoTrazado * (1 - valor / maximo);
    marcas.push({ valor, y, etiqueta: formatear(valor) });
  }
  return marcas;
}
