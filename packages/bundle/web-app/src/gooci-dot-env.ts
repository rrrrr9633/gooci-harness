import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Load KEY=VALUE pairs without overriding a real process environment. */
export function loadGoociDotEnv(cwd = process.cwd()): void {
  for (const file of [resolve(cwd, '.env'), resolve(cwd, '..', '.env')]) {
    if (!existsSync(file)) continue
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const split = line.indexOf('=')
      if (split <= 0) continue
      const key = line.slice(0, split).trim()
      if (!key || process.env[key] !== undefined) continue
      const value = unquote(line.slice(split + 1).trim())
      if (!value) continue
      process.env[key] = value
    }
  }
}

function unquote(value: string): string {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1)
  }
  return value
}
