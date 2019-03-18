import test, { before } from 'ava'
import {createClient} from 'contentful'
import * as fs from 'fs-extra'
import globby from 'globby'
import * as nock from 'nock'
import * as path from 'path'
import * as tmp from 'tmp'
import Project from 'ts-morph'
import { promisify } from 'util'

import { ContentfulTSGenerator } from './index'
import { Installer } from './installer'

const client = createClient({
  accessToken: 'xxx',
  space: 'testspace',
  responseLogger,
  requestLogger,
} as any)

before(async (t) => {
  const tmpDir = await (promisify<string>((cb) => tmp.dir(cb))())

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

test('Menu creates wrapped classes for resolved links', async (t) => {
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

test('Menu can wrap Contentful.js objects', async (t) => {
  const { tmpDir } = (t.context as any)
  const menuPath = path.join(tmpDir, 'generated/menu.ts')
  const buttonPath = path.join(tmpDir, 'generated/menu_button.ts')

  const { Menu } = require(menuPath)
  const { MenuButton } = require(buttonPath)

  nockEnvironment()
  nock('https://cdn.contentful.com')
    .get('/spaces/testspace/environments/master/entries?sys.id=20bohaVp20MyKSi0YCaw8s')
    .replyWithFile(200, path.join(__dirname, 'fixtures/menu.json'))

  const menu = new Menu(await client.getEntry<any>('20bohaVp20MyKSi0YCaw8s'))
  const button = menu.items[0]
  t.true(button instanceof MenuButton)
  t.deepEqual(button.text, 'Pricing')
})

async function loadFixtures() {
  const fixtures = await Promise.all(
    (await globby(path.join(__dirname, 'fixtures/*.json')))
      .map(async (f) => {
        const fixture = await fs.readFile(f)
        return [path.basename(f), JSON.parse(fixture.toString())] as [string, any]
      }),
    )

  return fixtures.reduce((memo, file: [string, any]) => {
    memo[file[0]] = file[1]
    return memo
  }, {} as { [name: string]: any })
}

function nockEnvironment() {
  nock('https://cdn.contentful.com')
  .get('/spaces/testspace')
  .reply(200, {
    name: 'Test Space',
    sys: {
      type: 'Space',
      id: 'testspace',
      version: 2,
      createdBy: {
        sys: {
          type: 'Link',
          linkType: 'User',
          id: 'xxxxx',
        },
      },
      createdAt: '2018-01-22T17:49:19Z',
      updatedBy: {
        sys: {
          type: 'Link',
          linkType: 'User',
          id: 'xxxx',
        },
      },
      updatedAt: '2018-05-30T10:22:40Z',
    },
  })

  nock('https://cdn.contentful.com')
  .get('/spaces/testspace/environments/master')
  .reply(200, {
    name: 'master',
    sys: {
      type: 'Environment',
      id: 'master',
      version: 1,
      space: {
        sys: {
          type: 'Link',
          linkType: 'Space',
          id: 'testspace',
        },
      },
      status: {
        sys: {
          type: 'Link',
          linkType: 'Status',
          id: 'ready',
        },
      },
      createdBy: {
        sys: {
          type: 'Link',
          linkType: 'User',
          id: 'xxxx',
        },
      },
      createdAt: '2018-01-22T17:49:19Z',
      updatedBy: {
        sys: {
          type: 'Link',
          linkType: 'User',
          id: 'xxxx',
        },
      },
      updatedAt: '2018-01-22T17:49:19Z',
    },
  })
}

function requestLogger(config: any) {
  // console.log('req', config)
}

function responseLogger(response: any) {
  // tslint:disable-next-line:no-console
  console.log(response.status, response.config.url)
}
