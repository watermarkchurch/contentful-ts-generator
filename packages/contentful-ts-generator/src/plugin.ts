import * as fs from 'fs-extra'
import * as path from 'path'
import { Compiler } from 'webpack'

import { ContentfulTSGenerator, GeneratorOptions } from './generator'

export interface PluginOptions extends GeneratorOptions {
  schemaFile: string
  outputDir: string
  downloadSchema: boolean
  space?: string
  environment?: string
  managementToken?: string
}

export class ContentfulTSGeneratorPlugin {
  private readonly options: Readonly<PluginOptions>
  private readonly generator: ContentfulTSGenerator

  constructor(options?: Partial<PluginOptions>) {
    const opts = Object.assign({
      downloadSchema: false,
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
    this.generator = new ContentfulTSGenerator(this.options)
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

    if (fs.existsSync(indexFileName)) {
      const o = fs.statSync(indexFileName)
      const s = fs.statSync(options.schemaFile)
      if (s.mtime < o.mtime) {
        console.log(`${options.schemaFile} not modified, skipping generation`)
        return
      }
    }

    await this.generator.generate()
  }
}
