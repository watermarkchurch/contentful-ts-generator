import { Limiter } from 'async-toolbox'
import {createClient} from 'contentful-management'
import * as fs from 'fs-extra'
import * as path from 'path'

interface IOptions {
  directory: string
  filename: string
  space: string
  environment: string
  managementToken: string

  logger: { debug: Console['debug'] }
}

export class SchemaDownloader {
  private readonly options: Readonly<IOptions>
  private readonly client: any
  private readonly semaphore: Limiter

  constructor(options?: Partial<IOptions>) {
    const opts: IOptions = Object.assign({
      directory: '.',
      filename: 'contentful-schema.json',
      managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
      space: process.env.CONTENTFUL_SPACE_ID,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      logger: console,
    } as IOptions, options)

    if (!opts.managementToken) {
      throw new Error('No managementToken given!')
    }

    this.options = opts
    this.client = createClient({
      accessToken: opts.managementToken,
      requestLogger: this.requestLogger,
      responseLogger: this.responseLogger,
    })
    this.semaphore = new Limiter({
      interval: 'second',
      tokensPerInterval: 4,
    })
  }

  public async downloadSchema() {
    const {
      contentTypes,
      editorInterfaces,
    } = await this.getSchemaFromSpace()

    if (this.options.directory) {
      await fs.mkdirp(this.options.directory)
    }
    const file = path.join(this.options.directory || '.', this.options.filename)
    await fs.writeFile(file, JSON.stringify({
      contentTypes,
      editorInterfaces,
    }, undefined, '  '))
  }

  private async getSchemaFromSpace() {
    const space = await this.semaphore.lock<any>(() =>
      this.client.getSpace(this.options.space))
    const env = await this.semaphore.lock<any>(() =>
      space.getEnvironment(this.options.environment))

    const contentTypesResp = await this.semaphore.lock<any>(() =>
      env.getContentTypes())

    const editorInterfaces = (await Promise.all<any>(
      contentTypesResp.items.map((ct: any) =>
        this.semaphore.lock<any>(async () =>
          stripSys(
            (await ct.getEditorInterface())
              .toPlainObject(),
          ),
        ),
      ),
    )).sort(byContentType)
    const contentTypes = contentTypesResp.items.map((ct: any) =>
      stripSys(ct.toPlainObject()))
      .sort(byId)

    return {
      contentTypes,
      editorInterfaces,
    }
  }

  private requestLogger = (config: any) => {
    // console.log('req', config)
  }

  private responseLogger = (response: any) => {
    this.options.logger.debug(response.status, response.config.url)
  }
}

function stripSys(obj: any): any {
  return {
    ...obj,
    sys: {
      id: obj.sys.id,
      type: obj.sys.type,
      contentType: obj.sys.contentType,
    },
  }
}

function byId(a: { sys: { id: string } }, b: { sys: { id: string } }): number {
  return a.sys.id.localeCompare(b.sys.id)
}

function byContentType(
  a: {sys: {contentType: {sys: {id: string}}}},
  b: {sys: {contentType: {sys: {id: string}}}},
): number {
  return a.sys.contentType.sys.id.localeCompare(b.sys.contentType.sys.id)
}
