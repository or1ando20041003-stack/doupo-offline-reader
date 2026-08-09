export function normalizeDeploymentBase(value?: string): string {
  const candidate = value?.trim() || '/'
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate) || candidate.includes('?') || candidate.includes('#') || candidate.includes('\\')) {
    throw new Error(`VITE_BASE_PATH 必须是站点内路径，收到：${candidate}`)
  }
  const withLeadingSlash = candidate.startsWith('/') ? candidate : `/${candidate}`
  const normalized = withLeadingSlash.replace(/\/{2,}/g, '/')
  return normalized === '/' ? '/' : `${normalized.replace(/\/+$/, '')}/`
}

export function deploymentAssetPath(basePath: string, fileName: string): string {
  return `${normalizeDeploymentBase(basePath)}${fileName.replace(/^\/+/, '')}`
}
