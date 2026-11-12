import { ListPlus, Sigma, Variable, X } from "../../../../vendor/lucide-react";
import type { ColumnaPropia, VariableCalculada } from "../../../../api/baseVariables";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { ControlVariablesBase } from "../../variablesBase/useVariablesBase";
import { CalculadaEditor } from "../../variablesBase/CalculadaEditor";
import {
  columnasADeclarar,
  nombresOcupados,
  preguntasUsables,
  type AccionColumnas,
  type BorradorColumnas,
} from "../../variablesBase/variablesBaseModel";
import { FichaDeCalculada, PieDeCalculada } from "./FichaDeCalculada";
import { FichaDeColumna } from "./FichaDeColumna";
import { tituloDeVariable, type AccionDeVista, type FilaDeVariable, type VistaDeVariables } from "./variablesModel";

/**
 * La columna derecha de Variables (prototipo "carga-variables"): la variable
 * elegida con sus acciones al pie o, cuando se pide, el editor de una
 * calculada nueva o existente. El editor reemplaza la ficha en el mismo
 * contenedor: la tabla sigue a la vista.
 */
export function InspectorDeVariable({
  control,
  fila,
  vista,
  despacharVista,
  borrador,
  despacharBorrador,
}: {
  control: ControlVariablesBase;
  fila: FilaDeVariable | null;
  vista: VistaDeVariables;
  despacharVista: (a: AccionDeVista) => void;
  borrador: BorradorColumnas;
  despacharBorrador: (a: AccionColumnas) => void;
}) {
  const { estado, declarar, guardarCalculada, quitarCalculada } = control;
  if (estado.carga.tipo !== "listo") return null;
  const datos = estado.carga.datos;
  const { catalogo, ocupado, mensaje } = estado;
  const preguntas = catalogo.tipo === "listo" ? catalogo.variables : catalogo.tipo === "cargando" ? null : [];
  const ocupados = nombresOcupados(datos, catalogo.tipo === "listo" ? catalogo.variables : []);
  const aviso = mensaje && mensaje.seccion !== "codificada" ? mensaje : null;
  const lineaDeAviso = aviso ? (
    <p className={aviso.tono === "error" ? "pulso-variables-aviso is-error" : "pulso-variables-aviso"} role={aviso.tono === "error" ? "alert" : "status"}>
      {aviso.texto}
    </p>
  ) : null;

  const { modo } = vista;
  if (modo.tipo === "nueva" || modo.tipo === "editar") {
    const inicial = modo.tipo === "editar" ? datos.calculadas.find((c) => c.nombre === modo.nombre) ?? null : null;
    const cerrar = () => despacharVista({ tipo: "modo", modo: { tipo: "ver" } });
    return (
      <PanelDeMesa
        zona="inspector"
        titulo={inicial ? `Editar ${inicial.nombre}` : "Nueva variable calculada"}
        icono={<Sigma size={16} />}
        acciones={<PulsoButton variant="icon" size="sm" aria-label="Cerrar el editor" onClick={cerrar}><X size={15} aria-hidden="true" /></PulsoButton>}
      >
        <div className="pulso-variables-editor">
          <CalculadaEditor
            key={inicial?.nombre ?? "nueva"}
            base={datos.base}
            inicial={inicial}
            preguntas={preguntas && inicial ? preguntasUsables(preguntas, datos.calculadas, inicial.nombre) : preguntas}
            catalogoError={catalogo.tipo === "error"}
            catalogoNoAplica={catalogo.tipo === "no-aplica"}
            ocupados={ocupados}
            guardando={ocupado === "calculada"}
            error={aviso?.seccion === "calculadas" && aviso.tono === "error" ? aviso.texto : ""}
            onGuardar={async (c) => {
              const ok = await guardarCalculada(c);
              if (ok) despacharVista({ tipo: "guardada", nombre: c.nombre });
              return ok;
            }}
            onCancelar={cerrar}
          />
        </div>
      </PanelDeMesa>
    );
  }

  if (!fila) {
    return (
      <PanelDeMesa zona="inspector" titulo="Variable">
        {lineaDeAviso}
        <EstadoVacio tamano="compacto" icono={<Variable size={15} />} titulo="Sin variable que mostrar" />
      </PanelDeMesa>
    );
  }

  if (fila.origen === "calculada") {
    const c: VariableCalculada | undefined = datos.calculadas.find((x) => x.nombre === fila.codigo);
    if (!c) return null;
    return (
      <PanelDeMesa
        zona="inspector"
        titulo={tituloDeVariable(fila)}
        etiquetaCuerpo={`Ficha de ${c.nombre}`}
        pie={(
          <PieDeCalculada
            calculada={c}
            confirmando={vista.confirmandoQuitar === fila.clave}
            quitando={ocupado === "quitar"}
            onEditar={() => despacharVista({ tipo: "modo", modo: { tipo: "editar", nombre: c.nombre } })}
            onPedirQuitar={() => despacharVista({ tipo: "confirmar-quitar", clave: fila.clave })}
            onQuitar={() => { despacharVista({ tipo: "confirmar-quitar", clave: null }); void quitarCalculada(c.nombre); }}
            onCancelar={() => despacharVista({ tipo: "confirmar-quitar", clave: null })}
          />
        )}
      >
        {lineaDeAviso}
        <FichaDeCalculada calculada={c} resumen={estado.resumenes[c.nombre]} />
      </PanelDeMesa>
    );
  }

  const columna: ColumnaPropia | undefined = datos.extras.find((x) => x.name === fila.codigo);
  if (!columna) return null;
  const incorporando = ocupado === "declarar";
  const pie = columna.declarada ? (
    <PulsoButton variant="secondary" size="md" disabled={incorporando} onClick={() => void declarar([], [columna.name])}>
        <X size={14} aria-hidden="true" />
      Quitar de las incorporadas
    </PulsoButton>
  ) : (
    <PulsoButton
        variant="primary"
        size="md"
        disabled={incorporando}
        onClick={() => {
          const una = columnasADeclarar(datos.extras, { ...borrador, marcadas: [columna.name] });
          void declarar(una).then((ok) => { if (ok) despacharBorrador({ tipo: "marcar", name: columna.name, marcada: false }); });
        }}
      >
        <ListPlus size={14} aria-hidden="true" />
        {incorporando ? "Incorporando" : "Incorporar"}
    </PulsoButton>
  );
  return (
    <PanelDeMesa zona="inspector" titulo={tituloDeVariable(fila)} etiquetaCuerpo={`Ficha de ${columna.name}`} pie={pie}>
      {lineaDeAviso}
      <FichaDeColumna columna={columna} borrador={borrador} despachar={despacharBorrador} />
    </PanelDeMesa>
  );
}
