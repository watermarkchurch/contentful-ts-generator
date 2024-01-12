import {createClient} from 'contentful'
import * as fs from 'fs-extra'
import nock from 'nock'
import * as path from 'path'
import * as tmp from 'tmp'
import {Project} from 'ts-morph'
import { promisify } from 'util'

import { ContentfulTSGenerator } from './index'
import { Installer } from './installer'

const client = createClient({
  accessToken: 'xxx',
  space: 'testspace',
  responseLogger,
  requestLogger,
} as any)

describe('integration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await (promisify<string>((cb) => tmp.dir(cb))())

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

  it('generates menu.ts', async () => {
    
    const menuPath = path.join(tmpDir, 'generated/menu.ts')

    const project = new Project()
    const menuFile = project.addSourceFileAtPath(menuPath)

    expect(menuFile.getClasses().length).toEqual(1)
    expect(menuFile.getClasses()[0].getName()).toEqual('Menu')
  })

  it('Menu can be instantiated from raw entry', async () => {
    
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

    expect(menu.name).toEqual('test name')
    expect(menu.items).toEqual([null])
    expect(menu.sys).toEqual({ id: 'test' })
    expect(menu.fields.name).toEqual('test name')
  })

  it('Menu creates wrapped classes for resolved links', async () => {
    
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
    expect(button instanceof MenuButton).toBeTruthy()
  })

  it('Menu can wrap Contentful.js objects', async () => {
    
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
    expect(button instanceof MenuButton).toBeTruthy()
    expect(button.text).toEqual('Pricing')
  })

  it('Menu resolve gets linked objects', async () => {
    
    const menuPath = path.join(tmpDir, 'generated/menu.ts')
    const buttonPath = path.join(tmpDir, 'generated/menu_button.ts')

    // symlink "contentful" to pretend like it's been installed in node_modules
    const modulesDir = path.join(tmpDir, 'node_modules')
    await fs.mkdirp(modulesDir)
    await fs.symlink(path.join(__dirname, '../node_modules/contentful'), path.join(modulesDir, 'contentful'))

    // require the index path to get "ext"
    require(tmpDir)
    const { Menu } = require(menuPath)
    const { MenuButton } = require(buttonPath)

    const menu = new Menu('20bohaVp20MyKSi0YCaw8s', 'menu', {
      name: 'Side Hamburger',
      items: [
        { sys: { type: 'Link', linkType: 'Entry', id: 'DJfq5Q1ZbayWmgYSGuCSa' } },
        { sys: { type: 'Link', linkType: 'Entry', id: '4FZb5aqcFiUKASguCEIYei' } },
        { sys: { type: 'Link', linkType: 'Entry', id: '2kwNEGo2kcoIWCOICASIqk' } },
      ],
    })

    nockEnvironment()
    nock('https://cdn.contentful.com')
      .get('/spaces/testspace/environments/master/entries')
      .query({
        'sys.id':  '20bohaVp20MyKSi0YCaw8s',
        'include': 1,
        'otherParam': 'test',
      })
      .replyWithFile(200, path.join(__dirname, 'fixtures/menu.json'))
    const resolved = await menu.resolve(1, client, { otherParam: 'test' })

    const button = menu.items[0]
    expect(button instanceof MenuButton).toBeTruthy()
    expect(button.text).toEqual('Pricing')
    expect(resolved.fields.items[0].fields.text).toEqual('Pricing')
  })
})

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
