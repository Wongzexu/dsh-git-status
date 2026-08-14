// dsh-git-status client bundle 构建：把 src/client/index.js 包装成官方
// __ModuleLoader__.load 契约（CJS + ModuleLoader 包装，同 greeter 模式）。
// 零依赖：纯 Node 脚本，无需 tsdown/pnpm install。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src', 'client', 'index.js'), 'utf8')
const out = `window.__ModuleLoader__.load({ id: "dsh-git-status", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
${src}
return module.exports; } });
`

mkdirSync(join(root, 'lib'), { recursive: true })
writeFileSync(join(root, 'lib', 'client.js'), out)
console.log(`lib/client.js written (${out.length} bytes, ${out.split('\n').length} lines)`)
