import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const windowUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'src', 'web', 'window.ts'))
const choiceUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'src', 'choice.ts'))
const { canOpenWindow, openWindow, windowCommand } = await import(windowUrl)
const { LABEL, optionsFor, parseChoice } = await import(choiceUrl)
const URL = 'http://127.0.0.1:47821/?t=k3y&view=1'

function fake(success, rejects = []) {
  const calls = []
  return {
    calls,
    engine: {
      process: {
        run: async (args) => {
          calls.push(args)
          const key = JSON.stringify(args)
          if (rejects.includes(key)) throw new Error('spawn failed')
          return { exitCode: success.includes(key) ? 0 : 1 }
        },
      },
    },
  }
}
const ok = (...args) => JSON.stringify(args)

test('Windows keeps the existing Edge launcher and a single URL argument', async () => {
  const x = fake([ok('cmd', '/c', 'ver')])
  assert.equal(await canOpenWindow(x.engine), true)
  await openWindow(x.engine, URL)
  assert.deepEqual(x.calls.at(-1), ['cmd', '/c', 'start', '', 'msedge', `--app=${URL}`])
})

test('Linux prefers Chrome app mode without interpreting URL metacharacters', async () => {
  const x = fake([ok('which', 'google-chrome')])
  assert.equal(await canOpenWindow(x.engine), true)
  await openWindow(x.engine, URL)
  assert.deepEqual(x.calls.at(-1), ['google-chrome', `--app=${URL}`])
})

test('Linux uses Chromium when Chrome is unavailable', async () => {
  const x = fake([ok('which', 'chromium')])
  assert.deepEqual(await windowCommand(x.engine, URL), ['chromium', `--app=${URL}`])
})

test('Linux falls back to the default browser', async () => {
  const x = fake([ok('which', 'xdg-open')])
  await openWindow(x.engine, URL)
  assert.deepEqual(x.calls.at(-1), ['xdg-open', URL])
})

test('Linux without a launcher hides the option and never opens a URL', async () => {
  const x = fake([])
  assert.equal(await canOpenWindow(x.engine), false)
  await openWindow(x.engine, URL)
  assert.ok(x.calls.every(args => !args.includes(URL) && !args.includes(`--app=${URL}`)))
})

test('macOS opens Chrome in app mode with URL as one argument', async () => {
  const x = fake([ok('sw_vers', '-productName'), ok('open', '-Ra', 'Google Chrome')])
  await openWindow(x.engine, URL)
  assert.deepEqual(x.calls.at(-1), ['open', '-a', 'Google Chrome', '--args', `--app=${URL}`])
})

test('macOS falls back to its default browser', async () => {
  const x = fake([ok('sw_vers', '-productName'), ok('which', 'open')])
  await openWindow(x.engine, URL)
  assert.deepEqual(x.calls.at(-1), ['open', URL])
})

test('macOS without a default browser hides the window option', async () => {
  const x = fake([ok('sw_vers', '-productName')])
  assert.equal(await canOpenWindow(x.engine), false)
})

test('launcher rejection is contained', async () => {
  const x = fake([ok('which', 'chromium')], [ok('chromium', `--app=${URL}`)])
  await assert.doesNotReject(openWindow(x.engine, URL))
  assert.deepEqual(x.calls.at(-1), ['chromium', `--app=${URL}`])
})

test('the choice label is platform-neutral and legacy Edge choices still parse', () => {
  assert.equal(LABEL.window, 'Browser window')
  assert.deepEqual(optionsFor(false), ['Agents pane', 'Web page'])
  assert.deepEqual(optionsFor(true), ['Agents pane', 'Web page', 'Browser window'])
  assert.deepEqual(parseChoice('Agents pane, Browser window'), { pane: true, web: false, window: true })
  assert.deepEqual(parseChoice('Agents pane, Edge window'), { pane: true, web: false, window: true })
  assert.deepEqual(parseChoice('bad choice'), { pane: true, web: false, window: false })
})
