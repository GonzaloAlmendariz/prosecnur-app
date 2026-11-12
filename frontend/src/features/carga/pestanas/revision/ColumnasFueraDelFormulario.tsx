import type { CargaReviewReconciliationExtra } from "../../../../api/client";
import { ChipSeleccion } from "../../../../components/ChipSeleccion";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { formatoConteo } from "../../../../lib/formatoNumero";
import {
  ROTULO_DE_DECISION,
  columnasDelFiltro,
  conteoPorDecision,
  decisionDeColumna,
  rotuloConDato,
  type FiltroDeColumnas,
} from "./comprobacionesModel";

const FILTROS: readonly { clave: FiltroDeColumnas; rotulo: string }[] = [
  { clave: "pendiente", rotulo: "Por decidir" },
  { clave: "include", rotulo: "Incorporadas" },
  { clave: "exclude", rotulo: "Fuera" },
  { clave: "todas", rotulo: "Todas" },
];

/**
 * Columnas que traen las respuestas y el formulario no declara (prototipo
 * "carga-revision", columna central): filtros por la decisión guardada y una
 * tabla con la columna, el dato que trae y si entra a la base. Encendida, la
 * columna entra como variable; apagada, queda fuera al guardar.
 *
 * El prototipo dibuja además "Ejemplos" y "Se leería como" (tipo y valores):
 * el motor no los publica en la revisión (`reconciliation.extra` trae nombre,
 * relleno y clase), así que quedan como hueco declarado.
 */
export function ColumnasFueraDelFormulario({
  extras,
  filtro,
  onFiltro,
  marcadas,
  onMarcar,
  ocupado,
}: {
  extras: readonly CargaReviewReconciliationExtra[];
  filtro: FiltroDeColumnas;
  onFiltro: (filtro: FiltroDeColumnas) => void;
  marcadas: readonly string[];
  onMarcar: (nombre: string, entra: boolean) => void;
  ocupado: boolean;
}) {
  const conteo = conteoPorDecision(extras);
  const filas = columnasDelFiltro(extras, filtro);
  const marcadasSet = new Set(marcadas);
  const maximo = Math.max(1, ...extras.map((e) => e.n_fill));
  const columnas: PulsoTableColumna<CargaReviewReconciliationExtra>[] = [
    {
      id: "entra",
      encabezado: "Entra",
      ancho: 72,
      celda: (e) => (
        <PulsoSwitch
          size="sm"
          checked={marcadasSet.has(e.name)}
          onCheckedChange={(siguiente) => onMarcar(e.name, siguiente)}
          disabled={ocupado}
          ariaLabel={`Incorporar ${e.name}`}
        />
      ),
    },
    { id: "columna", encabezado: "Columna", ancho: 220, valor: (e) => e.name, celda: (e) => <code className="pulso-revision-codigo">{e.name}</code> },
    {
      id: "dato",
      encabezado: "Con dato",
      ancho: 210,
      valor: (e) => e.n_fill,
      celda: (e) => (
        <span className="pulso-revision-dato">
          <span className="pulso-revision-dato-barra" aria-hidden="true">
            <i style={{ inlineSize: `${Math.round((Math.max(0, e.n_fill) / maximo) * 100)}%` }} />
          </span>
          <span>{rotuloConDato(e)}</span>
        </span>
      ),
    },
    {
      id: "decision",
      encabezado: "Decisión guardada",
      ancho: 150,
      valor: (e) => ROTULO_DE_DECISION[decisionDeColumna(e)],
      celda: (e) => {
        const d = decisionDeColumna(e);
        return <span className="pulso-revision-decision" data-decision={d}>{ROTULO_DE_DECISION[d]}</span>;
      },
    },
  ];
  return (
    <div
      className="pulso-revision-columnas pulso-carga-tabla-llena"
      data-huecos-del-motor='"Ejemplos" y "Se leería como": la revisión no publica tipo ni valores de una columna extra'
    >
      <div className="pulso-revision-filtros" role="group" aria-label="Filtrar columnas por decisión" data-qa-geometry-group="carga/revision-filtros" data-qa-geometry-contract="intrinsic">
        {FILTROS.map((f) => (
          <ChipSeleccion
            key={f.clave}
            etiqueta={f.rotulo}
            activo={filtro === f.clave}
            onAlternar={() => onFiltro(f.clave)}
            cifra={formatoConteo(conteo[f.clave])}
          />
        ))}
      </div>
      <PulsoTable
        columnas={columnas}
        filas={filas}
        idDeFila={(e) => e.name}
        ariaLabel="Columnas fuera del formulario"
        densidad="comoda"
        altoMaximo={100000}
        vacio={filtro === "pendiente" ? "Ninguna columna por decidir." : "Ninguna columna con esta decisión."}
      />
    </div>
  );
}
