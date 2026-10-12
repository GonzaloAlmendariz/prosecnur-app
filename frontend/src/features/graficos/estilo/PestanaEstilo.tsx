// Pestaña «Estilo del cliente» de Procesamiento › Gráficos (F6.4; A6 R3; ADR 0094; dirección F6 §4.6). Dirección:
// `/graficos?pestana=estilo`. Edita `config.estilo_cliente` en `usePlanStore` (un paso deshacible por cambio) y lo guarda
// el autosave de siempre. Procedencia derivada contra los defaults del GET: «Del recetario» o «Propio» por bloque.
//
// Un solo dueño de desplazamiento (C4, No Scroll Jail): el cuerpo. La vista previa del Word acompaña pegada arriba.

import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  ESTILO_LUGARES_LOGO,
  apiGraficosEstiloDefaults,
  apiGraficosEstiloOpciones,
  apiGraficosSubirLogo,
  type EstiloAmbito,
  type EstiloCliente,
  type EstiloLugarLogo,
} from "../../../api/graficosEstilo";
import { useSession } from "../../../lib/SessionContext";
import { useGraficosReportScope } from "../reportScope";
import { usePlanStore } from "../store";
import { motivoEstiloNoDisponible } from "./disponibilidadEstilo";
import { useEstiloUi } from "./estiloUiStore";
import {
  conAmbito,
  conLogo,
  conNombreLogo,
  conPaso,
  conRol,
  decisionesEstilo,
  letraModificada,
  logosModificados,
  pasoEfectivo,
  pasoEfectivoRol,
  procedenciaLogo,
  procedenciaPaso,
  procedenciaRol,
  referenciaEstilo,
  sinLetra,
  sinLogo,
  sinLogos,
  sinPaso,
  sinRol,
} from "./modeloEstilo";
import { SeccionAmbito } from "./SeccionAmbito";
import { SeccionLetra } from "./SeccionLetra";
import { IconosEditor } from "../IconosEditor";
import { ColoresRespuestas } from "./ColoresRespuestas";
import { Subpestanas, useSubpestana, type Subpestana } from "../subpestanas/Subpestanas";
import { MarcaModificado } from "./SelloProcedencia";
import { TarjetaLogo } from "./TarjetaLogo";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCcw } from "../../../vendor/lucide-react";
import "./estilo.css";

function mensajeDe(error: unknown, porDefecto: string): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}

type SubIdentidad = "logos" | "letra" | "iconos" | "colores";
const SUB_IDENTIDAD: readonly Subpestana<SubIdentidad>[] = [
  { key: "logos", label: "Logos" },
  { key: "letra", label: "Letra" },
  { key: "iconos", label: "Íconos" },
  { key: "colores", label: "Colores de las respuestas" },
];

