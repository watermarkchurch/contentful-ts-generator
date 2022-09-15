import * as fs from 'fs-extra'
import * as path from 'path'
import * as tmp from 'tmp'
import { promisify } from 'util'

import { Installer } from './index'

const templateDir = path.join(__dirname, 'templates')

describe('installer', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await (promisify<string>((cb) => tmp.dir(cb))())

    await fs.remove(tmpDir)
    await fs.mkdirp(tmpDir)
  })

  it('installs templates to empty directory', async () => {
    

    const installer = new Installer({
      outputDir: tmpDir,
    })

    await installer.install()

    const templateFiles = ['base.ts', 'index.ts', 'utils.ts', '.gitignore']

    await Promise.all(templateFiles.map(async (file) => {
      const fullPath = path.join(tmpDir, file)
      expect(await fs.pathExists(fullPath)).toBeTruthy()
    }))
    await Promise.all(templateFiles.map(async (file) => {
      const contents = await fs.readFile(path.join(tmpDir, file))
      const expected = await fs.readFile(path.join(templateDir, file))
      expect(contents.toString()).toEqual(expected.toString())
    }))
  })

  it('does not overwrite existing files in the directory', async () => {
    

    const installer = new Installer({
      outputDir: tmpDir,
    })

    await fs.writeFile(path.join(tmpDir, 'base.ts'), '// test test test')

    await installer.install()

    const templateFiles = ['base.ts', 'index.ts', 'utils.ts']

    await Promise.all(templateFiles.map(async (file) => {
      const fullPath = path.join(tmpDir, file)
      expect(await fs.pathExists(fullPath)).toBeTruthy()
    }))

    const contents = await fs.readFile(path.join(tmpDir, 'base.ts'))
    expect(contents.toString()).toEqual('// test test test')

  })

  it('does not install any files if index exists', async () => {
    

    const installer = new Installer({
      outputDir: tmpDir,
    })

    await fs.writeFile(path.join(tmpDir, 'index.ts'), '// test test test')

    await installer.install()

    const templateFiles = ['base.ts', 'utils.ts']

    await Promise.all(templateFiles.map(async (file) => {
      const fullPath = path.join(tmpDir, file)
      expect(await fs.pathExists(fullPath)).toBeFalsy()
    }))

    const contents = await fs.readFile(path.join(tmpDir, 'index.ts'))
    expect(contents.toString()).toEqual('// test test test')
  })

})