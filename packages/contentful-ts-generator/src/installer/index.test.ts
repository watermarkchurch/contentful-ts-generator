import test, { beforeEach, ExecutionContext } from 'ava'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as tmp from 'tmp'
import { promisify } from 'util'

import { Installer } from './index'

const templateDir = path.join(__dirname, 'templates')

beforeEach(async (t) => {
  const tmpDir = await (promisify<string>((cb) => tmp.dir(cb))())

  Object.assign(t.context, { tmpDir })
  await fs.remove(tmpDir)
  await fs.mkdirp(tmpDir)
})

test('installs templates to empty directory', async (t) => {
  const { tmpDir } = (t.context as any)

  const installer = new Installer({
    outputDir: tmpDir,
  })

  await installer.install()

  const templateFiles = ['base.ts', 'index.ts', 'utils.ts', '.gitignore']

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
  const { tmpDir } = (t.context as any)

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

test('does not install any files if index exists', async (t) => {
  const { tmpDir } = (t.context as any)

  const installer = new Installer({
    outputDir: tmpDir,
  })

  await fs.writeFile(path.join(tmpDir, 'index.ts'), '// test test test')

  await installer.install()

  const templateFiles = ['base.ts', 'utils.ts']

  await Promise.all(templateFiles.map(async (file) => {
    const fullPath = path.join(tmpDir, file)
    t.false(await fs.pathExists(fullPath), `${fullPath} should not exist`)
  }))

  const contents = await fs.readFile(path.join(tmpDir, 'index.ts'))
  t.deepEqual(contents.toString(), '// test test test')
})