export default function PestanaEstilo() {
  const [sub, setSub] = useSubpestana(SUB_IDENTIDAD);
  const location = useLocation();
  const scope = useGraficosReportScope(location.search);
  const motivoNoDisponible = motivoEstiloNoDisponible(scope);
  const { state } = useSession();
  const prepOk = !!state?.analitica_prep_ok;

  const estilo = usePlanStore((s) => s.estiloCliente);
  const defaults = usePlanStore((s) => s.estiloClienteDefaults);
  const setEstiloCliente = usePlanStore((s) => s.setEstiloCliente);
  const setDefaults = usePlanStore((s) => s.setEstiloClienteDefaults);
  const opciones = useEstiloUi((s) => s.opciones);
  const opcionesError = useEstiloUi((s) => s.opcionesError);
  const setOpciones = useEstiloUi((s) => s.setOpciones);
  const subiendo = useEstiloUi((s) => s.subiendo);
  const errorLogo = useEstiloUi((s) => s.errorLogo);
  const setSubiendo = useEstiloUi((s) => s.setSubiendo);
  const setErrorLogo = useEstiloUi((s) => s.setErrorLogo);

  // El catálogo no cambia con la base: se pide una vez por sesión de la app.
  useEffect(() => {
    if (motivoNoDisponible || opciones) return;
    let vigente = true;
    apiGraficosEstiloOpciones()
      .then((o) => { if (vigente) setOpciones(o); })
      .catch((error: unknown) => { if (vigente) setOpciones(null, mensajeDe(error, "No se pudo leer el estilo por defecto.")); });
    return () => { vigente = false; };
  }, [motivoNoDisponible, opciones, setOpciones]);

  // Los defaults dependen del perfil y del ámbito por defecto de la base. El autosave ya los publica con cada GET de la
  // config (también al cambiar de base); sólo se piden aquí si todavía no llegaron por esa vía.
  useEffect(() => {
    if (motivoNoDisponible || defaults) return;
    let vigente = true;
    apiGraficosEstiloDefaults()
      .then((d) => { if (vigente) setDefaults(d); })
      .catch(() => { /* Sin defaults del backend se compara contra el recetario (`referenciaEstilo`). */ });
    return () => { vigente = false; };
  }, [motivoNoDisponible, defaults, setDefaults, state?.active_base, state?.session_id]);

  const ref = referenciaEstilo(defaults);
  const decisiones = useMemo(() => decisionesEstilo(estilo, defaults), [estilo, defaults]);
  const cambiar = useCallback((f: (e: EstiloCliente) => EstiloCliente) => {
    setEstiloCliente(f(usePlanStore.getState().estiloCliente));
  }, [setEstiloCliente]);

  const subirLogo = useCallback(async (lugar: EstiloLugarLogo, archivo: File) => {
    setErrorLogo(lugar, "");
    setSubiendo(lugar, true);
    try {
      const subido = await apiGraficosSubirLogo(archivo, lugar);
      cambiar((e) => conLogo(e, lugar, subido.nombre ? { file_id: subido.fileId, nombre: subido.nombre } : { file_id: subido.fileId }));
    } catch (error) {
      setErrorLogo(lugar, mensajeDe(error, "No se pudo subir el logo."));
    } finally {
      setSubiendo(lugar, false);
    }
  }, [cambiar, setErrorLogo, setSubiendo]);

  if (motivoNoDisponible) {
    return (
      <div className="pulso-f6-estilo" data-audit-ready="graficos-estilo" data-qa-surface="graficos/f6-estilo">
        <div className="pulso-f6-estilo-cuerpo is-vacio" data-qa-scroll-owner="estilo">
          <p className="pulso-f6-estilo-no-disponible" role="status">{motivoNoDisponible}</p>
        </div>
      </div>
    );
  }

  const ambito: EstiloAmbito = estilo.ambito ?? ref.ambito ?? "proyecto";
  const paso = pasoEfectivo(estilo, ref);
  const listo = !!opciones || !!opcionesError;

  return (
    <div className="pulso-f6-estilo" data-audit-ready={listo ? "graficos-estilo" : "false"} data-qa-surface="graficos/f6-estilo">
      <header className="pulso-f6-estilo-barra">
        <h2 className="pulso-f6-estilo-titulo">Identidad</h2>
        <Subpestanas opciones={SUB_IDENTIDAD} actual={sub} onCambiar={setSub} etiqueta="Identidad" />
      </header>
      <div className="pulso-f6-estilo-cuerpo" data-qa-scroll-owner="estilo">
        <div className="pulso-f6-estilo-columnas">
          <div className="pulso-f6-estilo-secciones" data-qa-geometry-group="graficos/f6-estilo-secciones" data-qa-geometry-contract="intrinsic">
            {opcionesError ? <p className="pulso-f6-estilo-error" role="alert">{opcionesError}</p> : null}
            {sub === "logos" && (<>
            <SeccionAmbito
              ambito={ambito}
              ambitoDefault={ref.ambito}
              onCambiar={(nuevo) => { if (nuevo !== ambito) cambiar((e) => conAmbito(e, nuevo)); }}
            />

            <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-logos-titulo" data-qa-geometry-member>
              <header className="pulso-f6-estilo-seccion-cabecera">
                <h3 id="f6-estilo-logos-titulo">Logos</h3>
                <MarcaModificado visible={logosModificados(decisiones)} />
                {logosModificados(decisiones) ? (
                  <PulsoButton variant="ghost" size="sm" onClick={() => cambiar(sinLogos)} aria-label="Volver a los logos por defecto">
                    <RotateCcw size={14} aria-hidden="true" />
                    Volver al recetario
                  </PulsoButton>
                ) : null}
              </header>
              <p className="pulso-f6-estilo-ayuda">Sólo PNG, hasta 5 MB. Si un lugar no tiene logo propio, el Word usa el de por defecto.</p>
              <div className="pulso-f6-estilo-logos" data-qa-geometry-group="graficos/f6-estilo-logos" data-qa-geometry-contract="equal">
                {ESTILO_LUGARES_LOGO.map((lugar) => (
                  <TarjetaLogo
                    key={lugar}
                    lugar={lugar}
                    logo={estilo.logos?.[lugar]}
                    recetario={opciones?.logos.find((l) => l.lugar === lugar)}
                    procedencia={procedenciaLogo(decisiones, lugar)}
                    subiendo={!!subiendo[lugar]}
                    error={errorLogo[lugar] ?? ""}
                    onArchivo={(archivo) => void subirLogo(lugar, archivo)}
                    onQuitar={() => cambiar((e) => sinLogo(e, lugar))}
                    onNombre={(nombre) => cambiar((e) => conNombreLogo(e, lugar, nombre))}
                  />
                ))}
              </div>
            </section>
            </>)}

            {sub === "letra" && <SeccionLetra
              paso={paso}
              procedenciaPaso={procedenciaPaso(decisiones)}
              pasoRol={(rol) => pasoEfectivoRol(estilo, ref, rol)}
              rolPropio={(rol) => estilo.letra?.roles?.[rol]}
              procedenciaRol={(rol) => procedenciaRol(decisiones, rol)}
              modificada={letraModificada(decisiones)}
              opciones={opciones}
              onPaso={(p) => cambiar((e) => conPaso(e, p))}
              onSinPaso={() => cambiar(sinPaso)}
              onRol={(rol, p) => cambiar((e) => conRol(e, rol, p))}
              onSinRol={(rol) => cambiar((e) => sinRol(e, rol))}
              onSinLetra={() => cambiar(sinLetra)}
            />}

            {/* Los íconos del cliente (lámina de objetivo y capítulos) se suben aquí; la población no lleva ícono. */}
            {sub === "iconos" && (
              <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-iconos-titulo" data-qa-geometry-member>
                <h3 id="f6-estilo-iconos-titulo" className="pulso-f6-subtitulo">Íconos</h3>
                <IconosEditor />
              </section>
            )}
            {sub === "colores" && <ColoresRespuestas />}
          </div>
        </div>
      </div>
    </div>
  );
}
