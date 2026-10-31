import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { inspectSubagentRuntime, loadSubagentRuntime, matchingSubagentRuntimeVersion } from '../src/subagent-runtime.js'
import { validateRuntimeBinding, verifyRuntimeFiles, verifyRuntimeOwner } from '../scripts/runtime-binding.mjs'

const require = createRequire(import.meta.url)
const config = JSON.parse(readFileSync(new URL('../host-artifact.json', import.meta.url)))
const name = '@deepseek-ai/dsh-subagent-codex'
const manifest = require.resolve(`${name}/package.json`)

test('the installed reviewed fork component loads its own protocol and CLI version without a model request', async () => {
  assert.equal(matchingSubagentRuntimeVersion(), config.hostVersion)
  assert.deepEqual(inspectSubagentRuntime(), { installed: true })
  const runtime = await loadSubagentRuntime()
  assert.equal(typeof runtime.official.apply, 'function')
  assert.equal(typeof runtime.Transport, 'function')
})

test('an unfamiliar fork suffix and a mismatched component cohort remain unavailable', async t => {
  const root = mkdtempSync(join(tmpdir(), 'codex-fork-cohort-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const host = join(root, 'host.json'), provider = join(root, 'provider.json')
  const resolve = specifier => specifier === '@deepseek-ai/dsh-llm/package.json' ? host
    : specifier === `${name}/package.json` ? provider : require.resolve(specifier)
  for (const version of ['9.9.9', config.hostVersion.replace('.vh.1.', '.vh.2.')]) {
    writeFileSync(host, JSON.stringify({ name: '@deepseek-ai/dsh-llm', version }))
    writeFileSync(provider, JSON.stringify({ name, version }))
    assert.equal(matchingSubagentRuntimeVersion(resolve), undefined)
    assert.deepEqual(inspectSubagentRuntime(resolve), { installed: false, present: true })
  }
  writeFileSync(host, JSON.stringify({ name: '@deepseek-ai/dsh-llm', version: config.hostVersion }))
  writeFileSync(provider, JSON.stringify({ name, version: '0.2.2-alpha.2' }))
  assert.deepEqual(inspectSubagentRuntime(resolve), { installed: false, present: true })
  await assert.rejects(loadSubagentRuntime({ resolve, run: () => assert.fail(), importModule: () => assert.fail() }), /not prepared/)
})

test('equal-version second instances and changed reviewed payload bytes fail closed', async t => {
  const root = mkdtempSync(join(tmpdir(), 'codex-fork-copy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const copy = join(root, 'component')
  cpSync(dirname(manifest), copy, { recursive: true })
  const copiedManifest = join(copy, 'package.json')
  const resolve = specifier => specifier === `${name}/package.json` ? copiedManifest : require.resolve(specifier)
  verifyRuntimeFiles(config, copiedManifest)
  assert.deepEqual(inspectSubagentRuntime(resolve), { installed: false, present: true })
  await assert.rejects(loadSubagentRuntime({ resolve, run: () => assert.fail(), importModule: () => assert.fail() }), /not prepared/)
  const shadow = join(copy, 'lib/node_modules/@deepseek-ai/dsh-llm')
  mkdirSync(shadow, { recursive: true })
  writeFileSync(join(shadow, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-llm', version: config.hostVersion }))
  assert.throws(() => verifyRuntimeFiles(config, copiedManifest), /Nested dependency shadow/)
  rmSync(join(copy, 'lib/node_modules'), { recursive: true })
  writeFileSync(join(copy, 'lib/index.js'), '// changed payload\n')
  assert.throws(() => verifyRuntimeFiles(config, copiedManifest), /reviewed artifact/)
})

test('owner, exact SRI and file closure are fixed by the reviewed build input', () => {
  validateRuntimeBinding(config, config)
  for (const change of [
    { repository: 'https://github.com/unrelated/plugin' },
    { subagentRuntime: { ...config.subagentRuntime, integrity: `sha512-${'A'.repeat(86)}==` } },
    { subagentRuntime: { ...config.subagentRuntime, files: { 'package.json': '0'.repeat(64) } } },
  ]) assert.throws(() => validateRuntimeBinding({ ...config, ...change }, config))
})

test('a missing optional component stays installable only at the exact approved target', () => {
  const resolve = specifier => {
    if (specifier === `${name}/package.json`) throw new Error('optional component absent')
    return require.resolve(specifier)
  }
  assert.equal(matchingSubagentRuntimeVersion(resolve), config.hostVersion)
  assert.deepEqual(inspectSubagentRuntime(resolve), { installed: false })
})

test('a profile-local equal-version core peer cannot replace the Host singleton', t => {
  const root = mkdtempSync(join(tmpdir(), 'codex-fork-core-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const plugin = join(root, 'package.json')
  writeFileSync(plugin, '{}')
  const core = join(root, 'node_modules/@deepseek-ai/cordis')
  mkdirSync(core, { recursive: true })
  writeFileSync(join(core, 'package.json'), JSON.stringify({ name: '@deepseek-ai/cordis', version: '4.0.6-alpha.1' }))
  assert.throws(() => verifyRuntimeOwner(config, require.resolve('@deepseek-ai/dsh-llm/package.json'), manifest,
    { pluginManifest: plugin, payload: false }), /Duplicate plugin Host runtime/)
})

test('an optional Profile component may share core peers with a separate Host installation', t => {
  const root = mkdtempSync(join(tmpdir(), 'codex-fork-profile-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const hostModules = join(root, 'host/node_modules')
  const profile = join(root, 'profile'), profileModules = join(profile, 'node_modules')
  const provider = join(profileModules, name)
  cpSync(dirname(manifest), provider, { recursive: true })
  const pkg = JSON.parse(readFileSync(manifest))
  const core = { ...pkg.dependencies, ...pkg.peerDependencies }
  for (const [dependency, version] of Object.entries(core)) {
    if (!dependency.startsWith('@deepseek-ai/')) continue
    const target = join(hostModules, dependency)
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: dependency, version: version.replace(/^[~^]/u, '') }))
    mkdirSync(dirname(join(profileModules, dependency)), { recursive: true })
    symlinkSync(target, join(profileModules, dependency), process.platform === 'win32' ? 'junction' : 'dir')
  }
  const plugin = join(profile, 'package.json')
  writeFileSync(plugin, '{}')
  assert.equal(verifyRuntimeOwner(config, join(hostModules, '@deepseek-ai/dsh-llm/package.json'),
    join(provider, 'package.json'), { pluginManifest: plugin }), true)
})
