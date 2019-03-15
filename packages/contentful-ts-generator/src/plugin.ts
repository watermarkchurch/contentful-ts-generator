import * as fs from 'fs-extra'
import * as path from 'path'
import { Compiler } from 'webpack'

import { ContentfulTSGenerator, GeneratorOptions } from './generator'
import { Installer } from './installer'
import { SchemaDownloader } from './schema-downloader'

export interface PluginOptions extends GeneratorOptions {
  schemaFile: string
  outputDir: string
  downloadSchema: boolean | undefined
  space?: string
  environment?: string
  managementToken?: string
}

export class ContentfulTSGeneratorPlugin {
  private readonly options: Readonly<PluginOptions>

  private readonly installer: Installer
  private readonly generator: ContentfulTSGenerator

  constructor(options?: Partial<PluginOptions>) {
    const opts = Object.assign({
      managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
      space: process.env.CONTENTFUL_SPACE_ID,
      environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
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

    this.options = opts as PluginOptions
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
    compiler.hooks.run.tapPromise('ContentfulTSGenerator', async () => {
      self.compile()
    })
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
        console.log(`${options.schemaFile} not modified, skipping generation`)
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
