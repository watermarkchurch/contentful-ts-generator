import test, { before } from 'ava'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as tmp from 'tmp'
import Project from 'ts-morph'
import { promisify } from 'util'

import { ContentfulTSGenerator } from './index'
import { Installer } from './installer'

before(async (t) => {
  const tmpDir = await (promisify<string>((cb) => tmp.dir(cb))())
  await fs.remove(tmpDir)
  await fs.mkdirp(tmpDir)

  Object.assign(t.context, { tmpDir })

  const installer = new Installer({
    outputDir: tmpDir,
  })

  const generator = new ContentfulTSGenerator({
    outputDir: path.join(tmpDir, 'generated'),
    schemaFile: path.join(__dirname, 'fixtures/contentful-schema.json'),
  })
  await Promise.all([
    installer.install(),
    generator.generate(),
  ])
})

test('generates menu.ts', async (t) => {
  const { tmpDir } = (t.context as any)
  const menuPath = path.join(tmpDir, 'generated/menu.ts')

  const project = new Project()
  const menuFile = project.addExistingSourceFile(menuPath)

  t.true(menuFile.getClasses().length == 1)
  t.deepEqual(menuFile.getClasses()[0].getName(), 'Menu')
})

test('Menu can be instantiated from raw entry', async (t) => {
  const { tmpDir } = (t.context as any)
  const menuPath = path.join(tmpDir, 'generated/menu.ts')

  const { Menu } = require(menuPath)

  const menu = new Menu({
    sys: { id: 'test' },
    fields: {
      name: 'test name',
      items: [
        {
          sys: {
            type: 'Link',
            id: 'test button',
            linkType: 'Entry',
          },
        },
      ],
    },
  })

  t.deepEqual(menu.name, 'test name')
  t.deepEqual(menu.items, [null])
  t.deepEqual(menu.sys, { id: 'test' })
  t.deepEqual(menu.fields.name, 'test name')
})

test('Menu resolves links', async (t) => {
  const { tmpDir } = (t.context as any)
  const menuPath = path.join(tmpDir, 'generated/menu.ts')
  const buttonPath = path.join(tmpDir, 'generated/menu_button.ts')

  const { Menu } = require(menuPath)
  const { MenuButton } = require(buttonPath)

  const menu = new Menu({
    sys: { id: 'test' },
    fields: {
      name: 'test name',
      items: [
        {
          sys: {
            type: 'Entry',
            id: 'test button',
            contentType: {
              sys: {
                id: 'menuButton',
              },
            },
          },
          fields: {
            title: 'Button Title',
          },
        },
      ],
    },
  })

  const button = menu.items[0]
  t.true(button instanceof MenuButton)
})
