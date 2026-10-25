import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigError, expandTilde, loadConfig } from '../src/main/core/config'

const dirs: string[] = []

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'arborist-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs.length = 0
})

describe('loadConfig', () => {
  it('配置不存在时写模板并返回默认值', () => {
    const dir = tmp()
    const cfg = loadConfig(join(dir, 'config.toml'))
    expect(cfg.pollIntervalMs).toBe(10000)
    expect(cfg.roots).toEqual([join(homedir(), 'Code')])
    expect(readFileSync(join(dir, 'config.toml'), 'utf8')).toContain('roots')
  })

  it('解析合法配置并展开 ~', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'config.toml'), 'roots = ["~/Game", "/abs"]\npoll_interval_ms = 5000\n')
    const cfg = loadConfig(join(dir, 'config.toml'))
    expect(cfg.roots).toEqual([join(homedir(), 'Game'), '/abs'])
    expect(cfg.pollIntervalMs).toBe(5000)
  })

  it('坏 TOML 抛 ConfigError', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'config.toml'), 'roots = [')
    expect(() => loadConfig(join(dir, 'config.toml'))).toThrow(ConfigError)
    expect(() => loadConfig(join(dir, 'config.toml'))).toThrow(/解析失败/)
  })

  it('roots 非字符串数组抛 ConfigError', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'config.toml'), 'roots = "not-an-array"\n')
    expect(() => loadConfig(join(dir, 'config.toml'))).toThrow(/roots/)
  })

  it('poll_interval_ms 过小抛 ConfigError', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'config.toml'), 'roots = []\npoll_interval_ms = 100\n')
    expect(() => loadConfig(join(dir, 'config.toml'))).toThrow(/poll_interval_ms/)
  })
})

describe('expandTilde', () => {
  it('三种形式', () => {
    expect(expandTilde('~')).toBe(homedir())
    expect(expandTilde('~/Code')).toBe(join(homedir(), 'Code'))
    expect(expandTilde('/absolute')).toBe('/absolute')
  })
})
