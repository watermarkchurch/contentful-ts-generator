import * as fs from 'fs-extra'
import * as path from 'path'
import { Compiler } from 'webpack'

import { callbackify } from 'util'
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
      managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
      space: process.env.CONTENTFUL_SPACE_ID,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
      logger: console,
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

    if (!opts.schemaFile) {
      if (fs.statSync('db').isDirectory()) {
        opts.schemaFile = 'db/contentful-schema.json'
      } else {
        opts.schemaFile = 'contentful-schema.json'
      }
    }

    if (!opts.outputDir) {
      if (fs.statSync('app/assets/javascripts')) {
        opts.outputDir = 'app/assets/javascripts/lib/contentful/generated'
      } else {
        opts.outputDir = 'lib/contentful/generated'
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
    const indexFileName = path.join(path.resolve(options.outputDir), 'index.ts')

    if (this.options.downloadSchema) {
      await this.downloader().downloadSchema()
    } else if (fs.existsSync(indexFileName)) {
      const o = fs.statSync(indexFileName)
      const s = fs.statSync(options.schemaFile)
      if (s.mtime < o.mtime) {
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
