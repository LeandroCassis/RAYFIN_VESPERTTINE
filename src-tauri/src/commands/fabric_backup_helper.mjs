// Short-lived helper used by the desktop app. Authentication stays inside this
// process: only inventory/backup results are emitted to stdout.
console.log = (...args) => process.stderr.write(args.map(String).join(' ') + '\n')
console.debug = console.log
console.info = console.log

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const API_HOST = 'https://api.fabric.microsoft.com'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function safeName(value, fallback = 'unnamed') {
  const clean = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  return (clean || fallback).slice(0, 160)
}

function safePartPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '..' || part === '.')) return null
  return parts.map((part) => safeName(part, 'part')).join(path.sep)
}

function timestamp() {
  const now = new Date()
  const pad = (v) => String(v).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8')
}

async function request(url, options = {}, allow = []) {
  let last
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok || allow.includes(response.status)) return response
      if (![429, 502, 503, 504].includes(response.status)) return response
      last = response
      const retry = Number(response.headers.get('retry-after') || 0)
      await sleep(retry > 0 ? retry * 1000 : Math.min(1000 * 2 ** attempt, 12000))
    } catch (error) {
      last = error
      await sleep(Math.min(1000 * 2 ** attempt, 12000))
    }
  }
  if (last instanceof Response) return last
  throw last || new Error('Fabric request failed')
}

async function bodyText(response) {
  const text = await response.text()
  if (!text) return ''
  try {
    const json = JSON.parse(text)
    return json?.error?.message || json?.message || text
  } catch {
    return text
  }
}

async function fetchAllPages(startUrl, headers) {
  const items = []
  const seen = new Set()
  let url = startUrl
  for (let page = 0; page < 500 && url; page++) {
    if (seen.has(url)) break
    seen.add(url)
    const response = await request(url, { headers })
    if (!response.ok) throw new Error(`Fabric inventory failed (${response.status}): ${await bodyText(response)}`)
    const json = await response.json()
    items.push(...(json.value || []))
    if (json.continuationUri) {
      url = json.continuationUri.startsWith('http') ? json.continuationUri : API_HOST + json.continuationUri
    } else if (json.continuationToken) {
      const separator = startUrl.includes('?') ? '&' : '?'
      url = `${startUrl}${separator}continuationToken=${encodeURIComponent(json.continuationToken)}`
    } else {
      url = null
    }
  }
  return items
}

const preferredFormats = {
  SemanticModel: 'TMDL',
  Report: 'PBIR',
  Notebook: 'FabricGitSource',
  PaginatedReport: 'PaginatedReportDefinition',
  SparkJobDefinition: 'SparkJobDefinitionV2'
}

async function readLro(response, headers) {
  if (response.status !== 202) return response.json()
  const location = response.headers.get('location')
  if (!location) throw new Error('Fabric accepted the export but did not return an operation location.')
  const operationUrl = location.startsWith('http') ? location : API_HOST + location
  for (let attempt = 0; attempt < 180; attempt++) {
    const poll = await request(operationUrl, { headers })
    if (!poll.ok) throw new Error(`Fabric export operation failed (${poll.status}): ${await bodyText(poll)}`)
    const state = await poll.json()
    const status = String(state.status || '').toLowerCase()
    if (status === 'failed' || status === 'cancelled') {
      throw new Error(state.error?.message || `Fabric export ${status}.`)
    }
    if (status === 'succeeded') {
      const resultUrl = state.resultUrl || `${operationUrl}/result`
      const result = await request(resultUrl, { headers })
      if (!result.ok) throw new Error(`Fabric export result failed (${result.status}): ${await bodyText(result)}`)
      return result.json()
    }
    const retry = Number(poll.headers.get('retry-after') || response.headers.get('retry-after') || 2)
    await sleep(Math.max(1, retry) * 1000)
  }
  throw new Error('Fabric export timed out.')
}

