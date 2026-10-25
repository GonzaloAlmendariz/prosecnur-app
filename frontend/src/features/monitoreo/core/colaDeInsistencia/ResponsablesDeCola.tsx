import type { ResponsableDeCola } from "../colaDeInsistenciaModel";
import { fraseDelReparto, medianaDeIntentos } from "../colaDeInsistenciaModel";
import { useFiltrosDeCola } from "../colaDeInsistenciaStore";

const INTENSIDAD: Record<NonNullable<ResponsableDeCola["intensidad"]>, string> = {
  sobre: "insiste más que el equipo",
  en: "en la mediana del equipo",
  bajo: "insiste menos que el equipo",
};

function decimal(valor: number) {
  return valor.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Lista de responsables de la cola: casos en cola y, en la barra, intentos por
 * caso frente a la mediana del equipo (la marca vertical). «Sin asignar» va
 * aparte y en gris: un caso sin responsable no es atraso de nadie.
 */
export function ResponsablesDeCola({
  responsables,
  reparto,
}: {
  responsables: readonly ResponsableDeCola[];
  reparto: { porLlamarAsignados: number; repartidos: number | null; equipo: number };
}) {
  const { filtros, cambiar } = useFiltrosDeCola();
  const equipo = responsables.filter((item) => !item.sinAsignar);
  const sinAsignar = responsables.find((item) => item.sinAsignar) ?? null;
  const mediana = medianaDeIntentos(responsables);
  const tope = Math.max(1, mediana ?? 0, ...equipo.map((item) => item.promedio ?? 0)) * 1.1;

  return (
    <section className="mon-cola-panel mon-cola-responsables" aria-label="Responsables de la cola">
      <header className="mon-cola-panel-cabecera">
        <b>Responsables</b>
        <span className="mon-cola-antetitulo">En cola</span>
      </header>
      {/* La cifra en la tarjeta; la frase entera, en su tooltip. */}
      <p className="mon-cola-reparto" title={fraseDelReparto(reparto)}>
        {reparto.porLlamarAsignados.toLocaleString("es-PE")} por llamar
      </p>
      <ul className="mon-cola-responsables-lista">
        {equipo.map((item) => {
          const elegido = filtros.responsable === item.nombre;
          return (
            <li key={item.nombre}>
              <button
                type="button"
                className={`mon-cola-responsable${elegido ? " is-activo" : ""}`}
                aria-pressed={elegido}
                title={item.intensidad ? `${item.nombre}: ${INTENSIDAD[item.intensidad]}` : item.nombre}
                onClick={() => cambiar({ responsable: elegido ? null : item.nombre })}
              >
                <b>{item.nombre}</b>
                <span className="mon-cola-responsable-medida">
                  <span className="mon-cola-responsable-barra" aria-hidden="true">
                    <i style={{ width: `${((item.promedio ?? 0) / tope) * 100}%` }} className={item.intensidad ? `is-${item.intensidad}` : undefined} />
                    {mediana != null ? <em style={{ left: `${(mediana / tope) * 100}%` }} /> : null}
                  </span>
                  <span>
                    {item.promedio == null ? "sin dato de intentos" : `${decimal(item.promedio)} por caso`}
                    {item.intensidad ? <span className="pulso-sr-only">, {INTENSIDAD[item.intensidad]}</span> : null}
                  </span>
                </span>
                <strong className="is-num">{item.enCola.toLocaleString("es-PE")}</strong>
              </button>
            </li>
          );
        })}
      </ul>
      {sinAsignar ? (
        <footer className="mon-cola-sin-asignar">
          <b>Sin asignar</b>
          <span title={`${sinAsignar.enCola.toLocaleString("es-PE")} en cola. Sin llamar y sin responsable.`}>
            {sinAsignar.porLlamar.toLocaleString("es-PE")} sin llamar
          </span>
        </footer>
      ) : null}
    </section>
  );
}
