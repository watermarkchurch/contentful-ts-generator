import * as fs from 'fs-extra'
import globby from 'globby'
import * as path from 'path'
import defaults from '../defaults'

interface IInstallerOptions {
  outputDir: string

  logger: { debug: Console['debug'] }
}

const templateDir = path.join(__dirname, 'templates')

export class Installer {
  private readonly options: Readonly<IInstallerOptions>

  constructor(options?: Partial<IInstallerOptions>) {
    const opts = Object.assign({
      ...defaults,
      logger: console,
    }, options)

    this.options = opts as IInstallerOptions
  }

  public install = async () => {
    const files = await globby(path.join(templateDir, '**/*.ts'))
    await Promise.all(files.map(async (file) =>
      this.installFile(file),
    ))
  }

  public installFile = async (file: string) => {
    const relPath = path.relative(templateDir, file)
    const outPath = path.join(this.options.outputDir, relPath)

    if (await fs.pathExists(outPath)) {
      return
    }

    this.options.logger.debug('install file', relPath, 'to', outPath)
    await fs.copy(file, outPath)
  }
}
