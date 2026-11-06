// La Ficha del estudio (ADR 0124): el nombre con que la app y los entregables
// nombran el estudio, y su tipo, que fija el modo de Cálculo de muestra y de
// Monitoreo. Un estudio tiene un solo tipo; las poblaciones y los canales de
// acreditación son de Monitoreo y de Material, no de aquí.

import { useEffect, useMemo, useState } from "react";

import { Dialog } from "../../components/Dialog";
import { PulsoButton } from "../../components/PulsoButton";
import { PulsoField, PulsoFieldRow } from "../../components/PulsoField";
import { PulsoInput } from "../../components/PulsoInput";
import { PulsoSelect } from "../../components/PulsoSelect";
import { PulsoSwitch } from "../../components/PulsoSwitch";
import { FileText } from "../../vendor/lucide-react";
import {
  OPCIONES_TIPO,
  MARCO_DE_ALUMNOS,
  opcionDelPerfil,
  perfilDeOpcion,
  textoOrigen,
  type OpcionTipo,
} from "./copiaDelEstudio";
import { PANEL_ESTUDIO } from "./panelEstudio";
import { useEstudioDeclarado } from "./useEstudioDeclarado";
import type { PlannerSeccion } from "../../api/planner";
import "./estudio.css";

const VACIO = { nombre: "", codigo: "", cliente: "", objetivo: "" };

export default function FichaDelEstudio() {
  const { estado, cargando, guardando, error, declarar } = useEstudioDeclarado();
  const base = estado?.planner.estudio ?? VACIO;
  const perfilPrevio = estado?.planner.perfiles[0];
  const [form, setForm] = useState(VACIO);
  const [opcion, setOpcion] = useState<OpcionTipo | "">("");
  // ADR 0125 §3: el marco de alumnos es un atributo; se guarda en `seleccion`.
  const [conMarco, setConMarco] = useState(false);

  useEffect(() => {
    if (!estado) return;
    setForm(estado.planner.estudio);
    setOpcion(opcionDelPerfil(estado.planner.perfiles[0]));
    setConMarco(estado.planner.perfiles[0]?.seleccion === "marco");
  }, [estado]);

  const cambioEstudio = form.nombre !== base.nombre || form.codigo !== base.codigo
    || form.cliente !== base.cliente || form.objetivo !== base.objetivo;
  const opcionPrevia = opcionDelPerfil(perfilPrevio);
  const cambioTipo = opcion !== "" && (opcion !== opcionPrevia
    || (opcion === "aulas" && conMarco !== (perfilPrevio?.seleccion === "marco")));
  const detalleTipo = OPCIONES_TIPO.find((o) => o.valor === opcion)?.diseno;

  const pasos = useMemo(() => {
    const lista: Array<readonly [PlannerSeccion, unknown]> = [];
    if (cambioEstudio) lista.push(["estudio", form]);
    if (cambioTipo && opcion) lista.push(["perfiles", [perfilDeOpcion(opcion, conMarco, perfilPrevio)]]);
    return lista;
  }, [cambioEstudio, cambioTipo, form, opcion, conMarco, perfilPrevio]);

  const nombreFalta = cambioEstudio && !form.nombre.trim();
  const origen = estado
    ? estado.origen.perfiles === "declarado"
      ? textoOrigen("declarado", estado.declaradoEn.perfiles)
      : textoOrigen(estado.origen.estudio, estado.declaradoEn.estudio)
    : null;

  return (
    <Dialog
      panel={PANEL_ESTUDIO}
      size="md"
      title="Ficha del estudio"
      subtitle="El nombre y el tipo con que los módulos y los entregables reconocen este estudio."
      icon={<FileText size={16} aria-hidden="true" />}
      dismissible={!guardando}
      footerStatus={origen}
      footer={(
        <PulsoButton
          variant="primary"
          disabled={!estado || guardando || !pasos.length || nombreFalta}
          onClick={() => void declarar(pasos)}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </PulsoButton>
      )}
    >
      <div className="estudio-ficha" data-audit-ready={cargando ? "false" : "ficha-del-estudio"}>
        {error ? <p className="estudio-ficha__error" role="alert">{error}</p> : null}

        <fieldset className="estudio-ficha__grupo" disabled={!estado || guardando}>
          <legend className="estudio-ficha__titulo">Identificación</legend>
          <PulsoFieldRow className="estudio-ficha__campos" geometryGroup="estudio/identificacion">
            <PulsoField label="Nombre" error={nombreFalta ? "El nombre es obligatorio." : undefined}>
              <PulsoInput value={form.nombre} maxLength={160} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </PulsoField>
            <PulsoField label="Código" labelDetail="opcional">
              <PulsoInput value={form.codigo} maxLength={40} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
          <PulsoFieldRow className="estudio-ficha__campos" geometryGroup="estudio/cliente">
            <PulsoField label="Cliente" labelDetail="opcional">
              <PulsoInput value={form.cliente} maxLength={160} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </PulsoField>
            <PulsoField label="Objetivo, en una línea" labelDetail="opcional, no se publica">
              <PulsoInput value={form.objetivo} maxLength={240} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
            </PulsoField>
          </PulsoFieldRow>
        </fieldset>

        <fieldset className="estudio-ficha__grupo" disabled={!estado || guardando}>
          <legend className="estudio-ficha__titulo">Tipo de estudio</legend>
          <PulsoFieldRow className="estudio-ficha__campos" geometryGroup="estudio/tipo">
            <PulsoField label="Tipo" hint={detalleTipo ?? "Fija el modo en que abren Cálculo de muestra y Monitoreo."}>
              <PulsoSelect
                value={opcion || undefined}
                placeholder="Sin declarar"
                onValueChange={(v) => setOpcion(v as OpcionTipo)}
                options={OPCIONES_TIPO.map((o) => ({ value: o.valor, label: o.rotulo }))}
              />
            </PulsoField>
          </PulsoFieldRow>
          {opcion === "aulas" ? (
            <PulsoSwitch
              checked={conMarco}
              onCheckedChange={setConMarco}
              label={MARCO_DE_ALUMNOS.rotulo}
              description={conMarco ? MARCO_DE_ALUMNOS.con : MARCO_DE_ALUMNOS.sin}
            />
          ) : null}
        </fieldset>
      </div>
    </Dialog>
  );
}
