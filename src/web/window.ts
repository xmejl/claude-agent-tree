import type { EngineInterface } from 'claude-code'

// Probe executables without a shell, so a server URL containing ?t= always
// remains one argument rather than being interpreted as command syntax.
async function succeeds($: EngineInterface, argv: string[]): Promise<boolean> {
  const result = await $.process.run(argv).catch(() => undefined)
  return result?.exitCode === 0
}

// Resolve the available launcher before offering or opening a separate window.
// Browser app mode is preferred; an ordinary default-browser window is the fallback.
export async function windowCommand($: EngineInterface, url: string): Promise<string[] | undefined> {
  if (await succeeds($, ['cmd', '/c', 'ver'])) {
    // Windows resolves Edge by app paths, not necessarily the process PATH.
    return ['cmd', '/c', 'start', '', 'msedge', `--app=${url}`]
  }

  if (await succeeds($, ['sw_vers', '-productName'])) {
    for (const app of ['Google Chrome', 'Chromium', 'Microsoft Edge']) {
      if (await succeeds($, ['open', '-Ra', app])) {
        return ['open', '-a', app, '--args', `--app=${url}`]
      }
    }
    return (await succeeds($, ['which', 'open'])) ? ['open', url] : undefined
  }

  for (const browser of ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    if (await succeeds($, ['which', browser])) return [browser, `--app=${url}`]
  }
  return (await succeeds($, ['which', 'xdg-open'])) ? ['xdg-open', url] : undefined
}

// Function declarations are needed for the engine's cross-file `$` scan.
export async function canOpenWindow($: EngineInterface): Promise<boolean> {
  return Boolean(await windowCommand($, 'http://127.0.0.1/'))
}

export async function openWindow($: EngineInterface, url: string): Promise<boolean> {
  const argv = await windowCommand($, url)
  if (!argv) return false
  const result = await $.process.run(argv).catch(() => undefined)
  return result?.exitCode === 0
}
