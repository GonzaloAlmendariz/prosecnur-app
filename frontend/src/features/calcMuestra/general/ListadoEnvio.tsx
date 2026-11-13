/**
 * Acreditación › Selección › listado de envío de un barrido (D9). Cada persona recibe una sola encuesta: para cada par
 * de públicos con personas en común se elige a cuál van, y el listado se descarga cuando todos los pares están
 * decididos. Las decisiones se guardan en el estudio y viajan en el `.pulso`.
 */
import { useEffect, useState } from "react";
import { FileSpreadsheet, Send } from "lucide-react";

import {
  apiMarcoPublicoListado, apiMarcoPublicoListadoDescargar, type DecisionDePar, type ListadoDeEnvio,
} from "../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../components/Alert";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { MODULO_CALC_MUESTRA } from "../entregas/modeloEntrega";
import { fmtInt } from "../sharedCore";
import { errorLegible, Pastilla } from "./marcoPublico/piezas";
import { useMuestraGeneralStore } from "./store";
import "./marcoPublico/marcoPublico.css";

type Par = ListadoDeEnvio["pares"][number];
type Publico = ListadoDeEnvio["publicos"][number];

export function ListadoEnvio() {
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const clave = JSON.stringify(Object.entries(marcos).map(([id, m]) => [id, m?.marco_hash]));
  const [res, setRes] = useState<{ clave: string; datos: ListadoDeEnvio | null; error: string | null }>({ clave: "", datos: null, error: null });
  const [guardando, setGuardando] = useState(false);
  const descarga = useGeneracion({ titulo: "Listado de envío", modulo: MODULO_CALC_MUESTRA, formato: "xlsx", articulo: "el" });

  useEffect(() => {
    let vivo = true;
    apiMarcoPublicoListado()
      .then((datos) => { if (vivo) setRes({ clave, datos, error: null }); })
      .catch((e: unknown) => { if (vivo) setRes({ clave, datos: null, error: errorLegible(e) }); });
    return () => { vivo = false; };
    // La clave resume los marcos que cambian el listado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const datos = res.clave === clave ? res.datos : null;
  if (datos && datos.publicos.length === 0) return null;

  async function guardar(cambio: { decisiones?: DecisionDePar[]; tandas?: { n: number; semilla: number } }) {
    setGuardando(true);
    try {
      const nuevo = await apiMarcoPublicoListado(cambio);
      setRes({ clave, datos: nuevo, error: null });
    } catch (e) {
      setRes({ clave, datos, error: errorLegible(e) });
    } finally {
      setGuardando(false);
    }
  }

  function decidir(par: Par, va: string) {
    if (!datos) return;
    const decisiones: DecisionDePar[] = datos.pares
      .map((p) => (p.a === par.a && p.b === par.b ? { a: p.a, b: p.b, va } : { a: p.a, b: p.b, va: p.va }))
      .filter((d) => d.va);
    void guardar({ decisiones });
  }
  const nTandas = datos?.tandas.n ?? 1;

  const colPares: PulsoTableColumna<Par>[] = [
    { id: "par", encabezado: "Públicos", ancho: 280, celda: (p) => <strong>{p.nombreA} y {p.nombreB}</strong> },
    { id: "n", encabezado: "Personas en común", ancho: 150, tipo: "cifra", celda: (p) => fmtInt(p.n) },
    {
      id: "va", encabezado: "Se les envía como", ancho: 320, celda: (p) => (
        <GlidingRadioGroup
          value={p.va}
          options={[{ id: p.a, rotulo: p.nombreA }, { id: p.b, rotulo: p.nombreB }]}
          getOptionValue={(o) => o.id}
          onValueChange={(va) => decidir(p, va)}
          className="cmg-segmentado"
          aria-label={`A qué público van las personas de ${p.nombreA} y ${p.nombreB}`}
        >
          {(o) => <span>{o.rotulo}</span>}
        </GlidingRadioGroup>
      ),
    },
  ];
  const colPublicos: PulsoTableColumna<Publico>[] = [
    { id: "publico", encabezado: "Público", ancho: 240, celda: (p) => <strong>{p.nombre}</strong> },
    { id: "invitados", encabezado: "Invitados", ancho: 120, tipo: "cifra", celda: (p) => fmtInt(p.invitados) },
    { id: "cedidas", encabezado: "Van a otro público", ancho: 150, tipo: "cifra", celda: (p) => (p.cedidas ? fmtInt(p.cedidas) : <span className="cmmp-suave">0</span>) },
    { id: "pordecidir", encabezado: "Por decidir", ancho: 120, tipo: "cifra", celda: (p) => (p.porDecidir ? fmtInt(p.porDecidir) : <span className="cmmp-suave">0</span>) },
    { id: "quedan", encabezado: "Reciben la encuesta", ancho: 160, tipo: "cifra", celda: (p) => <strong>{fmtInt(p.quedan)}</strong> },
    ...(nTandas > 1 ? [{
      id: "tanda", encabezado: "Por tanda", ancho: 130, tipo: "cifra" as const,
      // El reparto en rueda deja tandas que difieren a lo más en una persona.
      celda: (p: Publico) => {
        const menor = Math.floor(p.quedan / nTandas);
        const mayor = Math.ceil(p.quedan / nTandas);
        return menor === mayor ? fmtInt(menor) : `${fmtInt(menor)} a ${fmtInt(mayor)}`;
      },
    }] : []),
  ];

  const decididos = datos ? datos.pares.length - datos.pendientes : 0;
  return (
    <PanelDeMesa
      zona="listado"
      titulo="Listado de envío"
      icono={<Send size={15} aria-hidden="true" />}
      ocupado={res.clave !== clave || guardando}
      acciones={(
        <PulsoButton
          variant="primary"
          size="sm"
          disabled={!datos?.listo || descarga.estado.fase === "en_curso"}
          onClick={() => { void descarga.ejecutar(() => apiMarcoPublicoListadoDescargar()); }}
        >
          <FileSpreadsheet size={14} aria-hidden="true" /> Descargar Excel
        </PulsoButton>
      )}
    >
      {res.error ? <div className="cmmp-pad"><Alert kind="error">{res.error}</Alert></div> : null}
      {datos ? (
        <>
          <div className="cmmp-formula">
            <label className="cmmp-ctl">
              <small>Tandas</small>
              <PulsoSelect
                size="sm"
                value={String(nTandas)}
                ariaLabel="En cuántas tandas se envía"
                options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: i === 0 ? "Un solo envío" : `${i + 1} tandas` }))}
                onValueChange={(v) => { void guardar({ tandas: { n: Number(v), semilla: datos.tandas.semilla } }); }}
              />
            </label>
          </div>
          <div className="cmmp-cifras cmmp-cifras--4">
            <div><strong>{fmtInt(datos.publicos.reduce((s, p) => s + p.quedan, 0))}</strong><small>personas reciben la encuesta</small></div>
            <div data-tono={datos.pendientes ? "aviso" : undefined}><strong>{fmtInt(decididos)}<span className="cmmp-de">/{fmtInt(datos.pares.length)}</span></strong><small>pares decididos</small></div>
            <div><strong>{fmtInt(datos.publicos.reduce((s, p) => s + p.cedidas, 0))}</strong><small>van a otro público</small></div>
            <div data-tono={datos.sinAsignar ? "aviso" : undefined}><strong>{fmtInt(datos.sinAsignar)}</strong><small>sin público asignado</small></div>
          </div>
          {datos.sinAsignar ? (
            <div className="cmmp-pad">
              <Alert kind="warn">{`${fmtInt(datos.sinAsignar)} personas están en tres o más públicos y las decisiones se contradicen entre sí (cada público gana un par). Cambia una de las decisiones de sus pares.`}</Alert>
            </div>
          ) : null}
          {datos.pares.length ? (
            <PulsoTable columnas={colPares} filas={datos.pares} idDeFila={(p) => `${p.a}|${p.b}`} ariaLabel="Pares de públicos con personas en común" densidad="compacta" altoMaximo={2000} />
          ) : null}
          <PulsoTable columnas={colPublicos} filas={datos.publicos} idDeFila={(p) => p.id} ariaLabel="Personas que reciben la encuesta por público" densidad="compacta" altoMaximo={2000} />
          {datos.sinCorreo.length ? (
            <div className="cmmp-leido cmmp-leido--sec">
              {datos.sinCorreo.map((x) => <Pastilla key={x.id}>{x.nombre}: sin base con correo</Pastilla>)}
            </div>
          ) : null}
          <ContenedorEntregable estado={descarga.estado} forma="bloque" onCerrar={descarga.cerrar} />
        </>
      ) : null}
    </PanelDeMesa>
  );
}
