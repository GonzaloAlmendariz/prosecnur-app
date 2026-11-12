/**
 * Columna central de Reglas (prototipo `pp-panel--reglas`, `vistas.js:629-647`):
 * el título y el conteo de la familia abierta y, debajo, sus reglas.
 *
 *   - Una familia de reglas: una fila por regla (`FilaRegla`), las primeras
 *     `FILAS_A_LA_VISTA` y "Ver las N" al pie.
 *   - "Sin evaluar": la tabla "Qué pide el formulario / Pregunta / Por qué no se evaluó".
 *   - Las propias llevan debajo las sugeridas al mirar la base y las
 *     sugerencias para revisar del detector de consistencia.
 *   - "Fuera de la auditoría": las preguntas con su interruptor (D-F7c).
 */
import { useState, type ReactNode } from "react";
import { ListChecks, ListTree, Plus } from "../../../../vendor/lucide-react";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { formatoConteo } from "../../../../lib/formatoNumero";
import type { ReglaSemilla } from "../../types";
import { FilaRegla } from "./FilaRegla";
import {
  FAMILIA_FUERA_DE_AUDITORIA,
  FAMILIA_PLAN_SIN_LEER,
  FAMILIA_PROPIAS_VACIA,
  FAMILIA_SIN_EVALUAR,
  FILAS_A_LA_VISTA,
  type EntradaDeFamilia,
  type ReglaDelCatalogo,
} from "./modeloCatalogo";
import { ListaFueraDeAuditoria, type PreguntaExcluible } from "./ListaFueraDeAuditoria";
import { SugeridasDeLaBase } from "./SugeridasDeLaBase";
import { SugerenciasParaRevisar } from "./SugerenciasParaRevisar";

const COLUMNAS_SIN_EVALUAR: readonly PulsoTableColumna<ReglaDelCatalogo>[] = [
  { id: "que-pide", encabezado: "Qué pide el formulario", ancho: 280, celda: (r) => <b>{r.nombre}</b> },
  { id: "pregunta", encabezado: "Pregunta", ancho: 120, celda: (r) => (r.variable_revisada ? <code className="pulso-rl-codigo">{r.variable_revisada}</code> : null) },
  {
    id: "causa",
    encabezado: "Por qué no se evaluó",
    ancho: 230,
    celda: (r) => (
      <span className="pulso-rl-causa">
        <span className="pulso-rl-punto" data-tono="aviso" aria-hidden="true" />
        {r.causa ?? "No se pudo evaluar"}
      </span>
    ),
  },
];

