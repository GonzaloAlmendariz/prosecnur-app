// Panel «Variables de la base» (ADR 0106). Direccionable:
// `?panel=variables-base&foco=<base>`. Se abre desde la tarjeta de cada base en
// Carga › Fuentes y desde el Mapa de bases de Equivalencias.
//
// Cuatro piezas, en este orden: el aviso de preguntas retiradas sin motivo, las
// columnas que la base trae fuera del formulario, las variables calculadas y la
// marca «ya viene codificada». Cáscara: `PanelLateralFuentes` (un único dueño de
// scroll, `.pulso-plf-cuerpo`).

import { AnexarColumnas } from "./AnexarColumnas";
import { useCallback, useId } from "react";
import { Link, useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { Switch } from "../../../components/Switch";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { AlertTriangle, ArrowRight } from "../../../vendor/lucide-react";
import { PanelLateralFuentes } from "../fuentes/PanelLateralFuentes";
import { searchSinPanelYFoco } from "../fuentes/compararFuentesModel";
import { ColumnasDeLaBase } from "./ColumnasDeLaBase";
import { useVariablesBase, type ControlVariablesBase } from "./useVariablesBase";
import { VariablesCalculadas } from "./VariablesCalculadas";
import {
  PANEL_VARIABLES_BASE,
  hrefDeclararRetiradas,
  nombresOcupados,
  preguntasUsables,
  readinessVariablesBase,
} from "./variablesBaseModel";
import "../ArmonizacionFilaEditor.css";
import "./variablesBase.css";

export type VariablesBasePanelProps = {
  /** Rótulo sobre el título: desde dónde se abrió. */
  antetitulo?: string;
};

function PanelConDireccion({ antetitulo = "Carga › Bases del estudio" }: VariablesBasePanelProps) {
  const panel = usePanelDireccionable(PANEL_VARIABLES_BASE);
  const procesamiento = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const foco = panel.abierto ? procesamiento.foco?.trim() || null : null;
  const control = useVariablesBase(foco);

  const cerrar = useCallback(
    () => navigate({ pathname: location.pathname, search: searchSinPanelYFoco(location.search) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );

  return (
    <PanelLateralFuentes
      panel={panel}
      antetitulo={antetitulo}
      titulo={foco ? `Variables de «${foco}»` : "Variables de la base"}
      descripcion="Lo que la base trae además del formulario y lo que se calcula en ella."
      auditReady={readinessVariablesBase(control.estado.carga, foco)}
      claveDisparador={foco ? `variables-base:${foco}` : null}
      onCerrar={cerrar}
    >
      {foco ? (
        <VariablesBaseCuerpo control={control} />
      ) : (
        <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
          <p>El enlace no nombra ninguna base. Ábrela desde su tarjeta en Bases del estudio.</p>
        </div>
      )}
    </PanelLateralFuentes>
  );
}

/** Fuera de un router (renders estáticos) no hay dirección que lo abra. */
export function VariablesBasePanel(props: VariablesBasePanelProps) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}

/** Lo que va dentro del dueño de scroll. Aparte del diálogo para renderizarlo sin portal. */
export function VariablesBaseCuerpo({ control }: { control: ControlVariablesBase }) {
  const { estado, declarar, guardarCalculada, quitarCalculada, marcarCodificada, recargar } = control;
  const idCodificada = useId();
  const enRouter = useInRouterContext();
  const { carga, catalogo, resumenes, ocupado, mensaje } = estado;

  if (carga.tipo === "cargando") {
    return (
      <div className="pulso-plf-estado" role="status" data-qa-geometry-capacity="owned">
        <p>Leyendo las columnas de la base…</p>
      </div>
    );
  }
  if (carga.tipo === "error") {
    // C5 categoría 3: desconexión o base inexistente; el mensaje del backend lo dice.
    return (
      <div className="pulso-plf-estado is-error" role="alert" data-qa-geometry-capacity="owned">
        <strong>No se pudieron leer las variables de la base.</strong>
        <p>{carga.mensaje}</p>
      </div>
    );
  }

  const datos = carga.datos;
  const preguntas = catalogo.tipo === "listo" ? catalogo.variables : catalogo.tipo === "error" ? [] : null;
  const ocupados = nombresOcupados(datos, catalogo.tipo === "listo" ? catalogo.variables : []);
  const pendientes = datos.retiradas_pendientes;

  return (
    <div className="pulso-vb" data-qa-geometry-group="carga/variables-base" data-qa-geometry-contract="intrinsic">
      {pendientes.length > 0 && (
        <div className="pulso-vb-retiradas" role="status" data-qa-geometry-member>
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            {pendientes.length === 1
              ? `«${pendientes[0]}» no viene en la base y falta declarar por qué.`
              : `${formatoConteoDe(pendientes.length, "pregunta", "preguntas")} del formulario no vienen en la base y falta declarar por qué.`}
          </span>
          {enRouter && (
            <Link className="pulso-vb-enlace" to={hrefDeclararRetiradas(datos.base)}>
              Declarar el motivo
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      <ColumnasDeLaBase
        extras={datos.extras}
        ocupado={ocupado === "declarar"}
        mensaje={mensaje?.seccion === "columnas" ? mensaje : null}
        onIncorporar={(columnas) => declarar(columnas)}
        onQuitar={(name) => void declarar([], [name])}
      />

      <AnexarColumnas base={datos.base} onAnexadas={recargar} />

      <VariablesCalculadas
        base={datos.base}
        calculadas={datos.calculadas}
        resumenes={resumenes}
        preguntas={preguntas}
        catalogoError={catalogo.tipo === "error"}
        ocupados={ocupados}
        guardando={ocupado === "calculada"}
        quitando={ocupado === "quitar"}
        mensaje={mensaje?.seccion === "calculadas" ? mensaje : null}
        onGuardar={guardarCalculada}
        onQuitar={(nombre) => void quitarCalculada(nombre)}
      />

      <section className="pulso-armon-seccion pulso-vb-codificada" aria-labelledby={`${idCodificada}-rotulo`} data-qa-geometry-member>
        <div className="pulso-vb-codificada-fila">
          <div className="pulso-armon-seccion-titulo">
            <h3 id={`${idCodificada}-rotulo`}>Esta base ya viene codificada</h3>
            <p className="pulso-armon-ayuda">Codificación no la vuelve a codificar.</p>
          </div>
          <Switch
            checked={datos.ya_codificada}
            disabled={ocupado === "codificada"}
            ariaLabel="Esta base ya viene codificada"
            onToggle={() => void marcarCodificada(!datos.ya_codificada)}
          />
        </div>
        {mensaje?.seccion === "codificada" && mensaje.tono === "error" && (
          <p className="pulso-armon-error" role="alert">{mensaje.texto}</p>
        )}
      </section>
    </div>
  );
}
