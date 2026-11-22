import { existsSync, readFileSync } from 'node:fs'

/**
 * The variables of a dotenv file: `KEY=value` lines, `#` comments, optional
 * quotes around the value. Missing file: no variables.
 */
export const readEnvFile = (file) => {
  if (!existsSync(file)) return {}
  const vars = {}
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const at = line.indexOf('=')
    if (at < 1) continue
    const key = line.slice(0, at).trim()
    let value = line.slice(at + 1).trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    vars[key] = value
  }
  return vars
}