export function ListaDeLaFamilia({
  familia,
  reglas,
  elegida,
  conAviso,
  ocupada,
  semillas,
  preguntasExcluibles,
  onElegir,
  onActivar,
  onAnadirSugerida,
  onNuevaRegla,
  onLeerFormulario,
  leerFormularioDeshabilitado,
  leyendoPlan = false,
  onExcluir,
}: {
  familia: EntradaDeFamilia;
  reglas: readonly ReglaDelCatalogo[];
  /** El id de la regla de la ficha (o, fuera de la auditoría, la pregunta). */
  elegida: string | null;
  conAviso: ReadonlySet<string>;
  ocupada: boolean;
  semillas: readonly ReglaSemilla[];
  preguntasExcluibles: readonly PreguntaExcluible[];
  onElegir: (id: string) => void;
  onActivar: (regla: ReglaDelCatalogo, activa: boolean) => void;
  onAnadirSugerida: (semilla: ReglaSemilla) => void;
  onNuevaRegla: () => void;
  onLeerFormulario: () => void;
  leerFormularioDeshabilitado: boolean;
  /** El plan se está leyendo: el vacío no dice "todavía no se leyó" (ítem 26). */
  leyendoPlan?: boolean;
  onExcluir: (variable: string, excluir: boolean) => void;
}) {
  const [todas, setTodas] = useState<string | null>(null);
  const verTodas = todas === familia.clave;
  const propias = familia.clave === FAMILIA_PROPIAS_VACIA || (reglas.length > 0 && reglas.every((r) => r.origen === "propia"));
  const recortada = !verTodas && reglas.length > FILAS_A_LA_VISTA;
  const aLaVista = recortada ? reglas.slice(0, FILAS_A_LA_VISTA) : reglas;

  let cuerpo: ReactNode;
  if (familia.clave === FAMILIA_FUERA_DE_AUDITORIA) {
    cuerpo = (
      <ListaFueraDeAuditoria
        preguntas={preguntasExcluibles}
        elegida={elegida}
        ocupada={ocupada}
        onElegir={onElegir}
        onExcluir={onExcluir}
      />
    );
  } else if (familia.clave === FAMILIA_PLAN_SIN_LEER && leyendoPlan) {
    cuerpo = <EstadoVacio icono={<ListTree size={20} />} titulo="Leyendo el plan del formulario" />;
  } else if (familia.clave === FAMILIA_PLAN_SIN_LEER) {
    cuerpo = (
      <EstadoVacio
        icono={<ListTree size={20} />}
        titulo="El plan del formulario todavía no se leyó"
        descripcion="Al leerlo salen las obligatorias, los saltos, las restricciones, los filtros de opciones y los valores calculados."
        accion={(
          <PulsoButton variant="primary" size="sm" disabled={leerFormularioDeshabilitado} onClick={onLeerFormulario}>
            <ListTree size={13} aria-hidden="true" />
            Leer el formulario
          </PulsoButton>
        )}
      />
    );
  } else if (familia.clave === FAMILIA_SIN_EVALUAR) {
    cuerpo = (
      <PulsoTable
        columnas={COLUMNAS_SIN_EVALUAR}
        filas={reglas}
        idDeFila={(r) => r.id}
        ariaLabel="Reglas sin evaluar"
        seleccionada={elegida}
        onSeleccionar={onElegir}
        altoMaximo={100_000}
      />
    );
  } else if (!reglas.length) {
    cuerpo = (
      <EstadoVacio
        icono={<ListChecks size={20} />}
        titulo={propias ? "Todavía no hay reglas propias" : "Sin reglas en esta familia"}
        descripcion={propias ? "Una regla propia revisa lo que el formulario no declara, como la coherencia entre dos preguntas." : undefined}
        accion={propias ? (
          <PulsoButton variant="primary" size="sm" onClick={onNuevaRegla}>
            <Plus size={13} aria-hidden="true" />
            Nueva regla
          </PulsoButton>
        ) : undefined}
      />
    );
  } else {
    cuerpo = (
      <ul className="pulso-rl-reglas" data-qa-geometry-group="validacion/reglas-lista" data-qa-geometry-contract="intrinsic">
        {aLaVista.map((r) => (
          <FilaRegla
            key={r.id}
            regla={r}
            elegida={r.id === elegida}
            conAviso={!!r.id_motor && conAviso.has(r.id_motor)}
            ocupada={ocupada}
            onElegir={() => onElegir(r.id)}
            onActivar={(activa) => onActivar(r, activa)}
          />
        ))}
      </ul>
    );
  }

  return (
    <PanelDeMesa
      zona="reglas"
      titulo={familia.nombre}
      conteo={familia.clave === FAMILIA_FUERA_DE_AUDITORIA ? undefined : familia.n}
      etiquetaCuerpo={`Reglas de ${familia.nombre}`}
      pie={recortada ? (
        <div className="pulso-rl-pie-lista">
          <span>Se muestran {formatoConteo(FILAS_A_LA_VISTA)} de {formatoConteo(reglas.length)}.</span>
          <PulsoButton variant="link" size="sm" onClick={() => setTodas(familia.clave)}>
            Ver las {formatoConteo(reglas.length)}
          </PulsoButton>
        </div>
      ) : undefined}
    >
      {cuerpo}
      {propias ? <SugeridasDeLaBase semillas={semillas} ocupada={ocupada} onAnadir={onAnadirSugerida} /> : null}
      {propias ? <SugerenciasParaRevisar ocupada={ocupada} onConvertir={onAnadirSugerida} /> : null}
    </PanelDeMesa>
  );
}
