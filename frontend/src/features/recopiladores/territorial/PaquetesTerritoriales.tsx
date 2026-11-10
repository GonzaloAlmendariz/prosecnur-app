// Territorial › Paquetes › Armado (ADR 0118 §1, revamp v5): «Para campo» es la lista de
// piezas con su estado y una acción cada una (ZIP con su detalle por distrito, Excel
// operativo, hojas de ruteo y consolidados); los reemplazos puntuales van a un lado,
// como tarea de excepción. El ZIP del paquete, el Excel
// operativo y los reemplazos puntuales, con los mismos endpoints y la misma
// lógica pura que Selección › Salidas en Hojas de ruta (`salidas.ts`). Ninguno
// cambia el sorteo: sólo producen archivos.
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/paquetes` (intrinsic): paquete y reemplazos
//   puntuales, una tarjeta por miembro.
// - C3/C4: cada tarjeta contiene su vacío; la lista de titulares tiene tope y
//   dice cuántas quedan fuera, el scroll es del panel de la sección.
//
// Los tres archivos se entregan por el kit de entregables (ADR 0133): el botón
// sólo se deshabilita y el contenedor (bloque) queda bajo su pieza, con la línea
// de avance del job y el archivo listo; sin enlaces «Descargar» de segundo clic.

import { resumenDelZip } from "./resumenDelZip";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  apiHojasRutaGenerate,
  apiHojasRutaManualReplacementsPdf,
  apiHojasRutaRouteWorkbook,
  muestraConCuotasRepartidas,
  type HojasRutaJobResult,
  type HojasRutaManualReplacementResult,
  type HojasRutaReplacementPolicy,
  type HojasRutaState,
  type HojasRutaWorkbookResult,
} from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { Archive, FileSpreadsheet, Shuffle } from "../../../vendor/lucide-react";
import { CifrasEnTarjeta } from "../../../components/CifrasEnTarjeta";
import { Panel } from "../../../components/Panel";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { revisarUnidades } from "./revisionUnidades";
import {
  alternarId,
  candidatasDeReemplazo,
  conteosDelPaquete,
  conteosPorDistrito,
  listoParaEntregar,
  pasosDeEntrega,
  pesoLegible,
  sugeridasParaReemplazo,
} from "../../hojasRuta/mapa/seleccion/salidas";
import { nombreDistrito } from "../../hojasRuta/mapa/nombres";
import { codigoDeUmp } from "../../hojasRuta/seleccion/revisionMarco";
import { HojasDelPaquete } from "./HojasDeCampo";
import "./paquetes.css";
import { AvisoDesactualizada, HREF_REENVIO, VacioSinFuente } from "./UnidadesTerritoriales";
import { MODULO_MATERIAL, archivoParaElKit, causaConPista } from "../entregas/modeloEntrega";
import "../styles/entregas.css";

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(Number(n) || 0));
type FilaPaquete = { ubigeo: string; distrito: string; titulares: number; reemplazos: number; zonas: number };
const COLUMNAS_PAQUETE: PulsoTableColumna<FilaPaquete>[] = [
  { id: "distrito", encabezado: "Distrito", ancho: 220, celda: (f) => (f.ubigeo === "total" ? <strong>Total</strong> : nombreDistrito(f.distrito)) },
  { id: "titulares", encabezado: "Fichas titulares", ancho: 130, tipo: "cifra", celda: (f) => fmt(f.titulares) },
  { id: "reemplazos", encabezado: "Fichas de reemplazo", ancho: 150, tipo: "cifra", celda: (f) => fmt(f.reemplazos) },
  { id: "zonas", encabezado: "Hojas por zona", ancho: 130, tipo: "cifra", celda: (f) => fmt(f.zonas) },
];
const POLITICAS = [["alternate_zone_same_district", "Otra zona"], ["paired_by_titular_zone", "Misma zona"]] as const;

/**
 * El estado de una pieza en esta sesión: el backend no guarda cuándo se generó (requiere dato). Mientras se
 * genera sigue «Sin generar»: la espera la dice el contenedor de la pieza, una sola señal.
 */
function EstadoDePieza({ listo }: { listo: boolean }) {
  if (listo) return <span className="rec-terr-pieza-estado" data-estado="listo">Lista</span>;
  return <span className="rec-terr-pieza-estado">Sin generar</span>;
}

/** Lo que la pantalla recuerda de cada archivo ya generado (para las cifras y la nota del contenedor). */
type Generados = {
  zip: HojasRutaJobResult | null;
  excel: HojasRutaWorkbookResult | null;
  puntuales: HojasRutaManualReplacementResult | null;
};
const INICIAL: Generados = { zip: null, excel: null, puntuales: null };

type Props = {
  campaignId: string;
  unidades: UnidadesTerritoriales | null;
  hojas: HojasRutaState | null;
  onRecargar: () => Promise<void>;
  /** Titular que llega marcada desde la ficha de Selección de Hojas de ruta (`?foco=<id_manzana>`). */
  focoInicial?: string | null;
};

export function PaquetesTerritoriales({ campaignId, unidades, hojas, onRecargar, focoInicial = null }: Props) {
  const [e, setE] = useState<Generados>(INICIAL);
  const genZip = useGeneracion({ titulo: "Paquete por distrito", modulo: MODULO_MATERIAL, formato: "zip", articulo: "el", describirError: causaConPista });
  const genExcel = useGeneracion({ titulo: "Excel operativo", modulo: MODULO_MATERIAL, formato: "xlsx", articulo: "el", describirError: causaConPista });
  const genPuntuales = useGeneracion({ titulo: "PDF de reemplazos puntuales", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "el", describirError: causaConPista });
  const [busqueda, setBusqueda] = useState("");
  const [elegidas, setElegidas] = useState<string[]>(() => (focoInicial ? [focoInicial] : []));
  const [porTitular, setPorTitular] = useState(1);
  const config = hojas?.integrated_config ?? null;
  const [politica, setPolitica] = useState<HojasRutaReplacementPolicy>(config?.replacement_policy ?? "alternate_zone_same_district");
  const salidas = hojas?.workspace_outputs ?? null;
  const muestra = salidas?.sample ?? null;
  const pasos = pasosDeEntrega(config?.territorios.length ?? 0, salidas);
  const listo = listoParaEntregar(pasos);
  const corriendo = [genZip, genExcel, genPuntuales].some((g) => g.estado.fase === "en_curso");
  const { filas, coincidencias } = useMemo(() => candidatasDeReemplazo(muestra?.blocks ?? [], busqueda, elegidas), [busqueda, elegidas, muestra]);
  const paquete = conteosDelPaquete(muestra?.blocks ?? [], muestra?.replacement_blocks ?? []);
  const porDistrito = useMemo(() => conteosPorDistrito(muestra?.blocks ?? [], muestra?.replacement_blocks ?? []), [muestra]);
  // M14: las titulares por revisar (mismo criterio que Unidades y Selección) se sugieren primero, con su motivo.
  const ss = config?.sample_size;
  const revision = useMemo(() => revisarUnidades(unidades?.units ?? [], ss ? { respuesta: ss.response_rate, ocupacion: ss.ocupacion ?? 1 } : undefined), [unidades, ss]);
  const sugeridas = useMemo(() => {
    const titulares = (unidades?.units ?? []).filter((u) => u.role === "titular");
    const conMotivo = titulares.filter((u) => { const e = revision.porUnidad.get(u.unit_id); return e && (e.tono === "error" || e.tono === "aviso"); });
    return conMotivo.length ? conMotivo.map((u) => u.unit_id) : sugeridasParaReemplazo(muestra?.blocks ?? []);
  }, [unidades, revision, muestra]);

  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={null} />
      </div>
    );
  }

  // Los datos que vuelven son los del motor (`HojasRutaJobResult`…); el kit ya comprobó que traen el archivo.
  const generarZip = () => {
    if (!config) return;
    void genZip.ejecutar(() => apiHojasRutaGenerate(config, muestra)).then((r) => {
      if (r.ok) setE((s) => ({ ...s, zip: r.datos as HojasRutaJobResult }));
    });
  };
  const generarExcel = () => {
    if (!config) return;
    void genExcel.ejecutar(() => apiHojasRutaRouteWorkbook(config, muestra)).then((r) => {
      if (r.ok) setE((s) => ({ ...s, excel: r.datos as HojasRutaWorkbookResult }));
    });
  };
  const generarPuntuales = () => {
    if (!config || !muestra) return;
    void genPuntuales
      .ejecutar(() => apiHojasRutaManualReplacementsPdf({ ...config, replacement_policy: politica }, muestra, elegidas, porTitular))
      .then((r) => {
        if (r.ok) setE((s) => ({ ...s, puntuales: archivoParaElKit(r.datos) as HojasRutaManualReplacementResult }));
      });
  };

  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      {muestra && !muestraConCuotasRepartidas(muestra.blocks) ? (
        <div className="rec-terr-aviso" role="status">
          <p>
            Las hojas de esta muestra piden la mitad de hombres y la mitad de mujeres en todos los distritos. Reparte las cuotas por
            distrito en Hojas de ruta antes de armar el paquete. <Link to={HREF_REENVIO}>Ir a Hojas de ruta</Link>
          </p>
        </div>
      ) : null}

      {/* Pasada de diseño (2 nov 2026): lo que lleva el paquete se lee arriba, en cifras, y cada parte vive en su Panel. */}
      <CifrasEnTarjeta
        cifras={[
          { id: "titulares", rotulo: "Titulares", valor: fmt(paquete.titulares), nota: "una ficha y una hoja de ruteo cada una" },
          { id: "reemplazos", rotulo: "Reemplazos", valor: fmt(paquete.reemplazos), nota: "por si una titular falla" },
          { id: "zonas", rotulo: "Zonas", valor: fmt(paquete.zonas), nota: `en ${fmt(porDistrito.length)} ${porDistrito.length === 1 ? "distrito" : "distritos"}` },
          {
            id: "piezas", rotulo: "Piezas listas", valor: fmt(Number(Boolean(e.zip)) + Number(Boolean(e.excel))), de: 2,
            avance: { valor: Number(Boolean(e.zip)) + Number(Boolean(e.excel)), total: 2, etiqueta: "Piezas para campo generadas" },
          },
        ]}
      />
      <div className="rec-terr-paquetes" data-qa-geometry-group="material-campo/territorial/paquetes" data-qa-geometry-contract="intrinsic">
        <div className="rec-terr-paquetes-principal" data-qa-geometry-member>
          <Panel
            className="rec-terr-piezas"
            title={<><Archive size={16} aria-hidden /> Para campo</>}
            hint="Lo que se imprime y se reparte por distrito."
          >
            {!listo ? (
              <p className="rec-terr-aviso" role="status">
                Falta en Hojas de ruta: {pasos.filter((p) => !p.ok).map((p) => p.label.toLocaleLowerCase("es-PE")).join(", ")}. <Link to={HREF_REENVIO}>Ir a Hojas de ruta</Link>
              </p>
            ) : null}
            {!muestra ? (
              <div className="rec-terr-fila">
                <p className="rec-terr-nota">Hojas de ruta no tiene una muestra guardada con la que armar el paquete.</p>
                <PulsoButton variant="ghost" size="sm" onClick={() => { void onRecargar(); }}>Volver a leer Hojas de ruta</PulsoButton>
              </div>
            ) : null}
            <ul className="rec-terr-piezas-lista">
              <li className="rec-terr-pieza">
                <span className="rec-terr-pieza-icono" aria-hidden><Archive size={16} /></span>
                <span className="rec-terr-pieza-texto">
                  <strong>Paquete por distrito</strong>
                  <small>Fichas, hojas por zona, Excel operativo y metadatos del marco, una carpeta por distrito</small>
                </span>
                <span className="rec-terr-pieza-formato">ZIP</span>
                <EstadoDePieza listo={Boolean(e.zip)} />
                <PulsoButton variant="primary" size="sm" disabled={!config || !listo || corriendo || unidades.stale} onClick={generarZip}>
                  Generar
                </PulsoButton>
                <div className="rec-terr-pieza-extra">
                  <ContenedorEntregable
                    estado={genZip.estado}
                    forma="bloque"
                    onCerrar={genZip.cerrar}
                    pie={e.zip ? <span className="rec-entrega-nota">{resumenDelZip(e.zip, pesoLegible(e.zip.size))}</span> : undefined}
                  />
                  {muestra ? (
                    <details className="rec-terr-pieza-detalle">
                      <summary>Ver por distrito ({fmt(porDistrito.length)})</summary>
                      <PulsoTable
                        columnas={COLUMNAS_PAQUETE}
                        filas={[...porDistrito, { ubigeo: "total", distrito: "Total", titulares: paquete.titulares, reemplazos: paquete.reemplazos, zonas: paquete.zonas }]}
                        idDeFila={(f) => f.ubigeo}
                        ariaLabel="Contenido del paquete por distrito"
                        densidad="compacta"
                        altoMaximo={100000}
                      />
                    </details>
                  ) : null}
                </div>
              </li>
              <li className="rec-terr-pieza">
                <span className="rec-terr-pieza-icono" aria-hidden><FileSpreadsheet size={16} /></span>
                <span className="rec-terr-pieza-texto">
                  <strong>Excel operativo</strong>
                  <small>
                    {e.excel
                      ? `${fmt(e.excel.n_blocks)} titulares y ${fmt(e.excel.n_replacement_blocks)} reemplazos, ${pesoLegible(e.excel.size)}`
                      : `${fmt(paquete.titulares)} titulares, una hoja por distrito`}
                  </small>
                </span>
                <span className="rec-terr-pieza-formato">XLSX</span>
                <EstadoDePieza listo={Boolean(e.excel)} />
                <PulsoButton variant="secondary" size="sm" disabled={!config || !listo || corriendo || unidades.stale} onClick={generarExcel}>
                  Generar
                </PulsoButton>
                <div className="rec-terr-pieza-extra">
                  <ContenedorEntregable estado={genExcel.estado} forma="bloque" onCerrar={genExcel.cerrar} />
                </div>
              </li>
            </ul>
          </Panel>

          <HojasDelPaquete campaignId={campaignId} unidades={unidades} />
        </div>

        <Panel
          className="rec-terr-paquetes-secundaria"
          data-qa-geometry-member
          aria-label="Reemplazos puntuales"
          title={<><Shuffle size={16} aria-hidden /> Reemplazos puntuales</>}
          hint="Para las titulares que fallaron en campo: un PDF con reemplazos nuevos, sin tocar el sorteo."
        >
          {sugeridas.length ? (
            <div className="rec-terr-sugeridas">
              <small>Por revisar en la muestra: conviene mirarlas primero</small>
              <div className="rec-terr-chips">
                {/* Sistema Pabellón: la lista va completa, sin «y N más». */}
                {sugeridas.map((id) => {
                  const b = muestra?.blocks.find((x) => x.id_manzana === id);
                  return (
                    <button key={id} type="button" className="rec-terr-chip" aria-pressed={elegidas.includes(id)} disabled={corriendo} onClick={() => setElegidas((l) => alternarId(l, id))}>
                      <b>{b ? codigoDeUmp(b) : id}</b>
                      {revision.porUnidad.get(id)?.motivo ? <small>{revision.porUnidad.get(id)?.motivo}</small> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <PulsoInput type="search" size="sm" aria-label="Buscar titular" placeholder="Buscar UMP, distrito o zona" value={busqueda} disabled={!muestra || corriendo} onChange={(ev) => setBusqueda(ev.target.value)} />
          {filas.length ? (
            <ul className="rec-terr-filas">
              {filas.map((f) => (
                <li key={f.id}>
                  <span>
                    <strong>{f.codigo}</strong>
                    <small>{nombreDistrito(f.distrito)}, zona {f.zona}</small>
                  </span>
                  <PulsoSwitch size="sm" ariaLabel={`${f.elegida ? "Quitar" : "Pedir reemplazos para"} ${f.codigo}`} checked={f.elegida} disabled={corriendo} onCheckedChange={() => setElegidas((l) => alternarId(l, f.id))} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rec-terr-nota">{busqueda.trim() ? `Ninguna titular coincide con "${busqueda}".` : "Busca la titular que falló para pedirle reemplazos."}</p>
          )}
          {coincidencias > 12 ? <p className="rec-terr-nota">Se muestran 12 de {fmt(coincidencias)}: afina la búsqueda.</p> : null}
          <div className="rec-terr-fila">
            <label className="rec-terr-campo">
              <span>Reemplazos por titular</span>
              <PulsoInput type="number" size="sm" min={1} max={10} value={porTitular} disabled={corriendo} onChange={(ev) => setPorTitular(Math.min(10, Math.max(1, Math.round(Number(ev.target.value) || 1))))} />
            </label>
            <div className="rec-terr-campo">
              <span aria-hidden>Dónde buscarlos</span>
              <GlidingRadioGroup value={politica} options={POLITICAS} getOptionValue={(o) => o[0]} onValueChange={setPolitica} className="rec-terr-opciones" aria-label="Dónde buscar los reemplazos puntuales" getOptionProps={() => ({ disabled: corriendo })}>
                {(o) => <span>{o[1]}</span>}
              </GlidingRadioGroup>
            </div>
          </div>
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={!config || !muestra || !elegidas.length || corriendo || unidades.stale}
            onClick={generarPuntuales}
          >
            {elegidas.length ? `PDF de reemplazos para ${elegidas.length} titular${elegidas.length === 1 ? "" : "es"}` : "Elige al menos una titular"}
          </PulsoButton>
          <ContenedorEntregable
            estado={genPuntuales.estado}
            forma="bloque"
            onCerrar={genPuntuales.cerrar}
            pie={e.puntuales
              ? <span className="rec-entrega-nota">{fmt(e.puntuales.n_replacement_blocks)} reemplazos para {fmt(e.puntuales.n_titulars)} titulares</span>
              : undefined}
          />
        </Panel>
      </div>
    </div>
  );
}
