import type { HojasRutaAgeRange } from "../../../../api/hojasRuta";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { formatoDecimal } from "../../../../lib/formatoNumero";
import { Inbox } from "../../../../vendor/lucide-react";
import { tonoCss } from "../lienzo/tonos";
import { nombreDistrito } from "../nombres";
import { CabeceraCiudad, gruposPorCiudad } from "../territorio/gruposPorCiudad";
import type { FilaMatriz, ResumenMatriz } from "./matriz";

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (v: number, total: number) => (total > 0 ? `${formatoDecimal((v / total) * 100, 1)} %` : "—");

/**
 * El tono de cada rango de edad, del más claro al más oscuro, saltando el primer escalón (14 %): sobre el fondo del
 * panel no se distinguía y la barra apilada perdía su primer tramo.
 */
export function tonoDeRango(i: number, n: number): number {
  return n <= 1 ? 3 : 1 + Math.round((i / (n - 1)) * 4);
}

/** Las filas de la matriz en el orden en que se eligieron los distritos (el del color de cada uno en el mapa). */
export function filasEnOrden(filas: readonly FilaMatriz[], orden: readonly string[]): FilaMatriz[] {
  const pos = (u: string) => {
    const i = orden.indexOf(u);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...filas].sort((a, b) => pos(a.ubigeo) - pos(b.ubigeo) || b.total - a.total);
}

/** Barra apilada por rango de edad: cada tramo con el tono de su rango. */
function BarraPorEdad({ valores, etiqueta }: { valores: readonly number[]; etiqueta: string }) {
  return (
    <span className="hr-pob-barra" role="img" aria-label={etiqueta}>
      {valores.map((v, i) => (v > 0 ? <i key={i} data-tono={tonoDeRango(i, valores.length)} style={{ flexGrow: v }} /> : null))}
    </span>
  );
}

/**
 * La columna de Población (revisión del 10 nov 2026: cuatro barras finas y el resto vacío). Sigue la gramática de
 * Muestra («Reparto por distrito») y Manzanas («Rutas por distrito»): arriba los rangos de edad en una barra apilada,
 * con sus personas y su peso; debajo cada distrito, con su color del mapa, su población objetivo y su reparto por edad.
 * La edición de los rangos vive en «Ajustes del diseño»; el acceso va al pie del panel derecho (H29).
 */
export function PoblacionLectura({ rangos, matriz, orden }: { rangos: readonly HojasRutaAgeRange[]; matriz: ResumenMatriz; orden: readonly string[] }) {
  const filas = matriz.vigente ? filasEnOrden(matriz.filas, orden) : [];
  const mayor = Math.max(1, ...filas.map((f) => f.total));
  const nombres = rangos.map((r) => r.label);
  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Población por distrito</h2>
          <small>
            {matriz.vigente ? `${filas.length} distrito${filas.length === 1 ? "" : "s"}, ${fmt(matriz.total)} personas` : `${rangos.length} rangos de edad, sin calcular`}
          </small>
        </div>
      </div>
      <div className="hr-mapa-ins-cuerpo hr-pob-columna">
        <h3 className="hr-mapa-subtitulo">Rangos de edad</h3>
        {matriz.vigente ? (
          <BarraPorEdad valores={matriz.pesoPorRango} etiqueta={nombres.map((n, i) => `${n}: ${pct(matriz.pesoPorRango[i], matriz.total)}`).join(", ")} />
        ) : null}
        <ul className="hr-pob-rangos" aria-label="Rangos de edad y su peso en la población objetivo">
          {rangos.map((r, i) => {
            const peso = matriz.vigente ? matriz.pesoPorRango[i] : null;
            return (
              <li key={`${i}-${r.id}`}>
                <i data-tono={tonoDeRango(i, rangos.length)} aria-hidden="true" />
                <b>{r.label}</b>
                <span>{peso != null ? fmt(peso) : "sin calcular"}</span>
                <small>{peso != null ? pct(peso, matriz.total) : ""}</small>
              </li>
            );
          })}
        </ul>

        <h3 className="hr-mapa-subtitulo">Por distrito</h3>
        {matriz.vigente ? (
          <ul className="hr-pob-distritos">
            {gruposPorCiudad(filas, (f) => f.ubigeo, orden).flatMap((g, _, todos) => [
              todos.length > 1 ? <CabeceraCiudad key={`ciudad-${g.codigo}`} nombre={g.nombre} resumen={`${fmt(g.items.reduce((a, f) => a + f.total, 0))} personas, ${pct(g.items.reduce((a, f) => a + f.total, 0), matriz.total)}`} /> : null,
              ...g.items.map((f) => {
              const nombre = nombreDistrito(f.territorio);
              const porEdad = f.porRango.map((c) => c.H + c.M);
              return (
                <li key={f.ubigeo}>
                  <div className="hr-pob-distrito-cab">
                    <strong>
                      <i style={{ background: tonoCss(orden.indexOf(f.ubigeo)) }} aria-hidden="true" />
                      <span>{nombre}</span>
                    </strong>
                    <b>{fmt(f.total)}</b>
                  </div>
                  {/* El largo compara distritos (el mayor llena la fila); los tramos, su reparto por edad. */}
                  <span className="hr-pob-pista" style={{ ["--hr-largo" as string]: `${(f.total / mayor) * 100}%` }}>
                    <BarraPorEdad valores={porEdad} etiqueta={`${nombre}: ${nombres.map((n, i) => `${n} ${pct(porEdad[i], f.total)}`).join(", ")}`} />
                  </span>
                  <small>{pct(f.total, matriz.total)} de la población objetivo</small>
                </li>
              );
            }),
            ])}
          </ul>
        ) : (
          <EstadoVacio icono={<Inbox size={16} />} titulo="Población sin calcular" descripcion="Calcula la matriz en el panel derecho para ver la población de cada distrito." />
        )}
      </div>
    </>
  );
}
