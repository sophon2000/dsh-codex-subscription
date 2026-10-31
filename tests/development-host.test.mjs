import assert from 'node:assert/strict'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { hostDshVersion } from '../src/subagent-runtime.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const json = path => JSON.parse(readFileSync(path, 'utf8'))
const host = json(join(root, 'dev-host.json'))
const manifest = json(join(root, 'package.json'))
const store = realpathSync(join(root, 'node_modules/.pnpm'))
function packagePath(name, resolver = require) {
  // Read metadata through the same module search paths without requiring a
  // package.json export or a CommonJS entry (pi-ai is import-only).
  for (const directory of resolver.resolve.paths(name) ?? []) {
    const path = join(directory, name, 'package.json')
    if (existsSync(path)) return path
  }
  throw new Error(`Cannot locate installed package ${name}`)
}
const insideStore = path => {
  const location = relative(store, realpathSync(path))
  assert.ok(location && !location.startsWith(`..${sep}`) && location !== '..', path)
}

test('default source tests resolve the reviewed installed development Host', () => {
  assert.equal(host.dshVersion, '0.2.2-alpha.2.vh.1.local.20261031.1')
  assert.equal(host.source.commit, '3400c4a11043fbd0ab486561edc23d6309f41463')
  assert.equal(host.manifestSha256, '74194986c3bb60fa62e7819772512c9cfd62203da9f224b46fb9e0b5e64b7c58')
  assert.equal(Object.keys(host.vendors).length, 9)
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    if (!name.startsWith('@deepseek-ai/')) continue
    const expected = name.startsWith('@deepseek-ai/dsh-') ? host.dshVersion : host.vendors[name]
    assert.equal(version, expected, name)
    const path = packagePath(name)
    insideStore(path)
    assert.equal(json(path).version, expected, name)
  }
  assert.equal(hostDshVersion(), host.dshVersion)
  const piAi = packagePath('@earendil-works/pi-ai')
  insideStore(piAi)
  assert.equal(json(piAi).version, host.piAiVersion)
  assert.equal(host.piAiVersion, '1.3.0')
})

test('the installed transitive SDK graph contains one reviewed family', () => {
  const checked = new Set()
  const pending = [join(root, 'package.json')]
  while (pending.length) {
    const path = realpathSync(pending.pop())
    if (checked.has(path)) continue
    checked.add(path)
    const pkg = json(path)
    if (pkg.name.startsWith('@deepseek-ai/')) {
      insideStore(path)
      const expected = pkg.name.startsWith('@deepseek-ai/dsh') ? host.dshVersion
        : host.vendors[pkg.name] ?? (pkg.name.startsWith('@deepseek-ai/node-addon-system') ? '0.1.2' : undefined)
      assert.ok(expected, `unexpected SDK package ${pkg.name}`)
      assert.equal(pkg.version, expected, pkg.name)
    }
    const resolver = createRequire(path)
    for (const name of Object.keys({ ...(path === join(root, 'package.json') ? pkg.devDependencies : {}), ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) {
      if (!name.startsWith('@deepseek-ai/')) continue
      try { pending.push(packagePath(name, resolver)) }
      catch (error) {
        if (!pkg.optionalDependencies?.[name] && !pkg.peerDependenciesMeta?.[name]?.optional) throw error
      }
    }
  }
  assert.ok(checked.size > 25, 'exercise transitive SDK dependencies beyond the direct dev pins')
})
