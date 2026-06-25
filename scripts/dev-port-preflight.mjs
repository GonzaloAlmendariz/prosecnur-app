#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parsePorts() {
  const arg = process.argv.find((item) => item.startsWith("--ports="));
  const raw = arg ? arg.slice("--ports=".length) : "8787,8788,8789";
  return raw
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseLsof(output, port) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const parts = line.trim().split(/\s+/);
    return {
      command: parts[0] || "proceso",
      pid: parts[1] || "",
      user: parts[2] || "",
      port,
    };
  });
}

function parsePs(output) {
  return output
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(\S+)\s+(.+?)\s*$/);
      if (!match) return null;
      return {
        pid: match[1],
        user: match[2],
        command: match[3],
      };
    })
    .filter(Boolean);
}

function parseLsofForPid(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const ports = [];
  for (const line of lines.slice(1)) {
    const match = line.match(/TCP\s+.*:(\d+)\s+\(LISTEN\)/);
    if (match) ports.push(Number(match[1]));
  }
  return [...new Set(ports)].filter((port) => Number.isInteger(port) && port > 0);
}

async function listenersForPort(port) {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-nP",
      `-iTCP:${port}`,
      "-sTCP:LISTEN",
    ], { timeout: 2500 });
    return parseLsof(stdout, port);
  } catch (error) {
    if (error?.code === 1) return [];
    return [{ command: "desconocido", pid: "", user: "", port, error: error.message }];
  }
}

async function listenersForPid(pid) {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-nP",
      "-a",
      "-p",
      String(pid),
      "-iTCP",
      "-sTCP:LISTEN",
    ], { timeout: 2500 });
    return parseLsofForPid(stdout);
  } catch (error) {
    if (error?.code === 1) return [];
    return [];
  }
}

async function prosecnurBackendProcesses() {
  try {
    const { stdout } = await execFileAsync("ps", [
      "-axo",
      "pid=,user=,command=",
    ], { timeout: 2500, maxBuffer: 1024 * 1024 });
    const processes = parsePs(stdout).filter((item) => {
      const command = item.command || "";
      return (
        command.includes("launcher/launch.R") ||
        command.includes("prosecnur-app/launcher/launch.R")
      );
    });
    return Promise.all(processes.map(async (item) => ({
      ...item,
      ports: await listenersForPid(item.pid),
    })));
  } catch (_error) {
    return [];
  }
}

const ports = parsePorts();
const results = (await Promise.all(ports.map(listenersForPort))).flat();
const backendProcesses = await prosecnurBackendProcesses();
const watchedPorts = new Set(ports);
const extraProcesses = backendProcesses.filter((item) => (
  !item.ports.length ||
  item.ports.some((port) => !watchedPorts.has(port))
));

if (!results.length && !extraProcesses.length) {
  console.log(`OK Puertos Prosecnur dev libres (${ports.join(", ")}).`);
  process.exit(0);
}

if (results.length) {
  console.log("Aviso: ya hay una instancia de Prosecnur usando puertos principales.");
  console.log("Electron intentara continuar con un puerto libre cuando corresponda:");
  for (const item of results) {
    const owner = [item.command, item.pid ? `pid ${item.pid}` : "", item.user].filter(Boolean).join(" - ");
    console.log(`  - ${item.port}: ${owner || "proceso detectado"}`);
    if (item.error) console.log(`    detalle: ${item.error}`);
  }
}

if (extraProcesses.length) {
  console.log("Aviso: hay una instancia anterior del motor R en otro puerto.");
  console.log("No bloquea este arranque, pero puede confundir pruebas si quedo abierta:");
  for (const item of extraProcesses) {
    const portText = item.ports.length ? item.ports.join(", ") : "sin puerto visible";
    console.log(`  - pid ${item.pid} - ${item.user} - puertos: ${portText}`);
  }
}
console.log("No se cerro ningun proceso automaticamente.");
