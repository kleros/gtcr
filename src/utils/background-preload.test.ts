import { describe, expect, it } from 'vitest'
import {
  loadInBackground,
  onlyBackgroundLoadsPending,
} from './background-preload'

describe('loadInBackground', () => {
  it('counts a load while it runs, and gives its result', async () => {
    let finish: (module: string) => void = () => {}
    const loading = loadInBackground(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    expect(onlyBackgroundLoadsPending()).toBe(true)
    finish('module')
    await expect(loading).resolves.toBe('module')
    expect(onlyBackgroundLoadsPending()).toBe(false)
  })

  it('passes a failure on to its caller, then stops counting it', async () => {
    const failing = loadInBackground(() => Promise.reject(new Error('gone')))
    expect(onlyBackgroundLoadsPending()).toBe(true)
    await expect(failing).rejects.toThrow('gone')
    expect(onlyBackgroundLoadsPending()).toBe(false)
  })
})
