import type { ReactNode } from "react";
import { AlertTriangle, Check, Cloud, KeyRound, Layers, ListChecks } from "../../../vendor/lucide-react";
import { IconConditionalLogic } from "../../../lib/icons";
import { AYUDA_CONTEO_SM, textoConteoSm, type EstadoConexionSm } from "./smImportModel";
import "../styles/xf-sm-import.css";

// Cuatro pasos pares en la cabecera del diálogo. El de conexión refleja el
// estado real apenas se prueba (U4); el de saltos no se marca hecho si no hay
// ninguno (U7). C1: `xlsform-import-sm-pasos`, `equal`.

type Tono = "hecho" | "pendiente" | "error" | "alerta";

function Paso({ tono, icono, etiqueta, valor, titulo }: {
  tono: Tono;
  icono: ReactNode;
  etiqueta: string;
  valor: string;
  titulo?: string;
}) {
  return (
    <li className={`pulso-xf-smi-paso is-${tono}`} title={titulo} data-qa-geometry-member="">
      <span className="pulso-xf-smi-paso-icono" aria-hidden>{icono}</span>
      <span className="pulso-xf-smi-paso-texto">
        <span>{etiqueta}</span>
        <strong>{valor}</strong>
      </span>
    </li>
  );
}

const TONO_CONEXION: Record<EstadoConexionSm["tono"], Tono> = {
  lista: "hecho",
  error: "error",
  "sin-token": "alerta",
  pendiente: "pendiente",
};

export function SmImportFlowSummary({
  conexion,
  sectionCount,
  questionCount,
  fieldCount,
  ruleCount,
  encuestaCargada,
}: {
  conexion: EstadoConexionSm;
  sectionCount: number;
  questionCount: number;
  fieldCount: number;
  ruleCount: number;
  encuestaCargada: boolean;
}) {
  const tonoConexion = TONO_CONEXION[conexion.tono];
  return (
    <ol
      className="pulso-xf-smi-pasos"
      aria-label="Estado de la importación"
      data-qa-geometry-group="xlsform-import-sm-pasos"
      data-qa-geometry-contract="equal"
    >
      <Paso
        tono={tonoConexion}
        icono={tonoConexion === "hecho" ? <Check size={13} /> : tonoConexion === "error" ? <AlertTriangle size={13} /> : conexion.tono === "sin-token" ? <KeyRound size={13} /> : <Cloud size={13} />}
        etiqueta="Conexión"
        valor={conexion.valor}
        titulo={conexion.detalle}
      />
      <Paso
        tono={sectionCount > 0 ? "hecho" : "pendiente"}
        icono={sectionCount > 0 ? <Check size={13} /> : <Layers size={13} />}
        etiqueta="Secciones"
        valor={sectionCount > 0 ? String(sectionCount) : "Sin cargar"}
      />
      <Paso
        tono={questionCount > 0 ? "hecho" : "pendiente"}
        icono={questionCount > 0 ? <Check size={13} /> : <ListChecks size={13} />}
        etiqueta="Contenido"
        valor={questionCount > 0 ? textoConteoSm(questionCount, fieldCount) : "Sin cargar"}
        titulo={questionCount > 0 ? AYUDA_CONTEO_SM : undefined}
      />
      <Paso
        tono={ruleCount > 0 ? "hecho" : encuestaCargada ? "alerta" : "pendiente"}
        icono={<IconConditionalLogic size={13} />}
        etiqueta="Saltos"
        valor={ruleCount > 0 ? `${ruleCount} ${ruleCount === 1 ? "salto" : "saltos"}` : encuestaCargada ? "Sin saltos" : "Después"}
      />
    </ol>
  );
}
