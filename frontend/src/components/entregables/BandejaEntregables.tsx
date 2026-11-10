// Bandeja «Entregables» de la barra superior: lo generado en esta sesión,
// con su estado y las mismas acciones que el contenedor (Abrir, Mostrar en la
// carpeta o Descargar). El botón es neutro: un punto de estado quieto, sin
// pulsar ni animar. No aparece hasta la primera generación.
//
// No es un panel direccionable (`?panel=`): su contenido es efímero de la
// sesión y un enlace no podría reproducirlo. Usa el `Popover` del kit.

import { useEffect, useRef } from "react";
import { AlertCircle } from "../../vendor/lucide-react";
import { useOptionalSession } from "../../lib/SessionContext";
import { carpetaDelEntregable } from "../../api/jobs";
import { Popover } from "../Popover";
import { AccionesArchivo } from "./AccionesArchivo";
import { NombreArchivo } from "./NombreArchivo";
import { resumenBandeja, useBandejaEntregables, type EntradaBandeja } from "./bandejaStore";
import { carpetaDeRuta, comoQuedo, textoDelAvance } from "./generacionModelo";
import { TileFormato } from "./TileFormato";
import "./entregables.css";

const ROTULO_PUNTO = {
  inactiva: "",
  en_curso: "uno en curso",
  lista: "listos",
  fallo: "el último falló",
} as const;

function ItemBandeja({ entrada }: { entrada: EntradaBandeja }) {
  const { estado } = entrada;
  const archivo = estado.fase === "lista" ? estado.archivos[0] ?? null : null;
  const ruta = estado.fase === "lista" ? archivo?.guardadoEn ?? estado.rutaDescargada ?? null : null;
  const detalle = estado.fase === "en_curso"
    ? textoDelAvance(estado)
    : estado.fase === "fallo"
      ? estado.causa
      : archivo?.guardadoEn
        ? `Guardado en ${carpetaDelEntregable(archivo.guardadoEn, null)}`
        : ruta ? `Descargado en ${carpetaDeRuta(ruta)}` : comoQuedo(archivo, estado.fase === "lista" && estado.sinDescargar);
  return (
    <li className="pulso-entregable-bandeja-item" data-entregable-fase={estado.fase} data-qa-geometry-member="true">
      {estado.fase === "fallo"
        ? <AlertCircle size={14} className="pulso-entregable-alerta" aria-hidden="true" />
        : <TileFormato formato={archivo?.formato ?? (estado.fase === "en_curso" ? estado.formato ?? null : null)} chico />}
      <div className="pulso-entregable-cuerpo">
        {archivo ? <NombreArchivo nombre={archivo.nombre} /> : <div className="pulso-entregable-nombre">{estado.titulo}</div>}
        <div className="pulso-entregable-meta"><span>{detalle}</span></div>
      </div>
      {archivo && estado.fase === "lista" && (
        <AccionesArchivo archivo={archivo} rutaDescargada={estado.rutaDescargada ?? null} sinDescargar={estado.sinDescargar} compacta />
      )}
    </li>
  );
}

export function BandejaEntregables() {
  const entradas = useBandejaEntregables((s) => s.entradas);
  const vaciar = useBandejaEntregables((s) => s.vaciar);
  const sessionId = useOptionalSession()?.sessionId ?? "";
  const sesionPrevia = useRef(sessionId);

  // Otro proyecto, otra sesión: lo generado en la anterior no es de este.
  useEffect(() => {
    if (sesionPrevia.current === sessionId) return;
    sesionPrevia.current = sessionId;
    vaciar();
  }, [sessionId, vaciar]);

  const { total, punto } = resumenBandeja(entradas);
  if (total === 0) return null;

  return (
    <Popover
      side="bottom"
      align="end"
      maxWidth={380}
      ariaLabel="Entregables de esta sesión"
      className="pulso-entregable-bandeja-popover"
      trigger={
        <button
          type="button"
          className="pulso-entregable-bandeja-boton"
          data-punto={punto}
          aria-label={`Entregables: ${total}${ROTULO_PUNTO[punto] ? `, ${ROTULO_PUNTO[punto]}` : ""}`}
        >
          <span className="pulso-entregable-punto" aria-hidden="true" />
          Entregables
          <span className="pulso-entregable-bandeja-n">{total}</span>
        </button>
      }
    >
      <div className="pulso-entregable-bandeja">
        <h2 className="pulso-entregable-bandeja-titulo">En esta sesión</h2>
        <ul
          className="pulso-entregable-bandeja-lista"
          data-qa-geometry-group="entregables/bandeja"
          data-qa-geometry-contract="intrinsic"
          data-qa-geometry-capacity="owned"
        >
          {entradas.map((entrada) => <ItemBandeja key={entrada.id} entrada={entrada} />)}
        </ul>
      </div>
    </Popover>
  );
}
