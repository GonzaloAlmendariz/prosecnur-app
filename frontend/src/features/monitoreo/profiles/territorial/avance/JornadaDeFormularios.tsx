import { fmt } from "../rotulos";
import { ROTULO_DE_ESTADO_DE_CASO, type Jornada } from "./exploracionModel";

function hora(segundos: number): string {
  return `${String(Math.floor(segundos / 3600)).padStart(2, "0")}:${String(Math.floor((segundos % 3600) / 60)).padStart(2, "0")}`;
}

/**
 * «Ver cada formulario» (territorial.md §3.16b): las marcas de una jornada
 * sobre su horario. El ancho de cada marca es lo que duró el formulario cuando
 * se conoce; elegir una marca elige el caso en el mapa y en la lista.
 */
export function JornadaDeFormularios({
  jornada,
  casoElegido,
  onElegirCaso,
}: {
  jornada: Jornada;
  casoElegido: string | null;
  onElegirCaso: (id: string) => void;
}) {
  const duracion = Math.max(3600, jornada.hasta - jornada.desde);
  const posicion = (segundos: number) => `${((segundos - jornada.desde) / duracion) * 100}%`;
  const horas: number[] = [];
  for (let t = jornada.desde; t <= jornada.hasta; t += 3600) horas.push(t);
  return (
    <section className="mon-ump-jornada" aria-label={`Formularios del ${jornada.fecha}`}>
      <header className="mon-ump-historia-cabecera">
        <span className="mon-ump-base">{fmt(jornada.marcas.length)} formularios el {jornada.fecha}</span>
      </header>
      <div className="mon-ump-jornada-eje" aria-hidden="true">
        {horas.map((t) => <span key={t}>{hora(t)}</span>)}
      </div>
      <ol className="mon-ump-jornada-marcas">
        {jornada.marcas.map((marca) => {
          const ancho = marca.ancho != null ? `${Math.max(0.6, (Math.min(marca.ancho, duracion) / duracion) * 100)}%` : undefined;
          const rotulo = `Caso ${marca.caso.orden}, ${hora(marca.inicio)}${marca.ancho != null ? `, ${fmt(Math.round(marca.ancho / 60))} min` : ""}: ${ROTULO_DE_ESTADO_DE_CASO[marca.caso.estado]}`;
          return (
            <li key={marca.caso.id}>
              <button
                type="button"
                className={`mon-ump-marca is-${marca.caso.estado}${marca.ancho == null ? " sin-duracion" : ""}`}
                style={{ marginLeft: posicion(marca.inicio), width: ancho }}
                aria-pressed={casoElegido === marca.caso.id}
                aria-label={rotulo}
                title={rotulo}
                onClick={() => onElegirCaso(marca.caso.id)}
              >
                <span aria-hidden="true">{marca.caso.orden}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
