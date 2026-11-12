import { Check, Search } from "../../../../vendor/lucide-react";
import type { Pregunta } from "../../../../api/client";
import { ChipSeleccion } from "../../../../components/ChipSeleccion";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { typeLabel } from "../../../xlsformEditor/parsing/parseType";
import {
  FILTROS_DE_PREGUNTAS,
  apareceDePregunta,
  esCalculada,
  tonoDeTipo,
  type FiltroDePreguntas,
} from "./formularioModel";

/**
 * Las preguntas de la sección elegida (prototipo "carga-formulario", columna
 * central): filtros con su conteo, buscador y la tabla con código, pregunta,
 * tipo en su color, cuándo aparece y si es obligatoria. La fila elegida es la
 * del inspector y viaja en la dirección (`foco`).
 */
export function TablaDePreguntas({
  id,
  preguntas,
  todas,
  conteo,
  filtro,
  onFiltro,
  busqueda,
  onBuscar,
  elegida,
  onElegir,
}: {
  id: string;
  /** Las que se ven: de la sección, con el filtro y la búsqueda. */
  preguntas: readonly Pregunta[];
  /** Todas las del formulario, para leer las condiciones con las etiquetas de sus opciones. */
  todas: readonly Pregunta[];
  conteo: Record<FiltroDePreguntas, number>;
  filtro: FiltroDePreguntas;
  onFiltro: (filtro: FiltroDePreguntas) => void;
  busqueda: string;
  onBuscar: (texto: string) => void;
  elegida: string | null;
  onElegir: (nombre: string) => void;
}) {
  const columnas: PulsoTableColumna<Pregunta>[] = [
    { id: "codigo", encabezado: "Código", ancho: 92, valor: (p) => p.name, celda: (p) => <code className="pulso-formulario-codigo">{p.name}</code> },
    { id: "pregunta", encabezado: "Pregunta", ancho: 210, valor: (p) => p.label, celda: (p) => <b className="pulso-formulario-etiqueta">{p.label || p.name}</b> },
    {
      id: "tipo",
      encabezado: "Tipo",
      ancho: 138,
      valor: (p) => (esCalculada(p) ? "Calculada" : typeLabel(p.tipo)),
      celda: (p) => (
        <span className="pulso-formulario-tipo" data-tono={tonoDeTipo(p)}>{esCalculada(p) ? "Calculada" : typeLabel(p.tipo)}</span>
      ),
    },
    { id: "aparece", encabezado: "Aparece", ancho: 120, valor: (p) => apareceDePregunta(p, todas), celda: (p) => <span className="pulso-formulario-aparece">{apareceDePregunta(p, todas)}</span> },
    {
      id: "obligatoria",
      encabezado: "Obligatoria",
      ancho: 88,
      valor: (p) => (p.required ? "Sí" : "No"),
      celda: (p) => (p.required ? <Check size={14} aria-label="Sí" className="pulso-formulario-obligatoria" /> : <span className="pulso-sr-only">No</span>),
    },
  ];
  return (
    <div className="pulso-formulario-preguntas pulso-carga-tabla-llena">
      <div className="pulso-formulario-barra">
        <div className="pulso-formulario-filtros" role="group" aria-label="Filtrar preguntas">
          {FILTROS_DE_PREGUNTAS.filter((f) => f.clave === "todas" || conteo[f.clave] > 0 || filtro === f.clave).map((f) => (
            <ChipSeleccion
              key={f.clave}
              etiqueta={f.rotulo}
              activo={filtro === f.clave}
              onAlternar={() => onFiltro(f.clave)}
              cifra={formatoConteo(conteo[f.clave])}
            />
          ))}
        </div>
        <label className="pulso-formulario-buscar">
          <Search size={14} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar pregunta</span>
          <PulsoInput size="sm" type="search" value={busqueda} onChange={(e) => onBuscar(e.target.value)} placeholder="Buscar pregunta o código" />
        </label>
      </div>
      <div id={id} className="pulso-carga-tabla-llena">
        <PulsoTable
          columnas={columnas}
          filas={preguntas}
          idDeFila={(p) => p.name}
          ariaLabel="Preguntas de la sección"
          seleccionada={elegida}
          onSeleccionar={onElegir}
          altoMaximo={100000}
          vacio={busqueda.trim() ? "Ninguna pregunta coincide con la búsqueda." : "Ninguna pregunta con este filtro."}
        />
      </div>
    </div>
  );
}
