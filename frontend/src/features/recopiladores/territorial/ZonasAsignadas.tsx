// Territorial por cuotas › Entrega (revamp v5, ADR 0125 A1): quién cubre cada zona, leído
// de la asignación guardada (`id_manzana` = id de la zona). Las zonas sin encuestador van
// primero, como pendientes. Se asigna con el Excel para campo (encuestador ↔ zona, con su
// parte); aquí no se edita.
//
// Contrato de Superficie: C1 `material-campo/territorial/zonas-asignadas` (intrinsic); la
// tabla del kit no fija alto, el scroll es del panel de la sección.

import type { AsignacionTerritorial, ZonaDeCuotas } from "../../../api/materialTerritorial";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";

type Fila = { zona: ZonaDeCuotas; encuestadores: string[] };

const COLUMNAS: PulsoTableColumna<Fila>[] = [
  { id: "zona", encabezado: "Zona", ancho: 240, celda: ({ zona }) => <strong>{zona.nombre}</strong> },
  { id: "codigo", encabezado: "Código", ancho: 110, celda: ({ zona }) => zona.id_zona },
  { id: "n", encabezado: "Entrevistas", ancho: 110, tipo: "cifra", celda: ({ zona }) => zona.n.toLocaleString("es-PE") },
  { id: "quien", encabezado: "Encuestador", ancho: 260, celda: ({ encuestadores }) => (encuestadores.length ? encuestadores.join(", ") : <span className="rec-terr-sin-asignar">Sin asignar</span>) },
  { id: "estado", encabezado: "Estado", ancho: 150, celda: ({ encuestadores }) => (
    <span className="rec-terr-pieza-estado" data-estado={encuestadores.length ? "listo" : undefined}>{encuestadores.length ? "Cubierta" : "Sin encuestador"}</span>
  ) },
];

/** Filas por zona; las que no tienen encuestador, primero. Puro para probarlo. */
export function filasDeZonas(zonas: readonly ZonaDeCuotas[], asignacion: AsignacionTerritorial | null): Fila[] {
  const nombres = new Map((asignacion?.equipo ?? []).map((e) => [e.codigo, e.nombre]));
  const porZona = new Map<string, string[]>();
  for (const a of asignacion?.asignacion ?? []) {
    if (!a.codigo) continue;
    const lista = porZona.get(a.id_manzana) ?? [];
    const nombre = nombres.get(a.codigo);
    const rotulo = nombre ? `${nombre} (${a.codigo})` : a.codigo;
    if (!lista.includes(rotulo)) lista.push(rotulo);
    porZona.set(a.id_manzana, lista);
  }
  const filas = zonas.map((zona) => ({ zona, encuestadores: porZona.get(zona.id_zona) ?? [] }));
  return [...filas.filter((f) => !f.encuestadores.length), ...filas.filter((f) => f.encuestadores.length)];
}

export function ZonasAsignadas({ zonas, asignacion }: { zonas: readonly ZonaDeCuotas[]; asignacion: AsignacionTerritorial | null }) {
  const filas = filasDeZonas(zonas, asignacion);
  const sinEncuestador = filas.filter((f) => !f.encuestadores.length).length;
  return (
    <section className="rec-terr-zonas-asignadas" aria-labelledby="rec-terr-zonas-titulo" data-qa-geometry-group="material-campo/territorial/zonas-asignadas" data-qa-geometry-contract="intrinsic">
      <header className="rec-terr-cabeza">
        <span>
          <h2 id="rec-terr-zonas-titulo">Quién cubre cada zona</h2>
          <p>{sinEncuestador ? `${sinEncuestador.toLocaleString("es-PE")} de ${filas.length.toLocaleString("es-PE")} zonas sin encuestador` : `Las ${filas.length.toLocaleString("es-PE")} zonas tienen encuestador`}</p>
        </span>
      </header>
      <PulsoTable columnas={COLUMNAS} filas={filas} idDeFila={(f) => f.zona.id_zona} ariaLabel="Encuestadores por zona" densidad="compacta" altoMaximo={100000} />
    </section>
  );
}
