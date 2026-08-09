import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { normalizeDeploymentBase } from '../src/deployment/basePath'

const projectRoot = resolve(import.meta.dirname, '..')
const outputRoot = join(projectRoot, 'dist')
const expectedBase = normalizeDeploymentBase(process.env.EXPECTED_BASE_PATH ?? process.env.VITE_BASE_PATH)

function fail(message: string): never {
  throw new Error(`部署自检失败：${message}`)
}

function requireFile(relativePath: string): string {
  const filePath = join(outputRoot, relativePath)
  if (!existsSync(filePath) || !statSync(filePath).isFile()) fail(`缺少 dist/${relativePath}`)
  return filePath
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

if (!existsSync(outputRoot)) fail('dist/ 不存在，请先运行 npm run build')

const indexPath = requireFile('index.html')
const manifestPath = requireFile('manifest.webmanifest')
const serviceWorkerPath = requireFile('sw.js')
requireFile('icon-192.png')
requireFile('icon-512.png')
requireFile('maskable-512.png')

const assetsPath = join(outputRoot, 'assets')
if (!existsSync(assetsPath) || walk(assetsPath).length === 0) fail('dist/assets/ 不存在或为空')

const allFiles = walk(outputRoot)
const normalizedFiles = allFiles.map((file) => relative(outputRoot, file).split(sep).join('/'))
const forbiddenExtensions = new Set(['.txt', '.epub', '.mobi', '.azw', '.azw3', '.sqlite', '.sqlite3', '.idb', '.indexeddb', '.dexie'])
const forbiddenNames = ['.local-diagnostics', 'book-analysis.json', 'doupo-qa-report.json', 'reader-qa-report.json']

for (const file of normalizedFiles) {
  const lower = file.toLowerCase()
  const extension = extname(lower)
  if (forbiddenExtensions.has(extension) || extension.startsWith('.azw')) {
    fail(`发现禁止部署的用户数据文件：${file}`)
  }
  if (forbiddenNames.some((name) => lower.includes(name))) fail(`发现本地诊断产物：${file}`)
}

const textExtensions = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.map'])
const windowsPrivatePath = /[a-z]:[\\/](?:users|documents and settings)[\\/][^'"\s)]+/i
for (const filePath of allFiles) {
  if (!textExtensions.has(extname(filePath).toLowerCase())) continue
  const content = readFileSync(filePath, 'utf8')
  if (windowsPrivatePath.test(content)) fail(`发现 Windows 本地绝对路径：${relative(outputRoot, filePath)}`)
  if (/\.local-diagnostics|book-analysis\.json|doupo-qa-report\.json/i.test(content)) {
    fail(`发现本地诊断路径或报告名：${relative(outputRoot, filePath)}`)
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  id?: string
  start_url?: string
  scope?: string
  icons?: Array<{ src?: string }>
}
for (const [field, value] of [['id', manifest.id], ['start_url', manifest.start_url], ['scope', manifest.scope]] as const) {
  if (value !== expectedBase) fail(`manifest ${field} 应为 ${expectedBase}，实际为 ${String(value)}`)
}
if (!manifest.icons || manifest.icons.length < 3) fail('manifest 缺少完整 PWA icons')
for (const icon of manifest.icons) {
  if (!icon.src?.startsWith(expectedBase)) fail(`manifest icon 不在部署 base 内：${String(icon.src)}`)
  const relativeIcon = icon.src.slice(expectedBase.length)
  requireFile(relativeIcon)
}

const indexHtml = readFileSync(indexPath, 'utf8')
const localReferences = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1]!)
  .filter((reference) => !/^(?:https?:|data:|#)/i.test(reference))
for (const reference of localReferences) {
  if (!reference.startsWith(expectedBase)) fail(`index.html 资源未使用 deployment base：${reference}`)
}

const serviceWorker = readFileSync(serviceWorkerPath, 'utf8')
if (!serviceWorker.includes(`${expectedBase}index.html`)) fail('Service Worker 未缓存 repository base 下的 index.html')
if (!/url:["']assets\//.test(serviceWorker)) fail('Service Worker precache 中缺少 assets')
const javascript = allFiles
  .filter((file) => extname(file) === '.js')
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
if (!javascript.includes(`${expectedBase}sw.js`)) fail('客户端没有注册 repository base 下的 sw.js')

console.log(JSON.stringify({
  status: 'pass',
  expectedBase,
  filesChecked: allFiles.length,
  manifest: { id: manifest.id, start_url: manifest.start_url, scope: manifest.scope },
  privacy: { realTxtInDist: false, diagnosticsInDist: false, localWindowsPathInDist: false },
}, null, 2))
