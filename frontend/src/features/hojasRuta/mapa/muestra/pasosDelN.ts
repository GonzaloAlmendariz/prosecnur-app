/**
 * P7 de la paridad con la página clásica: «¿De dónde sale este N?» paso a paso, con los supuestos
 * del estudio. Usa las mismas fórmulas que `motorTamano.ts` (espejo del engine de R) para el N total;
 * el último paso, la garantía por distrito, toma la suma de mínimos que ya calculó el motor.
 */

export type Paso = { titulo: string; formula: string; cuenta: string; manda?: boolean };

export type SupuestosN = {
  z: number;
  p: number;
  margenTotal: number;
  deff: number;
  fpc: boolean;
  poblacion: number;
  porRuta: number;
  piso: boolean;
  margenDistrito: number;
  sumaMinimos: number;
};

const num = (x: number, d = 1) => x.toLocaleString("es-PE", { maximumFractionDigits: d });
const ent = (x: number) => Math.round(x).toLocaleString("es-PE");

export function pasosDelN(s: SupuestosN): { pasos: Paso[]; n: number } {
  const pq = s.p * (1 - s.p);
  const nSimple = (s.z * s.z * pq) / (s.margenTotal * s.margenTotal);
  const nDiseno = nSimple * Math.max(0.1, s.deff);
  const pasos: Paso[] = [
    {
      titulo: "Muestra simple",
      formula: "n = z², p, q ÷ e²",
      cuenta: `${num(s.z, 3)}² × ${num(s.p, 2)} × ${num(1 - s.p, 2)} ÷ ${num(s.margenTotal, 3)}² = ${num(nSimple)}`,
    },
    { titulo: "Diseño de campo (DEFF)", formula: "n × DEFF", cuenta: `${num(nSimple)} × ${num(s.deff, 2)} = ${num(nDiseno)}` },
  ];
  let base = nDiseno;
  if (s.fpc && s.poblacion > 0) {
    const nFpc = (s.poblacion * nDiseno) / (s.poblacion + nDiseno - 1);
    if (Math.ceil(nFpc) !== Math.ceil(nDiseno)) {
      pasos.push({ titulo: "Población finita (FPC)", formula: "N, n ÷ (N + n − 1)", cuenta: `con N = ${ent(s.poblacion)}: ${num(nFpc)}` });
    }
    base = nFpc;
  }
  const entero = Math.min(s.poblacion > 0 ? s.poblacion : Infinity, Math.ceil(base));
  const ruta = Math.max(1, Math.trunc(s.porRuta));
  const nTotal = Math.ceil(Math.max(1, entero) / ruta) * ruta;
  if (ruta > 1) {
    pasos.push({
      titulo: "Rutas completas",
      formula: `redondeo hacia arriba a múltiplos de ${ruta}`,
      cuenta: nTotal === entero ? `${ent(entero)} ya calza con rutas de ${ruta}` : `${ent(entero)} → ${ent(nTotal)}`,
    });
  }
  let n = nTotal;
  if (s.piso && s.sumaMinimos > nTotal) {
    n = s.sumaMinimos;
    pasos.push({
      titulo: "Garantía por distrito",
      formula: "máx(N total, Σ mínimos por distrito)",
      cuenta: `para ±${num(s.margenDistrito * 100)} % en cada distrito hacen falta ${ent(s.sumaMinimos)}: manda la garantía`,
      manda: true,
    });
  }
  return { pasos, n };
}
