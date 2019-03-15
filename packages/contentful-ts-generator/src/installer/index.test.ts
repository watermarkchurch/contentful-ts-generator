import test, { before } from 'ava'
import * as fs from 'fs-extra'
import * as path from 'path'

import { Installer } from './index'

const tmpDir = path.join(__dirname, 'tmp/integration')
const templateDir = path.join(__dirname, 'templates')

before(async (t) => {
  await fs.remove(tmpDir)
  await fs.mkdirp(tmpDir)
})

test('installs templates to empty directory', async (t) => {
  const installer = new Installer({
    outputDir: tmpDir,
  })

  await installer.install()

  const templateFiles = ['base.ts', 'index.ts', 'utils.ts']

  await Promise.all(templateFiles.map(async (file) => {
    const fullPath = path.join(tmpDir, file)
    t.true(await fs.pathExists(fullPath), `${fullPath} does not exist`)
  }))
  await Promise.all(templateFiles.map(async (file) => {
    const contents = await fs.readFile(path.join(tmpDir, file))
    const expected = await fs.readFile(path.join(templateDir, file))
    t.deepEqual(contents.toString(), expected.toString(), `${file} does not match expected`)
  }))
})

test('does not overwrite existing files in the directory', async (t) => {
  const installer = new Installer({
    outputDir: tmpDir,
  })

  await fs.writeFile(path.join(tmpDir, 'base.ts'), '// test test test')

  await installer.install()

  const templateFiles = ['base.ts', 'index.ts', 'utils.ts']

  await Promise.all(templateFiles.map(async (file) => {
    const fullPath = path.join(tmpDir, file)
    t.true(await fs.pathExists(fullPath), `${fullPath} does not exist`)
  }))

  const contents = await fs.readFile(path.join(tmpDir, 'base.ts'))
  t.deepEqual(contents.toString(), '// test test test')

})
