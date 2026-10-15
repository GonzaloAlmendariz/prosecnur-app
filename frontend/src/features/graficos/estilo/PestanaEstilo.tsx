// Pestaña «Identidad» (antes «Estilo del cliente») de Procesamiento › Gráficos (F6.4; A6 R3; ADR 0094; dirección F6 §4.6). Dirección:
// `/graficos?pestana=identidad` (`estilo` se lee como alias). Edita `config.estilo_cliente` en `usePlanStore` (un paso deshacible por cambio) y lo guarda
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
import { motivoPiezaNoDisponible } from "./disponibilidadEstilo";
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
import { SeccionLetra } from "./SeccionLetra";
import { IconosEditor } from "../IconosEditor";
import { ColoresRespuestas } from "./ColoresRespuestas";
import { useSubpestana, type Subpestana } from "../subpestanas/Subpestanas";
import { Segmentado } from "../subpestanas/Segmentado";
import { PiezasIdentidad, type ClavePieza, type Pieza } from "./PiezasIdentidad";
import { SeccionLineaVisual } from "../estiloInforme/SeccionLineaVisual";
import { lineaVisualAplicada } from "../estiloInforme/modeloEstiloInforme";
import { usePptStyleProfiles } from "../usePptStyleProfiles";
import { useColoresPendientes } from "./ColoresPendientesAviso";
import { useLineasPropias } from "./lineasPropiasStore";
import { useVariables } from "../useVariables";
import { ESTILO_AMBITOS } from "../../../api/graficosEstilo";
import { ETIQUETA_AMBITO } from "./modeloEstilo";
import { MarcaModificado } from "./SelloProcedencia";
import { TarjetaLogo } from "./TarjetaLogo";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCcw } from "../../../vendor/lucide-react";
import "./estilo.css";

function mensajeDe(error: unknown, porDefecto: string): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}

// ID2 del rediseño (2026-10-14): las piezas, en el orden del prototipo; la elegida vive en el `foco` de la dirección.
const SUB_IDENTIDAD: readonly Subpestana<ClavePieza>[] = [
  { key: "linea", label: "Línea visual" },
  { key: "colores", label: "Colores de las respuestas" },
  { key: "logos", label: "Logos" },
  { key: "letra", label: "Letra" },
  { key: "iconos", label: "Íconos propios" },
];
const ID_PANEL = "f6-id-detalle";

