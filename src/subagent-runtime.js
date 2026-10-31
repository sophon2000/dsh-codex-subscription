import { createRequire } from 'node:module'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readRuntimeBinding, validateRuntimeBinding, verifyRuntimeOwner } from '../scripts/runtime-binding.mjs'
import artifact from '../host-artifact.json' with { type: 'json' }

export const SUBAGENT_RUNTIME_PACKAGE = '@deepseek-ai/dsh-subagent-codex'
export const SUBAGENT_RUNTIME_VERSION = '0.2.1-rc.4'
export const SUPPORTED_RUNTIME_VERSIONS = Object.freeze(['0.1.7-rc.2', '0.2.0-rc.1', '0.2.0-rc.2', '0.2.1-alpha.1', '0.2.1-alpha.2', '0.2.1-alpha.3', '0.2.1-alpha.4', '0.2.1-alpha.5', '0.2.1-rc.1', '0.2.1-rc.2', '0.2.1-rc.3', SUBAGENT_RUNTIME_VERSION, '0.2.2-alpha.2'])
const require = createRequire(import.meta.url)
const execute = promisify(execFile)
const pluginManifest = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

/** The DSH release this plugin is loaded into, read from the host's own LLM package. */
// A desktop build bundles DSH next to its host entry, not next to this plugin,
// so prefer the actual host entry over an auto-installed plugin peer copy.
function hostLlmManifest(resolve, entry) {
  const attempts = []
  if (typeof entry === 'string' && entry) attempts.push(() => require.resolve('@deepseek-ai/dsh-llm/package.json', { paths: [dirname(realpathSync(entry))] }))
  attempts.push(() => resolve('@deepseek-ai/dsh-llm/package.json'))
  for (const attempt of attempts) {
    try {
      const path = attempt()
      const { version } = JSON.parse(readFileSync(path, 'utf8'))
      if (typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) return path
    } catch {}
  }
  return undefined
}

export function hostDshVersion(resolve = require.resolve, entry = process.argv[1]) {
  const path = hostLlmManifest(resolve, entry)
  return path ? JSON.parse(readFileSync(path, 'utf8')).version : undefined
}

function binding() {
  const owner = readRuntimeBinding(resolvePath(dirname(fileURLToPath(import.meta.url)), '..'))
  validateRuntimeBinding(owner, artifact)
  return owner
}
function reviewedForkVersion(version) {
  try {
    const owner = binding()
    return validateRuntimeBinding(owner).version === version ? version : undefined
  } catch { return undefined }
}

// The official component declares exact DSH cohort peers. Installing the
// newest component into an older host can appear to succeed but fail at load.
export function matchingSubagentRuntimeVersion(resolve = require.resolve) {
  const version = hostDshVersion(resolve, resolve === require.resolve ? process.argv[1] : '')
  return SUPPORTED_RUNTIME_VERSIONS.includes(version) ? version : reviewedForkVersion(version)
}

// Resolve from this plugin's dependency graph, then use the provider's own
// protocol and CLI. Never search PATH or a desktop application's private files.
export function inspectSubagentRuntime(resolve = require.resolve) {
  try {
    const manifestPath = resolve(`${SUBAGENT_RUNTIME_PACKAGE}/package.json`)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.version !== matchingSubagentRuntimeVersion(resolve)) return { installed: false, present: true }
    if (!SUPPORTED_RUNTIME_VERSIONS.includes(manifest.version)) {
      try {
        // Status checks inspect identities and singleton paths only. Admission
        // and explicit preparation/load verify the reviewed payload closure.
        verifyRuntimeOwner(binding(), hostLlmManifest(resolve, resolve === require.resolve ? process.argv[1] : ''), manifestPath, { payload: false, pluginManifest, providerEntry: resolve(SUBAGENT_RUNTIME_PACKAGE) })
      } catch { return { installed: false, present: true } }
    }
    return { installed: true }
  } catch { return { installed: false } }
}

export async function loadSubagentRuntime({ resolve = require.resolve, run = execute, importModule = url => import(url) } = {}) {
  if (!inspectSubagentRuntime(resolve).installed) throw new Error('Codex subtask runtime is not prepared')
  if (reviewedForkVersion(matchingSubagentRuntimeVersion(resolve))) {
    verifyRuntimeOwner(binding(), hostLlmManifest(resolve, resolve === require.resolve ? process.argv[1] : ''), resolve(`${SUBAGENT_RUNTIME_PACKAGE}/package.json`), { pluginManifest, providerEntry: resolve(SUBAGENT_RUNTIME_PACKAGE) })
  }
  const entry = resolve(SUBAGENT_RUNTIME_PACKAGE)
  const providerRequire = createRequire(entry)
  const codexManifestPath = providerRequire.resolve('@openai/codex/package.json')
  const codex = JSON.parse(readFileSync(codexManifestPath, 'utf8'))
  if (codex.version !== '0.153.4' || typeof codex.bin?.codex !== 'string') throw new Error('Codex subtask runtime version is unsupported')
  const wrapper = resolvePath(dirname(codexManifestPath), codex.bin.codex)
  try {
    const { stdout } = await run(process.execPath, [wrapper, '--version'], { timeout: 10000, maxBuffer: 4096, windowsHide: true })
    if (stdout.trim() !== 'codex-cli 0.153.4') throw new Error('Unexpected CLI version')
  } catch { throw new Error('Codex subtask runtime is incomplete; prepare it for this platform') }
  const [official, { JsonRpcLineTransport: Transport }] = await Promise.all([
    importModule(pathToFileURL(entry).href),
    importModule(pathToFileURL(providerRequire.resolve('@deepseek-ai/dsh-sdk-protocol')).href),
  ])
  return { official, Transport }
}
