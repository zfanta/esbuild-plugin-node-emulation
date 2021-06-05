import type { Plugin, Loader, PluginBuild } from 'esbuild'
import { extname, resolve } from 'path'
import { readFile } from 'fs/promises'
import { platform } from 'os'
import { getInstalledPath } from 'get-installed-path'

const polyfills: { [key: string]: string } = {
  assert: 'assert',
  buffer: 'buffer',
  console: 'console-browserify',
  constants: 'constants-browserify',
  crypto: 'crypto-browserify',
  domain: 'domain-browser',
  events: 'events',
  http: 'stream-http',
  https: 'https-browserify',
  os: 'os-browserify', // 'os-browserify/browser.js',
  path: 'path-browserify',
  zlib: 'browserify-zlib',
  process: 'process', // 'process/browser.js'
  punycode: 'punycode',
  querystring: 'querystring-es3',
  stream: 'readable-stream',
  string_decoder: 'string_decoder',
  sys: 'util', // util/util.js
  timers: 'timers-browserify',
  tty: 'tty-browserify',
  url: 'url',
  util: 'util', // util/util.js
  vm: 'vm-browserify'
}

function injectEnvironmentVariables (build: PluginBuild): void {
  if (build.initialOptions.entryPoints === undefined) throw new Error('entry points is undefined')

  if (build.initialOptions.define === undefined) {
    build.initialOptions.define = {}
  }

  const env: { [key: string]: string } = {}
  for (const key in process.env) {
    // TODO
    if (key.includes('(')) continue
    env[`process.env.${key}`] = JSON.stringify(process.env[key])
  }
  build.initialOptions.define = Object.assign({}, env, build.initialOptions.define)

  let entryPoints: string[] = []
  if (Array.isArray(build.initialOptions.entryPoints)) {
    entryPoints = build.initialOptions.entryPoints
  } else {
    for (const entryPoint in build.initialOptions.entryPoints) {
      entryPoints.push(build.initialOptions.entryPoints[entryPoint])
    }
  }

  entryPoints.forEach(entryPoint => {
    const filter = new RegExp((platform() === 'win32' ? entryPoint.replace(/\//g, '\\\\') : entryPoint) + '$')
    build.onLoad({ filter }, async args => {
      const originContents = (await readFile(args.path)).toString()
      const injectString = 'window.process = require("process");'
      const contents = injectString + originContents
      const loader = extname(args.path).replace(/^\./, '') as Loader
      if (!new Set(['js', 'jsx', 'ts', 'tsx', 'css', 'json', 'text', 'base64', 'file', 'dataurl', 'binary', 'default']).has(loader)) throw new Error(`Loader error, loader: ${loader}`)
      return { contents, loader }
    })
  })
}

function injectPolyfills (build: PluginBuild): void {
  Object.keys(polyfills).forEach(key => {
    const filter = new RegExp(`^(${key})(/.*)?`)
    build.onResolve({ filter }, async args => {
      const matched = filter[Symbol.match](args.path)
      if (matched === null) throw new Error('esbuild-node-emulation error')

      let newPath = ''

      const [, packageName] = matched
      const polyfill = polyfills[packageName]

      const packageDirectory = await getInstalledPath(polyfill, { local: true })
      let packageMain: string | undefined
      if (packageName === 'os' || packageName === 'process') {
        packageMain = 'browser.js'
      } else if (packageName === 'sys' || packageName === 'util') {
        packageMain = 'util.js'
      }

      if (packageMain === undefined) {
        const packageJson = JSON.parse((await readFile(resolve(packageDirectory, 'package.json'))).toString())
        packageMain = packageName === 'console' ? 'index.js' : packageJson.main
      }

      if (packageMain === undefined) {
        packageMain = 'index.js'
      }

      newPath = resolve(packageDirectory, packageMain)

      return {
        path: newPath
      }
    })
  })
}

const nodeEmulation: Plugin = {
  name: 'node-emulation',
  setup (build) {
    if (build.initialOptions.platform !== 'browser') return

    injectEnvironmentVariables(build)
    injectPolyfills(build)
  }
}

export default nodeEmulation