async function getDefinition(base, headers, workspaceId, item) {
  const url = `${base}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(item.id)}/getDefinition`
  const preferred = preferredFormats[item.type]
  const bodies = preferred ? [{ format: preferred }, {}] : [{}]
  let lastMessage = ''
  let lastStatus = 0
  for (const body of bodies) {
    const response = await request(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, [400, 404, 405, 409])
    lastStatus = response.status
    if (response.ok) return readLro(response, headers)
    lastMessage = await bodyText(response)
    if (response.status !== 400) break
  }
  const error = new Error(lastMessage || `Definition export is not supported for ${item.type}.`)
  error.status = lastStatus
  throw error
}

function decodePayload(part) {
  if (part.payloadType === 'InlineBase64' || part.payloadType === undefined) {
    return Buffer.from(String(part.payload || ''), 'base64')
  }
  return Buffer.from(String(part.payload || ''), 'utf8')
}

async function saveDefinition(folder, definition) {
  await writeJson(path.join(folder, 'definition.json'), definition)
  const parts = definition?.definition?.parts || definition?.parts || []
  let saved = 0
  for (const part of parts) {
    const relative = safePartPath(part.path)
    if (!relative) continue
    const target = path.join(folder, 'definition', relative)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, decodePayload(part))
    saved++
  }
  return saved
}

async function inventory(base, headers, workspaceId) {
  const items = await fetchAllPages(`${base}/workspaces/${encodeURIComponent(workspaceId)}/items`, headers)
  return items.map((item) => ({
    id: item.id,
    displayName: item.displayName || item.name || item.id,
    type: item.type || 'Unknown',
    workspaceId,
    description: item.description,
    folderId: item.folderId
  })).sort((a, b) => a.type.localeCompare(b.type) || a.displayName.localeCompare(b.displayName))
}

async function backup(base, headers, config) {
  const backupRoot = path.join(path.resolve(config.outputRoot), timestamp())
  await fs.mkdir(backupRoot, { recursive: true })
  const results = []
  let itemCount = 0
  for (const workspace of config.workspaces || []) {
    const workspaceFolder = path.join(backupRoot, safeName(workspace.displayName, workspace.id))
    await fs.mkdir(workspaceFolder, { recursive: true })
    await writeJson(path.join(workspaceFolder, 'workspace.json'), workspace)
    process.stderr.write(`Workspace: ${workspace.displayName}\n`)
    try {
      const items = await inventory(base, headers, workspace.id)
      itemCount += items.length
      await writeJson(path.join(workspaceFolder, 'items.json'), items)
      for (const item of items) {
        const itemFolder = path.join(workspaceFolder, safeName(item.type), safeName(item.displayName, item.id))
        await fs.mkdir(itemFolder, { recursive: true })
        await writeJson(path.join(itemFolder, 'item.json'), item)
        process.stderr.write(`  ${item.type}: ${item.displayName}\n`)
        try {
          const definition = await getDefinition(base, headers, workspace.id, item)
          const saved = await saveDefinition(itemFolder, definition)
          results.push({
            workspaceId: workspace.id,
            itemId: item.id,
            displayName: item.displayName,
            type: item.type,
            status: saved > 0 ? 'definition' : 'metadata-only',
            path: itemFolder,
            error: saved > 0 ? undefined : 'Fabric returned no definition parts; metadata was preserved.'
          })
        } catch (error) {
          const unsupported = [400, 404, 405, 409].includes(Number(error.status || 0))
          results.push({
            workspaceId: workspace.id,
            itemId: item.id,
            displayName: item.displayName,
            type: item.type,
            status: unsupported ? 'metadata-only' : 'failed',
            path: itemFolder,
            error: String(error.message || error)
          })
        }
      }
    } catch (error) {
      results.push({
        workspaceId: workspace.id,
        itemId: '',
        displayName: workspace.displayName,
        type: 'Workspace',
        status: 'failed',
        path: workspaceFolder,
        error: String(error.message || error)
      })
    }
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    formatVersion: 1,
    scope: 'Fabric item definitions and metadata. OneLake/SQL data and semantic-model cached data are not included.',
    workspaces: config.workspaces || [],
    items: results
  }
  await writeJson(path.join(backupRoot, 'backup-manifest.json'), manifest)
  const definitionCount = results.filter((item) => item.status === 'definition').length
  const metadataOnlyCount = results.filter((item) => item.status === 'metadata-only').length
  const failedCount = results.filter((item) => item.status === 'failed').length
  return {
    ok: failedCount === 0,
    path: backupRoot,
    workspaceCount: (config.workspaces || []).length,
    itemCount,
    definitionCount,
    metadataOnlyCount,
    failedCount,
    items: results,
    error: failedCount ? `${failedCount} item or workspace export(s) failed. See backup-manifest.json.` : undefined
  }
}

