import { Search } from "../../../../vendor/lucide-react";
import { ChipSeleccion } from "../../../../components/ChipSeleccion";
import { EstadoChip } from "../../../../components/EstadoChip";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { mayuscula } from "../../nombreDeSerie";
import {
  FILTROS_DE_EQUIVALENCIAS,
  type FiltroDeEquivalencias,
  type FilaDeMesa,
} from "./equivalenciasMesaModel";

/**
 * La misma pregunta en cada base (prototipo "carga-equivalencias", columna
 * izquierda): filtros con su conteo, buscador y una fila por pregunta con su
 * estado de escala, su código en cada base y en cuántas bases está. La tabla
 * solo se lee: la fila se edita en el inspector.
 */
export function TablaDeEquivalencias({
  bases,
  filas,
  conteo,
  filtro,
  onFiltro,
  busqueda,
  onBuscar,
  elegida,
  onElegir,
}: {
  bases: readonly string[];
  /** Las que se ven, con el filtro y la búsqueda. */
  filas: readonly FilaDeMesa[];
  conteo: Record<FiltroDeEquivalencias, number>;
  filtro: FiltroDeEquivalencias;
  onFiltro: (filtro: FiltroDeEquivalencias) => void;
  busqueda: string;
  onBuscar: (busqueda: string) => void;
  elegida: string | null;
  onElegir: (id: string) => void;
}) {
  const columnas: PulsoTableColumna<FilaDeMesa>[] = [
    {
      id: "nombre",
      encabezado: "Nombre en el informe",
      ancho: 240,
      valor: (f) => f.fila.etiqueta_estandar,
      celda: (f) => (
        <span className="pulso-equiv-mesa-nombre">
          {f.fila.sugerida ? <span className="pulso-equiv-mesa-marca">Sin confirmar</span> : null}
          {f.fila.etiqueta_estandar.trim()
            ? <b>{f.fila.etiqueta_estandar}</b>
            : <span className="pulso-equiv-mesa-tenue">Sin nombre</span>}
        </span>
      ),
    },
    {
      id: "escala",
      encabezado: "Escala",
      ancho: 150,
      valor: (f) => f.estado.texto,
      celda: (f) => <EstadoChip label={f.estado.texto} tone={f.estado.tono} detail={f.estado.explicacion} />,
    },
    ...bases.map((base): PulsoTableColumna<FilaDeMesa> => ({
      id: `base-${base}`,
      encabezado: mayuscula(base),
      ancho: 104,
      valor: (f) => f.fila.variables[base] ?? "",
      celda: (f) => {
        const variable = f.fila.variables[base];
        return variable
          ? <code className="pulso-equiv-mesa-codigo">{variable}</code>
          : <span className="pulso-equiv-mesa-tenue">No está</span>;
      },
    })),
    {
      id: "bases",
      encabezado: "Bases",
      ancho: 76,
      tipo: "cifra",
      valor: (f) => f.enBases,
      celda: (f) => `${formatoConteo(f.enBases)} de ${formatoConteo(bases.length)}`,
    },
  ];

  return (
    <div className="pulso-equiv-mesa-tabla pulso-carga-tabla-llena">
      <div className="pulso-equiv-mesa-barra">
        <div
          className="pulso-equiv-mesa-filtros"
          role="group"
          aria-label="Filtrar preguntas"
          data-qa-geometry-group="carga/equivalencias-filtros"
          data-qa-geometry-contract="intrinsic"
        >
          {FILTROS_DE_EQUIVALENCIAS.filter((f) => f.clave === "todas" || conteo[f.clave] > 0 || filtro === f.clave).map((f) => (
            <ChipSeleccion
              key={f.clave}
              etiqueta={f.rotulo}
              activo={filtro === f.clave}
              onAlternar={() => onFiltro(f.clave)}
              cifra={formatoConteo(conteo[f.clave])}
            />
          ))}
        </div>
        <label className="pulso-equiv-mesa-buscar">
          <Search size={14} aria-hidden="true" />
          <span className="pulso-sr-only">Buscar pregunta</span>
          <PulsoInput size="sm" type="search" value={busqueda} onChange={(e) => onBuscar(e.target.value)} placeholder="Buscar pregunta o código" />
        </label>
      </div>
      <div className="pulso-carga-tabla-llena">
        <PulsoTable
          columnas={columnas}
          filas={filas}
          idDeFila={(f) => f.fila.id}
          ariaLabel="La misma pregunta en cada base"
          seleccionada={elegida}
          onSeleccionar={onElegir}
          altoMaximo={100000}
          vacio={busqueda.trim() ? "Ninguna pregunta coincide con la búsqueda." : "Ninguna pregunta con este filtro."}
        />
      </div>
    </div>
  );
}
