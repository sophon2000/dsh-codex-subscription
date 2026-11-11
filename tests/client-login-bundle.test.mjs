import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('login client keeps UI-only dependencies inside its published bundle', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(bundle, /require\(["'](?:@heroicons\/react(?:\/[^"']*)?|qrcode(?:\/[^"']*)?)["']\)/u)
})