async function importApp(base, headers, config) {
  const item = {
    id: config.itemId,
    displayName: config.displayName,
    type: config.itemType || 'AppBackend',
    workspaceId: config.workspaceId
  }
  const baseName = `${safeName(config.displayName, 'fabric-app')}-fabric-${String(config.itemId).slice(0, 8)}`
  let target = path.join(path.resolve(config.outputRoot), baseName)
  try {
    await fs.access(target)
    target = `${target}-${timestamp()}`
  } catch {}
  await fs.mkdir(path.join(target, '.fabric-backup'), { recursive: true })
  await writeJson(path.join(target, '.fabric-backup', 'item.json'), item)
  await writeJson(path.join(target, '.fabric-backup', 'workspace.json'), {
    id: config.workspaceId,
    displayName: config.workspaceName
  })
  try {
    const definition = await getDefinition(base, headers, config.workspaceId, item)
    await writeJson(path.join(target, '.fabric-backup', 'definition.json'), definition)
    const parts = definition?.definition?.parts || definition?.parts || []
    for (const part of parts) {
      const relative = safePartPath(part.path)
      if (!relative) continue
      const output = path.join(target, relative)
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, decodePayload(part))
    }
    const hasManifest = await fs.access(path.join(target, 'rayfin', 'rayfin.yml')).then(() => true).catch(() => false)
    const hasPackage = await fs.access(path.join(target, 'package.json')).then(() => true).catch(() => false)
    const recoverable = hasManifest && hasPackage
    return {
      ok: recoverable,
      path: target,
      recoverable,
      error: recoverable
        ? undefined
        : 'Fabric returned a definition, but it did not contain a complete Rayfin source project (package.json and rayfin/rayfin.yml). The exported definition was preserved for inspection.'
    }
  } catch (error) {
    return {
      ok: false,
      path: target,
      recoverable: false,
      error: `Fabric does not expose a recoverable source definition for this app: ${String(error.message || error)}`
    }
  }
}

async function main() {
  const [authPath, base, configPath] = process.argv.slice(2)
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  const auth = await import(pathToFileURL(authPath).href)
  const rayfin = await auth.getRayfinAuth()
  const { token } = await rayfin.acquireToken(undefined, { silentOnly: true })
  const headers = { Authorization: `Bearer ${token}` }
  let result
  if (config.mode === 'list') {
    result = { ok: true, items: await inventory(base, headers, config.workspaceId) }
  } else if (config.mode === 'backup') {
    result = await backup(base, headers, config)
  } else if (config.mode === 'import') {
    result = await importApp(base, headers, config)
  } else {
    throw new Error(`Unknown Fabric backup mode: ${config.mode}`)
  }
  process.stdout.write(JSON.stringify(result))
}

main().catch((error) => {
  const message = String(error?.message || error)
  const needsLogin = /silent|cached|account|login|token|interactive|sign/i.test(message)
  process.stdout.write(JSON.stringify({ ok: false, needsLogin, recoverable: false, items: [], error: message }))
})
