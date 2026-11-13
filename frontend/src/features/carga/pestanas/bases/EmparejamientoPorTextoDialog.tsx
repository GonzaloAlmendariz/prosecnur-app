// Propuesta de emparejamiento de las columnas de la base con las preguntas del
// formulario por su texto (ítem 4 del checklist de validación del practicante).
// Nada se aplica sin aceptar: cada columna dice su pregunta propuesta, la
// coincidencia y su causa, y se puede cambiar o dejar sin pareja.
import { useMemo, useState } from "react";
import type { ColumnaEmparejamiento, ParejaAceptada, PropuestaEmparejamiento } from "../../../../api/cargaEmparejamiento";
import { Dialog } from "../../../../components/Dialog";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { AlertTriangle, Check, Link2, Loader2 } from "../../../../vendor/lucide-react";
import {
  columnasEnConflicto,
  conteoEleccion,
  elegir,
  eleccionInicial,
  gruposDeColumnas,
  opcionesDeColumna,
  parejasAceptadas,
  ROTULO_ESTADO,
  SIN_PAREJA,
  type EleccionEmparejamiento,
} from "./emparejamientoTextoModelo";
import "./emparejamientoTexto.css";

export function EmparejamientoPorTextoDialog({
  propuesta,
  onAceptar,
  onCerrar,
}: {
  propuesta: PropuestaEmparejamiento;
  onAceptar: (parejas: ParejaAceptada[]) => Promise<void>;
  onCerrar: () => void;
}) {
  const [eleccion, setEleccion] = useState<EleccionEmparejamiento>(() => eleccionInicial(propuesta));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const grupos = useMemo(() => gruposDeColumnas(propuesta), [propuesta]);
  const conflictos = columnasEnConflicto(eleccion);
  const parejas = parejasAceptadas(propuesta, eleccion);
  const r = propuesta.resumen;
  const columnasDeTabla: PulsoTableColumna<ColumnaEmparejamiento>[] = [
    { id: "columna", encabezado: "N.º", ancho: 52, tipo: "cifra", celda: (c) => c.columna, valor: (c) => c.columna },
    { id: "encabezado", encabezado: "Encabezado de la base", ancho: 290, celda: (c) => c.encabezado, valor: (c) => c.encabezado },
    {
      id: "pregunta",
      encabezado: "Pregunta del formulario",
      ancho: 250,
      celda: (c) => {
        if (c.estado === "nombre") return <code>{c.name}</code>;
        const opciones = opcionesDeColumna(c);
        if (!opciones.length) return <span className="pulso-emparejamiento-nada">Sin pregunta parecida</span>;
        return (
          <PulsoSelect
            size="sm"
            ariaLabel={`Pregunta para la columna ${c.columna}`}
            value={eleccion[c.columna] || SIN_PAREJA}
            onValueChange={(v) => setEleccion((prev) => elegir(prev, c.columna, v))}
            disabled={cargando}
            options={[
              { value: SIN_PAREJA, label: "Sin pareja", textValue: "Sin pareja" },
              ...opciones.map((o) => ({ value: o.name, label: `${o.name}: ${o.pregunta}`, textValue: `${o.name} ${o.pregunta}` })),
            ]}
          />
        );
      },
    },
    {
      id: "coincidencia",
      encabezado: "Coincidencia",
      ancho: 120,
      celda: (c) => conflictos.has(c.columna)
        ? <span className="pulso-emparejamiento-estado is-conflicto">Pregunta repetida</span>
        : <span className={`pulso-emparejamiento-estado is-${c.estado}`}>{ROTULO_ESTADO[c.estado]}</span>,
      valor: (c) => ROTULO_ESTADO[c.estado],
    },
    { id: "causa", encabezado: "Causa", ancho: 200, celda: (c) => c.causa, valor: (c) => c.causa },
  ];

  async function aceptar() {
    setCargando(true);
    setError("");
    try {
      await onAceptar(parejas);
    } catch (e: unknown) {
      setError((e as Error).message || "No se pudo cargar la base.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto) onCerrar();
      }}
      size="lg"
      alto="fijo"
      icon={<Link2 size={18} />}
      title="Emparejamiento por el texto de la pregunta"
      subtitle={`${r.n_propuestas} de ${r.n_columnas} columnas coinciden, ${r.n_dudosas + r.n_ambiguas} para revisar y ${r.n_sin_pareja} sin pareja`}
      dismissible={!cargando}
      closeOnOutside={false}
      footerStatus={
        <span className={`pulso-emparejamiento-conteo${conflictos.size ? " is-conflicto" : ""}`}>
          {conteoEleccion(parejas, conflictos)}
        </span>
      }
      footer={
        <>
          <PulsoButton variant="secondary" onClick={onCerrar} disabled={cargando}>
            Cancelar
          </PulsoButton>
          <PulsoButton
            variant="primary"
            onClick={() => void aceptar()}
            disabled={cargando || conflictos.size > 0 || parejas.length === 0}
          >
            {cargando ? <Loader2 size={15} className="pulso-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
            Cargar con los nombres del formulario
          </PulsoButton>
        </>
      }
    >
      <div className="pulso-emparejamiento" data-audit-ready="carga-emparejamiento-texto">
        {grupos.map((g) => (
          <section key={g.clave} className="pulso-emparejamiento-grupo" aria-label={g.titulo}>
            <h3 className="pulso-emparejamiento-titulo">{g.titulo}</h3>
            <PulsoTable
              ariaLabel={g.titulo}
              densidad="compacta"
              altoMaximo={420}
              filas={g.columnas}
              idDeFila={(c) => String(c.columna)}
              columnas={columnasDeTabla}
            />
          </section>
        ))}

        {propuesta.sin_columna.length ? (
          <section className="pulso-emparejamiento-grupo" aria-label="Preguntas sin columna">
            <h3 className="pulso-emparejamiento-titulo">Preguntas sin columna ({propuesta.sin_columna.length})</h3>
            <ul className="pulso-emparejamiento-sin-columna">
              {propuesta.sin_columna.map((p) => (
                <li key={p.name}>
                  <code>{p.name}</code> {p.pregunta}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <div className="pulso-emparejamiento-error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
