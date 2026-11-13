/**
 * Acreditación › Meta › personas que figuran en más de un público (D9). En la propuesta cada público se cuenta con
 * su marco completo: el cruce se muestra y no se descuenta. A qué público va cada persona compartida se decide con el
 * cliente en el listado de envío. La última columna dice la respuesta que exigiría la meta si todas las compartidas
 * se invitan como el otro público. Solo cruza actores con base por persona y columna de correo.
 */
import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { apiMarcoPublicoCrucePublicos, type CruceDeUnPublico, type CruceEntrePublicos as Cruce } from "../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../components/Alert";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { metaCuotaFijada, sugerenciaCuota } from "../criterioSalida";
import { fmtInt, safeNumber } from "../sharedCore";
import { errorLegible, Pastilla } from "./marcoPublico/piezas";
import { useMuestraGeneralStore } from "./store";
import "./marcoPublico/marcoPublico.css";

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;

export function CruceEntrePublicos({ componentes }: { componentes: CalcMuestraComponente[] }) {
  const marcos = useMuestraGeneralStore((s) => s.marcos);
  const conBase = componentes.filter((c) => marcos[c.id]);
  const entrada = useMemo(() => {
    const metas: Record<string, number> = {};
    const tasas: Record<string, number> = {};
    for (const c of conBase) {
      const meta = safeNumber(metaCuotaFijada(c) ?? sugerenciaCuota(c), 0);
      if (meta > 0) metas[c.id] = meta;
      const tasa = safeNumber(c.parametros.tasa_respuesta, 0);
      if (tasa > 0) tasas[c.id] = tasa;
    }
    return { metas, tasas };
  }, [conBase]);
  const clave = JSON.stringify([conBase.map((c) => [c.id, marcos[c.id]?.marco_hash]), entrada]);
  const [res, setRes] = useState<{ clave: string; datos: Cruce | null; error: string | null }>({ clave: "", datos: null, error: null });
  const basta = conBase.length > 1;
  useEffect(() => {
    if (!basta) return undefined;
    let vivo = true;
    apiMarcoPublicoCrucePublicos(entrada)
      .then((datos) => { if (vivo) setRes({ clave, datos, error: null }); })
      .catch((e: unknown) => { if (vivo) setRes({ clave, datos: null, error: errorLegible(e) }); });
    return () => { vivo = false; };
    // La clave resume las dependencias que cambian el cruce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, basta]);

  if (!basta) return null;
  const datos = res.clave === clave ? res.datos : null;
  const publicos = datos?.publicos ?? [];
  // Con un solo público cruzable no hay con quién comparar.
  if (datos && publicos.length < 2) return null;
  const sinAlcance = publicos.filter((p) => p.alcanza !== false && p.alcanzaSinCompartidos === false);

  const columnas: PulsoTableColumna<CruceDeUnPublico>[] = [
    { id: "publico", encabezado: "Público", ancho: 200, celda: (p) => <strong>{p.nombre}</strong> },
    { id: "invitados", encabezado: "Invitados", ancho: 104, tipo: "cifra", celda: (p) => fmtInt(p.invitados) },
    {
      id: "compartidos", encabezado: "En otro público", ancho: 136, tipo: "cifra", celda: (p) => (
        <span className="cmmp-cuota" data-esperada={p.compartidos ? undefined : "true"}>
          <b>{fmtInt(p.compartidos)}</b><small>{p.invitados ? pct(p.compartidos / p.invitados) : "Sin invitados"}</small>
        </span>
      ),
    },
    ...publicos.map((otro): PulsoTableColumna<CruceDeUnPublico> => ({
      id: `con-${otro.id}`, encabezado: `Con ${otro.nombre}`, ancho: 128, tipo: "cifra", celda: (p) => {
        if (p.id === otro.id) return <span className="cmmp-suave">Mismo público</span>;
        const n = p.pares.find((x) => x.id === otro.id)?.n ?? 0;
        return n ? fmtInt(n) : <span className="cmmp-suave">0</span>;
      },
    })),
    {
      id: "exige", encabezado: "Respuesta que exige", ancho: 168, tipo: "cifra", celda: (p) => {
        if (p.exige == null) return <span className="cmmp-suave">Sin meta</span>;
        const peor = p.exigeSinCompartidos;
        const chica = p.alcanzaSinCompartidos === false;
        return (
          <span className="cmmp-cuota" data-chica={chica ? "true" : undefined}>
            <b>{pct(p.exige)}</b>
            <small>{p.compartidos ? (peor == null ? "Sin personas sin cruce" : `${pct(peor)} sin las compartidas`) : "Sin cruce"}</small>
          </span>
        );
      },
    },
  ];

  const conCruce = publicos.filter((p) => p.compartidos > 0).length;
  return (
    <PanelDeMesa zona="cruce" titulo="Personas en más de un público" icono={<Users size={15} aria-hidden="true" />} ocupado={res.clave !== clave}>
      {res.clave === clave && res.error ? <div className="cmmp-pad"><Alert kind="error">{res.error}</Alert></div> : null}
      {datos ? (
        <>
          <div className="cmmp-cifras">
            <div><strong>{fmtInt(conCruce)}<span className="cmmp-de">/{fmtInt(publicos.length)}</span></strong><small>públicos con personas en otro</small></div>
            <div data-tono={sinAlcance.length ? "aviso" : undefined}><strong>{fmtInt(sinAlcance.length)}<span className="cmmp-de">/{fmtInt(publicos.length)}</span></strong><small>metas que no alcanzan sin las compartidas</small></div>
          </div>
          {sinAlcance.map((p) => (
            <div key={p.id} className="cmmp-pad">
              <Alert kind="warn">
                {`${p.nombre}: si sus ${fmtInt(p.compartidos)} personas compartidas se invitan como otro público, la meta exige ${p.exigeSinCompartidos == null ? "más personas de las que quedan" : pct(p.exigeSinCompartidos)} de respuesta y se espera ${pct(p.tasa ?? 0)}.`}
              </Alert>
            </div>
          ))}
          <PulsoTable
            columnas={columnas}
            filas={publicos}
            idDeFila={(p) => p.id}
            ariaLabel="Personas en más de un público"
            densidad="compacta"
            altoMaximo={2000}
          />
          {datos.sinCorreo.length ? (
            <div className="cmmp-leido cmmp-leido--sec">
              {datos.sinCorreo.map((x) => <Pastilla key={x.id}>{x.nombre}: sin correo para cruzar</Pastilla>)}
            </div>
          ) : null}
        </>
      ) : null}
    </PanelDeMesa>
  );
}
