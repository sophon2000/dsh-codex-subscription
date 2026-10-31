import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const owner = 'https://github.com/sophon2000/dsh-codex-subscription'
const component = '@deepseek-ai/dsh-subagent-codex'
const corePeers = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-llm', '@deepseek-ai/schemastery']
const desktopOmissions = ['lib/types/index.d.ts', 'lib/types/run.d.ts', 'lib/types/wire.d.ts']
const json = path => JSON.parse(readFileSync(path, 'utf8'))

/** Resolve metadata without relying on a package.json export. */
export function installedManifest(name, anchor) {
  for (const directory of createRequire(anchor).resolve.paths(name) ?? []) {
    const path = join(directory, name, 'package.json')
    if (!existsSync(path)) continue
    assert.equal(json(path).name, name, `Unexpected package identity: ${name}`)
    return realpathSync(path)
  }
  throw Object.assign(new Error(`Missing installed host package: ${name}`), { code: 'MODULE_NOT_FOUND' })
}

export function readRuntimeBinding(directory) {
  // A malformed packed binding must never fall back to source configuration.
  const path = ['host-package.json', 'host-artifact.json'].map(name => join(directory, name)).find(existsSync)
  return path ? json(path) : undefined
}

export function validateRuntimeBinding(binding, expected) {
  assert.equal(binding?.schemaVersion, 1)
  assert.equal(binding.repository, owner)
  assert.match(binding.version, /^\d+\.\d+\.\d+-vh\.\d+$/u)
  const runtime = binding.subagentRuntime
  assert.equal(runtime?.version, binding.hostVersion, 'Component must match the exact reviewed Host')
  assert.match(runtime.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/u)
  assert.ok(Object.keys(runtime.files).length > 0)
  assert.ok(runtime.files['package.json'])
  for (const files of [runtime.files, runtime.desktopFiles]) {
    for (const [name, hash] of Object.entries(files)) {
      assert.ok(name && !name.startsWith('/') && !name.includes('\\') && !name.split('/').some(part => !part || part === '.' || part === '..' || part === 'node_modules'), 'Unsafe component file')
      assert.match(hash, /^[a-f0-9]{64}$/u)
    }
  }
  assert.ok(desktopOmissions.every(name => runtime.files[name]))
  assert.deepEqual(runtime.desktopFiles, Object.fromEntries(Object.entries(runtime.files).filter(([name]) => !desktopOmissions.includes(name))),
    'Desktop projection may omit only the three reviewed declarations')
  assert.match(runtime.desktopSdkSha256, /^[a-f0-9]{64}$/u)
  assert.ok(corePeers.every(name => runtime.dependencies[name]))
  for (const [name, version] of Object.entries(runtime.dependencies)) {
    assert.match(name, /^@deepseek-ai\/[a-z0-9-]+$/u)
    assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u, 'Bound dependency must have an exact version')
  }
  if (expected) {
    assert.equal(binding.hostVersion, expected.hostVersion)
    assert.equal(binding.version, expected.version)
    assert.deepEqual(runtime, expected.subagentRuntime, 'Component binding differs from the reviewed build input')
  }
  return runtime
}

/** The reviewed tarball SRI is bound to this exact unpacked file closure. */
export function verifyRuntimeFiles(binding, manifest) {
  const runtime = validateRuntimeBinding(binding)
  const pkg = json(manifest)
  assert.equal(pkg.name, component)
  assert.equal(pkg.version, runtime.version)
  const root = dirname(manifest), actual = {}
  function visit(directory, prefix = '') {
    for (const name of readdirSync(directory)) {
      // Nested package-manager dependencies have their own identities below.
      if (name === 'node_modules') {
        assert.equal(prefix, '', 'Nested dependency shadow inside the reviewed component payload')
        continue
      }
      const path = join(directory, name), relative = prefix + name, stat = lstatSync(path)
      assert.ok(!stat.isSymbolicLink(), `Linked component payload: ${relative}`)
      if (stat.isDirectory()) visit(path, `${relative}/`)
      else {
        assert.ok(stat.isFile(), `Non-file component payload: ${relative}`)
        actual[relative] = createHash('sha256').update(readFileSync(path)).digest('hex')
      }
    }
  }
  visit(root)
  assert.ok(isDeepStrictEqual(actual, runtime.files) || isDeepStrictEqual(actual, runtime.desktopFiles),
    'Installed component differs from the reviewed artifact SRI/file closure or exact Desktop projection')
  return pkg
}

/** Reject an equal-version second instance as well as a mixed Host cohort. */
export function verifyRuntimeOwner(binding, hostLlmManifest, componentManifest, { payload = true, pluginManifest, providerEntry } = {}) {
  const runtime = validateRuntimeBinding(binding)
  const host = realpathSync(hostLlmManifest), provider = realpathSync(componentManifest)
  assert.equal(json(host).name, '@deepseek-ai/dsh-llm')
  assert.equal(json(host).version, binding.hostVersion)
  try {
    assert.equal(installedManifest(component, host), provider, 'Duplicate subagent component outside the Host graph')
  } catch (error) {
    // The optional component can be installed by the Manager in a Profile while
    // the core Host lives in an independent installation. Existing Host copies
    // must still agree; absence does not prevent that normal installation path.
    if (error.code !== 'MODULE_NOT_FOUND') throw error
  }
  const pkg = payload ? verifyRuntimeFiles(binding, provider) : json(provider)
  assert.equal(pkg.name, component)
  assert.equal(pkg.version, runtime.version)
  const entry = realpathSync(providerEntry ?? join(dirname(provider), pkg.main))
  const entryFile = relative(dirname(provider), entry).split(sep).join('/')
  assert.ok(runtime.files[entryFile], 'Provider entry must belong to the reviewed component payload')
  const declaredDependencies = Object.fromEntries(Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })
    .filter(([name]) => name.startsWith('@deepseek-ai/')).map(([name, version]) => [name, version.replace(/^[~^]/u, '')]))
  assert.deepEqual(declaredDependencies, runtime.dependencies, 'Component SDK dependency declarations differ from the reviewed binding')
  if (pluginManifest) {
    for (const name of corePeers) {
      assert.equal(installedManifest(name, pluginManifest), installedManifest(name, host), `Duplicate plugin Host runtime: ${name}`)
    }
  }
  for (const [name, expected] of Object.entries(runtime.dependencies)) {
    const componentPath = installedManifest(name, entry)
    assert.equal(json(componentPath).version, expected, `Mixed component Host runtime: ${name}`)
    let hostPath
    try { hostPath = installedManifest(name, host) }
    catch (error) {
      // Optional components can own missing non-core SDK dependencies in their
      // Profile. The exact identity still comes from the reviewed binding.
      if (error.code !== 'MODULE_NOT_FOUND' || corePeers.includes(name)) throw error
    }
    if (hostPath) assert.equal(componentPath, hostPath, `Duplicate component Host runtime: ${name}`)
  }
  assert.equal(runtime.version, pkg.version)
  return true
}
