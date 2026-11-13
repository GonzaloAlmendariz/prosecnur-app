import { Check, Columns3, EyeOff, KeyRound, TriangleAlert } from "lucide-react";

import type { ColumnaDelMarco, UsoDeColumna } from "../../../../api/calcMuestraMarcoPublico";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { conUso, ROTULO_TIPO, usoDe, USOS_DE_COLUMNA, type EstadoMarco } from "./modeloMarco";
import { BarraApilada, cifra, conCortes, Pastilla } from "./piezas";

function Distribucion({ c }: { c: ColumnaDelMarco }) {
  if (c.tipo === "codigo") return <Pastilla icono={<KeyRound size={12} aria-hidden="true" />}>{c.unico ? "único por fila" : `${cifra(c.valores)} distintos`}</Pastilla>;
  if (c.tipo === "correo") {
    return c.vacios || !c.unico
      ? <Pastilla tono="aviso" icono={<TriangleAlert size={12} aria-hidden="true" />}>{c.vacios ? `${cifra(c.vacios)} vacíos` : "con repetidos"}</Pastilla>
      : <Pastilla tono="ok" icono={<Check size={12} aria-hidden="true" />}>sin vacíos ni repetidos</Pastilla>;
  }
  if (c.tipo === "texto" || c.tipo === "telefono") {
    return (
      <span className="cmmp-dist">
        <Pastilla icono={<EyeOff size={12} aria-hidden="true" />}>oculto</Pastilla>
        {c.vacios ? <Pastilla tono="aviso">{cifra(c.vacios)} vacíos</Pastilla> : null}
      </span>
    );
  }
  if (c.tipo === "numero" && c.resumen) return <span className="cmmp-dist-texto">De {cifra(c.resumen.min)} a {cifra(c.resumen.max)}</span>;
  if (c.tipo === "categoria" && c.distribucion.length) {
    const pocos = c.distribucion.length <= 4;
    return (
      <span className="cmmp-dist-viva">
        <BarraApilada valores={c.distribucion} etiqueta={`Distribución de ${c.nombre}`} />
        <span className="cmmp-dist">
          {pocos
            ? c.distribucion.map((v, i) => <span key={v.valor}><i data-tono={i % 6} />{v.valor} <b>{cifra(v.n)}</b></span>)
            : <span>{cifra(c.valores)} categorías</span>}
          {c.vacios ? <span>vacío <b>{cifra(c.vacios)}</b></span> : null}
        </span>
      </span>
    );
  }
  return null;
}

const OPCIONES = USOS_DE_COLUMNA.map((u) => ({
  value: u.uso,
  textValue: u.rotulo,
  label: <span className="cmmp-opcion-uso"><i data-u={u.uso} />{u.rotulo}</span>,
}));

/** Paso 2: cada columna con lo que se leyó en ella y el uso que se le da. Elegir una fila la muestra a la derecha. */
export function PasoColumnas({ estado, colElegida, onElegir, onCambio }: {
  estado: EstadoMarco;
  colElegida: string;
  onElegir: (col: string) => void;
  onCambio: (e: EstadoMarco) => void;
}) {
  const filas = estado.lectura?.columnas ?? [];
  const columnas: PulsoTableColumna<ColumnaDelMarco>[] = [
    { id: "nombre", encabezado: "Columna", ancho: 230, celda: (c) => <span className="cmmp-columna">{conCortes(c.nombre)}</span> },
    { id: "tipo", encabezado: "Se lee como", ancho: 110, celda: (c) => <span className="cmmp-tipo">{ROTULO_TIPO[c.tipo]}</span> },
    { id: "valores", encabezado: "Valores", ancho: 84, tipo: "cifra", celda: (c) => cifra(c.valores) },
    { id: "dist", encabezado: "Distribución", ancho: 280, celda: (c) => <Distribucion c={c} /> },
    {
      id: "uso", encabezado: "Uso", ancho: 190, celda: (c) => {
        const uso = usoDe(c, estado.usos);
        return (
          <span className="cmmp-uso" data-u={uso} onClick={(e) => e.stopPropagation()}>
            <PulsoSelect
              size="sm"
              value={uso}
              options={OPCIONES}
              ariaLabel={`Uso de ${c.nombre}`}
              onValueChange={(v) => { onElegir(c.nombre); onCambio({ ...estado, usos: conUso(estado, c.nombre, v as UsoDeColumna) }); }}
            />
          </span>
        );
      },
    },
  ];
  return (
    <PanelDeMesa zona="marco-columnas" titulo="Columnas de la base" icono={<Columns3 size={15} aria-hidden="true" />} conteo={filas.length}>
      <PulsoTable
        columnas={columnas}
        filas={filas}
        idDeFila={(c) => c.nombre}
        ariaLabel="Columnas de la base"
        seleccionada={colElegida || null}
        onSeleccionar={onElegir}
        altoMaximo={2000}
      />
    </PanelDeMesa>
  );
}
