import { describe, expect, it } from 'vitest'
import { deploymentAssetPath, normalizeDeploymentBase } from './basePath'

describe('GitHub Pages deployment base', () => {
  it('uses the site root for local development by default', () => {
    expect(normalizeDeploymentBase()).toBe('/')
  })

  it('normalizes a repository name to a leading and trailing slash', () => {
    expect(normalizeDeploymentBase('doupo-reader')).toBe('/doupo-reader/')
  })

  it('preserves an already normalized repository base', () => {
    expect(normalizeDeploymentBase('/doupo-reader/')).toBe('/doupo-reader/')
  })

  it('collapses duplicate slashes', () => {
    expect(normalizeDeploymentBase('//owner//reader//')).toBe('/owner/reader/')
  })

  it('rejects URLs and Windows paths', () => {
    expect(() => normalizeDeploymentBase('https://example.com/repo/')).toThrow()
    expect(() => normalizeDeploymentBase('C:\\repo')).toThrow()
  })

  it('creates manifest icon paths inside the same repository scope', () => {
    expect(deploymentAssetPath('/doupo-reader/', '/icon-192.png')).toBe('/doupo-reader/icon-192.png')
  })
})
