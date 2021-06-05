import { build } from 'esbuild'
import nodeEmulation from '../index'

build({
  entryPoints: ['test/input.js'],
  outfile: 'output.js',
  platform: 'browser',
  plugins: [nodeEmulation],
  bundle: true
})
  .then(console.log)
  .catch(console.error)
