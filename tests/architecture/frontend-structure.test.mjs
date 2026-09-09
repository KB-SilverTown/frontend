import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url))
const testsRoot = fileURLToPath(new URL('../', import.meta.url))
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    return entry.isDirectory() ? collectSourceFiles(entryPath) : [entryPath]
  })
}

test('앱·공통·기능 경계에 필요한 진입점이 존재한다', () => {
  const requiredPaths = [
    'src/app/App.vue',
    'src/app/main.js',
    'src/app/router/routes.js',
    'src/app/styles.css',
    'src/shared/api/client.js',
    'src/shared/lib/navigation.js',
    'src/shared/services/authStorage.js',
    'src/features/onboarding/pages/OnboardingPage.vue',
    'src/features/onboarding/composables/useOnboardingFlow.js',
    'src/features/transfer/pages/TransferHomePage.vue',
    'src/features/voice/routes.js',
    'src/features/bills/routes.js',
    'src/features/living/routes.js',
    'src/features/transfer/routes.js',
  ]

  for (const relativePath of requiredPaths) {
    assert.equal(existsSync(join(projectRoot, relativePath)), true, relativePath)
  }
})

test('구식 루트 파일과 숫자 기반 서비스 라우팅이 남아 있지 않다', () => {
  const stalePaths = [
    'src/App.vue',
    'src/main.js',
    'src/router/routes.js',
    'src/views/ServiceRouteView.vue',
    'src/views/OnboardingView.vue',
    'src/views/TransferHomeView.vue',
    'src/services/productionServiceScreens.js',
    'src/api/client.js',
    'src/shared/stores/counter.js',
  ]

  for (const relativePath of stalePaths) {
    assert.equal(existsSync(join(projectRoot, relativePath)), false, relativePath)
  }

  const numericServiceCondition =
    /(?:screenId|screenKey)(?:\.value)?\s*(?:===|!==)\s*['"][2-5]-\d{2}[A-Z]?['"]/
  const numericRouteParam = /params\s*:\s*\{\s*screenId\s*:/

  for (const filePath of collectSourceFiles(sourceRoot)) {
    const source = readFileSync(filePath, 'utf8')
    assert.doesNotMatch(source, numericServiceCondition, filePath)
    assert.doesNotMatch(source, numericRouteParam, filePath)
  }
})

test('shared는 app과 feature를 역참조하지 않고 feature는 app 구현을 역참조하지 않는다', () => {
  const sharedFiles = collectSourceFiles(join(sourceRoot, 'shared'))
  const featureFiles = collectSourceFiles(join(sourceRoot, 'features'))

  for (const filePath of sharedFiles) {
    const source = readFileSync(filePath, 'utf8')
    assert.doesNotMatch(source, /(?:@\/features|@\/app|\.\.\/features|\.\.\/app)/, filePath)
  }

  for (const filePath of featureFiles) {
    const source = readFileSync(filePath, 'utf8')
    assert.doesNotMatch(source, /@\/app\//, filePath)
  }
})

test('테스트는 기능별 루트에서 재귀적으로 발견되고 공통 소스 helper를 사용한다', () => {
  const runnerSource = readFileSync(join(projectRoot, 'scripts/run-tests.mjs'), 'utf8')
  const guideSource = readFileSync(join(projectRoot, 'docs/frontend-architecture.md'), 'utf8')
  assert.match(runnerSource, /testsDirectory/)
  assert.match(runnerSource, /collectTestFiles\(/)
  assert.match(runnerSource, /entry\.isDirectory\(\)/)
  assert.match(guideSource, /tests\/\*\*\/\*\.test\.mjs/)
  assert.doesNotMatch(guideSource, /tests\/\*\*\/_\*\.test\.mjs/)

  for (const directory of ['app', 'architecture', 'features', 'helpers', 'shared']) {
    assert.equal(existsSync(join(testsRoot, directory)), true, `tests/${directory}`)
  }

  const helperSource = readFileSync(join(testsRoot, 'helpers/source.js'), 'utf8')
  assert.match(helperSource, /createSourceReader/)
})

test('화면 파일은 단일 mega-file 한계를 넘지 않는다', () => {
  const screenFiles = collectSourceFiles(sourceRoot).filter((filePath) =>
    /\.(?:vue|js)$/.test(filePath),
  )

  for (const filePath of screenFiles) {
    const lineCount = readFileSync(filePath, 'utf8').split(/\r?\n/).length
    assert.ok(lineCount <= 2000, `${filePath} has ${lineCount} lines`)
  }
})
