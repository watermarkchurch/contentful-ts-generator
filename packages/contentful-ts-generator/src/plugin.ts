import * as fs from 'fs-extra'
import * as path from 'path'
import { Compiler } from 'webpack'

import { callbackify } from 'util'
import defaults from './defaults'
import { ContentfulTSGenerator, IGeneratorOptions } from './generator'
import { Installer } from './installer'
import { SchemaDownloader } from './schema-downloader'

export interface IPluginOptions extends IGeneratorOptions {
  /** The location on disk of the schema file. */
  schemaFile: string
  /** Where to place the generated code. */
  outputDir: string
  /** Whether to download the schema file from the Contentful space first */
  downloadSchema: boolean | undefined
  /** The Contentful space ID. Defaults to the env var CONTENTFUL_SPACE_ID */
  space?: string
  /** The Contentful environment.  Defaults to the env var CONTENTFUL_ENVIRONMENT or \'master\' */
  environment?: string
  /** The Contentful management token.  Defaults to the env var CONTENTFUL_MANAGEMENT_TOKEN */
  managementToken?: string

  logger: {
    log: Console['log'],
    debug: Console['debug'],
  }
}

export class ContentfulTSGeneratorPlugin {
  private readonly options: Readonly<IPluginOptions>

  private readonly installer: Installer
  private readonly generator: ContentfulTSGenerator

  constructor(options?: Partial<IPluginOptions>) {
    const opts = Object.assign({
      ...defaults,
      logger: {
        debug: () => null,
        // tslint:disable-next-line:no-console
        log: console.error,
      },
    }, options)

    if (opts.downloadSchema) {
      if (!opts.managementToken) {
        throw new Error('Management token must be provided in order to download schema')
      }
      if (!opts.space) {
        throw new Error('Space ID must be provided in order to download schema')
      }
      if (!opts.environment) {
        throw new Error('Environment must be provided in order to download schema')
      }
    }

    this.options = opts as IPluginOptions
    this.installer = new Installer({
      outputDir: this.options.outputDir,
    })
    this.generator = new ContentfulTSGenerator({
      schemaFile: this.options.schemaFile,
      outputDir: path.join(this.options.outputDir, 'generated'),
    })
  }

  public apply = (compiler: Compiler) => {
    const self = this
    if (compiler.hooks) {
      compiler.hooks.run.tapPromise('ContentfulTSGenerator', async () => {
        await self.compile()
      })
    } else {
      // webpack v2
      compiler.plugin('run', (compilation, callback) => {
        callbackify(() => this.compile())(callback)
      })
    }
  }

  public compile = async () => {
    const options = this.options
    const indexFileName = path.join(path.resolve(options.outputDir), 'generated', 'index.ts')

    if (this.options.downloadSchema) {
      await this.downloader().downloadSchema()
    } else if (await fs.pathExists(indexFileName)) {
      const [i, s] = await Promise.all([
        fs.statSync(indexFileName),
        fs.statSync(options.schemaFile),
      ])
      if (s.mtime < i.mtime) {
        this.options.logger.log(`${options.schemaFile} not modified, skipping generation`)
        return
      }
    } else if (typeof(this.options.downloadSchema) == 'undefined') {
      await this.downloader().downloadSchema()
    }

    await Promise.all([
      this.installer.install(),
      this.generator.generate(),
    ])
  }

  private downloader() {
    return new SchemaDownloader({
      ...this.options,
      directory: path.dirname(this.options.schemaFile),
      filename: path.basename(this.options.schemaFile),
    })
  }
}
