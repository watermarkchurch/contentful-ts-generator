import test from 'ava'
import * as fs from 'fs-extra'
import * as nock from 'nock'
import * as path from 'path'
import * as tmp from 'tmp'

import { SchemaDownloader } from './index'

let contentTypes: any
let editorInterfaces: any

const opts = {
  directory: '/tmp/db',
  managementToken: 'test',
  space: 'testspace',
}

test.beforeEach(async () => {
  const fixture = await fs.readFile(path.join(__dirname, 'fixtures/contentful-schema-from-export.json'))
  const schema = JSON.parse(fixture.toString())
  contentTypes = schema.contentTypes
  editorInterfaces = schema.editorInterfaces

  nock('https://api.contentful.com')
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

  nock('https://api.contentful.com')
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

  nock('https://api.contentful.com')
    .get('/spaces/testspace/environments/master/content_types')
    .reply(200, () => {
      return JSON.stringify({
        sys: { type: 'Array' },
        total: contentTypes.length,
        skip: 0,
        limit: 1,
        items: contentTypes,
      })
    })
  const interfaceRegexp = /content_types\/([^\/]+)\/editor_interface/
  nock('https://api.contentful.com')
    .get((uri) => interfaceRegexp.test(uri))
    .times(Infinity)
    .reply((uri) => {
      const id = interfaceRegexp.exec(uri)![1]
      const ei = editorInterfaces.find((i: any) => i.sys.contentType.sys.id == id)
      if (ei) {
        return [
          200,
          JSON.stringify(ei),
        ]
      } else {
        return [404]
      }
    })
})

test('creates the file in the appropriate directory', async (t) => {
  const tmpdir = tmp.dirSync()
  try {
    const instance = new SchemaDownloader({
      ...opts,
      directory: tmpdir.name
    })

    await instance.downloadSchema()

    t.true(await fs.pathExists(path.join(tmpdir.name, `/contentful-schema.json`)))
  } finally {
    tmpdir.removeCallback()
  }
})

test('writes file with proper formatting', async (t) => {
  const tmpdir = tmp.dirSync()
  try {
    const instance = new SchemaDownloader({
      ...opts,
      directory: tmpdir.name
    })

    await instance.downloadSchema()

    const contents = (await fs.readFile(path.join(tmpdir.name, 'contentful-schema.json'))).toString()
    const expected = (await fs.readFile(path.join(__dirname, 'fixtures/contentful-schema.json'))).toString()
    t.deepEqual(contents, expected)

  } finally {
    tmpdir.removeCallback()
  }
})
