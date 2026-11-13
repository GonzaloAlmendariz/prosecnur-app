/**
 * La columna "Cola" de Hallazgos (prototipo `colaHall`, `vistas.js:147`): el
 * segmentado "Por decidir / Decididos" con sus cuentas, las clases con su
 * punto (que filtran la lista, D-F7e), las reglas con casos y, al pie, las
 * reglas que no encontraron casos con "Ver", que lleva a Reglas.
 *
 * Elegir una fila escribe su foco en la dirección. Las flechas arriba y abajo
 * recorren la lista (lo que antes hacían "Anterior" y "Siguiente").
 */
import { useRef, type KeyboardEvent } from "react";
import { Inbox } from "../../../vendor/lucide-react";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { ClaseDeHallazgo } from "../../../api/validacionAuditoria";
import { conteo, rotuloDeClase, vistaDeCola, type ElementoDeCola, type PestanaDeCola } from "./modeloHallazgos";

function FilaDeCola({ e, elegida, onElegir }: { e: ElementoDeCola; elegida: boolean; onElegir: () => void }) {
  const clase = e.clase === "caso_a_revisar" ? "revisar" : "inconsistencia";
  const decidida = !e.pendiente && e.tratamiento;
  return (
    <li data-qa-geometry-member="">
      <button type="button" className="pulso-hz-fila" aria-current={elegida ? "true" : undefined} onClick={onElegir}>
        <span className="pulso-hz-fila-nombre">{e.nombre}</span>
        <span className="pulso-hz-fila-n" aria-label={conteo(e.n, e.unidad === "respuestas" ? "respuesta" : "caso", e.unidad)}>
          {formatoConteo(e.n)}
        </span>
        <span className="pulso-hz-fila-pie">
          {decidida ? (
            <span className="pulso-hz-etiqueta" data-clase={clase}>{e.tratamiento}</span>
          ) : (
            <>
              <span className="pulso-hz-etiqueta" data-clase={clase}>{rotuloDeClase(e.clase)}</span>
              <span className="pulso-hz-fila-origen">{e.origen}</span>
            </>
          )}
          {e.pendiente && e.conBorrador ? <span className="pulso-hz-fila-nota">Con borrador</span> : null}
          {e.nCasosNuevos > 0 ? (
            <span className="pulso-hz-fila-nota" data-tono="aviso">{conteo(e.nCasosNuevos, "caso nuevo", "casos nuevos")}</span>
          ) : null}
          {e.noAplicable ? <span className="pulso-hz-fila-nota" data-tono="aviso">No se aplica</span> : null}
        </span>
      </button>
    </li>
  );
}

export function Cola({
  elementos,
  elegido,
  pestana,
  onPestana,
  clase,
  onClase,
  onElegir,
  sinCasos,
  onVerReglas,
  ocupada,
}: {
  elementos: readonly ElementoDeCola[];
  elegido: string | null;
  pestana: PestanaDeCola;
  onPestana: (p: PestanaDeCola) => void;
  clase: ClaseDeHallazgo | null;
  onClase: (c: ClaseDeHallazgo | null) => void;
  onElegir: (id: string) => void;
  /** Reglas evaluadas que no encontraron casos; `null` si el motor no lo publicó. */
  sinCasos: number | null;
  onVerReglas: () => void;
  ocupada: boolean;
}) {
  const vista = vistaDeCola(elementos, pestana, clase);
  const lista = useRef<HTMLUListElement>(null);
  const opciones: Array<{ valor: PestanaDeCola; rotulo: string; n: number }> = [
    { valor: "por-decidir", rotulo: "Por decidir", n: vista.nPorDecidir },
    { valor: "decididos", rotulo: "Decididos", n: vista.nDecididos },
  ];

  const recorrer = (evento: KeyboardEvent<HTMLUListElement>) => {
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    const botones = Array.from(lista.current?.querySelectorAll<HTMLButtonElement>(".pulso-hz-fila") ?? []);
    const i = botones.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const siguiente = botones[evento.key === "ArrowDown" ? Math.min(botones.length - 1, i + 1) : Math.max(0, i - 1)];
    evento.preventDefault();
    siguiente.focus();
    siguiente.click();
  };

  const filtro = (c: ClaseDeHallazgo, n: number) => (
    <button
      type="button"
      className="pulso-hz-clase-filtro"
      data-clase={c === "caso_a_revisar" ? "revisar" : "inconsistencia"}
      aria-pressed={clase === c}
      disabled={n === 0 && clase !== c}
      onClick={() => onClase(clase === c ? null : c)}
    >
      {`${conteo(n, "regla", "reglas")} con ${c === "inconsistencia" ? "inconsistencias" : "casos a revisar"}`}
    </button>
  );

  return (
    <PanelDeMesa
      zona="cola"
      titulo="Cola"
      icono={<Inbox size={15} />}
      conteo={elementos.length}
      ocupado={ocupada}
      pie={sinCasos !== null ? (
        <div className="pulso-hz-resto">
          <span><b>{formatoConteo(sinCasos)}</b> {sinCasos === 1 ? "regla no encontró casos" : "reglas no encontraron casos"}</span>
          <PulsoButton variant="link" size="sm" onClick={onVerReglas}>Ver</PulsoButton>
        </div>
      ) : undefined}
    >
      <div className="pulso-hz-filtro">
        <GlidingRadioGroup<(typeof opciones)[number], PestanaDeCola>
          className="pulso-regla-segmentado pulso-regla-segmentado--ancho pulso-hz-segmentado"
          aria-label="Hallazgos de la cola"
          value={pestana}
          options={opciones}
          getOptionValue={(o) => o.valor}
          onValueChange={onPestana}
          getOptionProps={(_o, { checked }) => ({ className: checked ? "is-on" : undefined })}
        >
          {(o) => (
            <>
              {o.rotulo}
              <small>{formatoConteo(o.n)}</small>
            </>
          )}
        </GlidingRadioGroup>
        <div className="pulso-hz-clases" role="group" aria-label="Filtrar por clase">
          {filtro("inconsistencia", vista.inconsistencias)}
          {filtro("caso_a_revisar", vista.casosARevisar)}
        </div>
      </div>
      {vista.grupos.length === 0 ? (
        <div className="pulso-hz-vacio">
          <EstadoVacio
            icono={<Inbox size={20} />}
            titulo={pestana === "por-decidir" ? "No quedan hallazgos por decidir" : "Todavía no hay hallazgos decididos"}
            descripcion={clase ? "Quita el filtro de clase para ver los demás." : undefined}
          />
        </div>
      ) : (
        <ul
          ref={lista}
          className="pulso-hz-cola"
          aria-label={pestana === "por-decidir" ? "Hallazgos por decidir" : "Hallazgos decididos"}
          data-qa-geometry-group="validacion/hallazgos-cola"
          data-qa-geometry-contract="intrinsic"
          onKeyDown={recorrer}
        >
          {vista.grupos.map((g) => [
            g.titulo ? <li key={`t-${g.clave}`} className="pulso-hz-grupo">{g.titulo}</li> : null,
            ...g.elementos.map((e) => (
              <FilaDeCola key={`${g.clave}-${e.id}`} e={e} elegida={e.id === elegido} onElegir={() => onElegir(e.id)} />
            )),
          ])}
        </ul>
      )}
    </PanelDeMesa>
  );
}