export default function PestanaEstilo() {
  const [sub, setSub] = useSubpestana(SUB_IDENTIDAD);
  const location = useLocation();
  const scope = useGraficosReportScope(location.search);
  const motivoPieza = motivoPiezaNoDisponible(scope, sub);
  const { state } = useSession();
  const prepOk = !!state?.analitica_prep_ok;

  const estilo = usePlanStore((s) => s.estiloCliente);
  const scopeRules = usePlanStore((s) => s.scopeRules);
  const iconos = usePlanStore((s) => s.iconos);
  const { profiles } = usePptStyleProfiles();
  const propias = useLineasPropias((s) => s.lineas);
  const { pendientes } = useColoresPendientes();
  const { sources } = useVariables();
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
    if (opciones) return;
    let vigente = true;
    apiGraficosEstiloOpciones()
      .then((o) => { if (vigente) setOpciones(o); })
      .catch((error: unknown) => { if (vigente) setOpciones(null, mensajeDe(error, "No se pudo leer el estilo por defecto.")); });
    return () => { vigente = false; };
  }, [opciones, setOpciones]);

  // Los defaults dependen del perfil y del ámbito por defecto de la base. El autosave ya los publica con cada GET de la
  // config (también al cambiar de base); sólo se piden aquí si todavía no llegaron por esa vía.
  useEffect(() => {
    if (defaults) return;
    let vigente = true;
    apiGraficosEstiloDefaults()
      .then((d) => { if (vigente) setDefaults(d); })
      .catch(() => { /* Sin defaults del backend se compara contra el recetario (`referenciaEstilo`). */ });
    return () => { vigente = false; };
  }, [defaults, setDefaults, state?.active_base, state?.session_id]);

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

  const ambito: EstiloAmbito = estilo.ambito ?? ref.ambito ?? "proyecto";
  const paso = pasoEfectivo(estilo, ref);
  const listo = !!opciones || !!opcionesError;
  const lineaId = lineaVisualAplicada(scopeRules);
  // La aplicada puede ser del recetario o propia (ID3): se busca en las dos para mostrar su nombre y no su id.
  // Una propia que se borró de la biblioteca sigue aplicada en el estudio con sus valores copiados (D7): se dice así.
  const lineaNombre = lineaId ? [...profiles, ...propias].find((p) => lineaVisualAplicada(p.scope_rules ?? {}) === lineaId)?.titulo_humano
    ?? (lineaId.startsWith("lv-") ? "Una línea que ya no está en la biblioteca" : lineaId) : null;
  const faltanColores = new Set(pendientes.map((p) => p.fila.id)).size;
  const conLogos = logosModificados(decisiones);
  const conLetra = letraModificada(decisiones);
  const piezas: Pieza[] = [
    { clave: "linea", titulo: "Línea visual", resumen: lineaNombre ?? "Sin línea aplicada", estado: lineaNombre ? { texto: "Aplicada", tono: "ok" } : { texto: "Por defecto", tono: "neutro" } },
    { clave: "colores", titulo: "Colores de las respuestas", resumen: "Los colores de cada escala de respuestas",
      estado: faltanColores ? { texto: `${faltanColores} sin colores`, tono: "aviso" } : { texto: "Completos", tono: "ok" } },
    { clave: "logos", titulo: "Logos", resumen: conLogos ? "Logos propios" : "Los del recetario", estado: conLogos ? { texto: "Propios", tono: "ok" } : { texto: "Por defecto", tono: "neutro" } },
    { clave: "letra", titulo: "Letra", resumen: conLetra ? "Tamaño ajustado" : "Tamaño estándar", estado: conLetra ? { texto: "Ajustada", tono: "ok" } : { texto: "Estándar", tono: "neutro" } },
    { clave: "iconos", titulo: "Íconos propios", resumen: "Objetivo y capítulos", estado: { texto: String(iconos.length), tono: iconos.length ? "ok" : "neutro" } },
  ];
  const nBases = sources.length;
  const subtitulo = ambito === "base"
    ? `Cada base con su estilo · ahora: ${state?.active_base ?? "base activa"}`
    : nBases > 1 ? `Un solo estilo para las ${nBases} bases` : "Un solo estilo para el estudio";

  return (
    <div className="pulso-f6-estilo" data-audit-ready={listo ? "graficos-estilo" : "false"} data-qa-surface="graficos/f6-estilo">
      {/* ID1 del rediseño (2026-10-14): el ámbito va en la cabecera y rige todas las piezas. En el compartido no aplica
          (logos y letra no llegan a su PPT todavía). */}
      <header className="pulso-f6-estilo-barra">
        <h2 className="pulso-f6-estilo-titulo">Identidad</h2>
        {scope !== "consolidated" && (<>
          <Segmentado etiqueta="Dónde se guarda la identidad" valor={ambito}
            onCambiar={(nuevo) => { if (nuevo !== ambito) cambiar((e) => conAmbito(e, nuevo)); }}
            opciones={ESTILO_AMBITOS.map((id) => ({ clave: id, rotulo: id === "proyecto" ? "Todo el estudio" : ETIQUETA_AMBITO[id].titulo }))} />
          <span className="pulso-f6-estilo-sub" title={ETIQUETA_AMBITO[ambito].explicacion}>{subtitulo}</span>
        </>)}
      </header>
      <div className="pulso-f6-estilo-cuerpo" data-qa-scroll-owner="estilo">
        <div className="pulso-f6-id-grid">
          <PiezasIdentidad piezas={piezas} actual={sub} onElegir={setSub} idPanel={ID_PANEL} />
          <div className="pulso-f6-estilo-secciones" id={ID_PANEL} role="tabpanel" aria-labelledby={`f6-id-pieza-${sub}`}
            data-qa-geometry-group="graficos/f6-estilo-secciones" data-qa-geometry-contract="intrinsic">
            {opcionesError ? <p className="pulso-f6-estilo-error" role="alert">{opcionesError}</p> : null}
            {/* QA del Informe (2026-10-15): el motivo es una sección más del grupo, no un <p> suelto (capacity-drift). */}
            {motivoPieza ? (
              <section className="pulso-f6-estilo-seccion" data-qa-geometry-member>
                <p className="pulso-f6-estilo-ayuda" role="status">{motivoPieza}</p>
              </section>
            ) : null}
            {/* D3: la línea visual vive en Identidad (antes en Reglas); su biblioteca llega con ID3. */}
            {sub === "linea" && <SeccionLineaVisual aplicada={lineaId} />}
            {sub === "logos" && !motivoPieza && (<>

            <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-logos-titulo" data-qa-geometry-member>
              <header className="pulso-f6-estilo-seccion-cabecera">
                <h3 id="f6-estilo-logos-titulo">Logos</h3>
                <MarcaModificado visible={logosModificados(decisiones)} />
                {logosModificados(decisiones) ? (
                  <PulsoButton variant="ghost" size="sm" onClick={() => cambiar(sinLogos)} aria-label="Volver a los logos por defecto">
                    <RotateCcw size={14} aria-hidden="true" />
                    Restablecer
                  </PulsoButton>
                ) : null}
              </header>
              <p className="pulso-f6-estilo-ayuda">El logo de cada lugar de la portada y la contraportada. Si no subes uno, va el de por defecto. Sólo PNG, hasta 5 MB.</p>
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

            {sub === "letra" && !motivoPieza && <SeccionLetra
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
                <h3 id="f6-estilo-iconos-titulo" className="pulso-sr-only">Íconos</h3>
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
