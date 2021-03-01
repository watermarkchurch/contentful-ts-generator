import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as yargs from 'yargs'

import defaults from './defaults'
import { ContentfulTSGenerator } from './generator'
import { Installer } from './installer'
import { SchemaDownloader } from './schema-downloader'

interface IArgv {
  /** The schema file to load for code generation */
  file: string,
  /** The output directory in which to write the code */
  out: string
  /** Whether to download */
  download: boolean
  managementToken: string,
  space: string,
  environment: string
  verbose?: boolean
}

interface ILogger {
  log: Console['log'],
  error: Console['error'],
  debug: Console['debug'],
}

yargs
  .option('file', {
    alias: 'f',
    describe: 'The location on disk of the schema file.',
  })
  .option('out', {
    alias: 'o',
    describe: 'Where to place the generated code.',
  })
  .option('download', {
    boolean: true,
    alias: 'd',
    describe: 'Whether to download the schema file from the Contentful space first',
  })
  .option('managementToken', {
    alias: 'm',
    describe: 'The Contentful management token.  Defaults to the env var CONTENTFUL_MANAGEMENT_TOKEN',
  })
  .option('space', {
    alias: 's',
    describe: 'The Contentful space ID. Defaults to the env var CONTENTFUL_SPACE_ID',
  })
  .option('environment', {
    alias: 'e',
    describe: 'The Contentful environment.  Defaults to the env var CONTENTFUL_ENVIRONMENT or \'master\'',
  })
  .option('verbose', {
    boolean: true,
    alias: 'v',
    describe: 'Enable verbose logging',
  })

// tslint:disable-next-line:no-shadowed-variable
async function Run(args: IArgv, logger: ILogger = console) {
  if (args.download) {
    const downloader = new SchemaDownloader({
      ...args,
      directory: path.dirname(args.file),
      filename: path.basename(args.file),
      logger,
    })

    await downloader.downloadSchema()
  }

  const installer = new Installer({
    outputDir: args.out,
    logger,
  })

  const generator = new ContentfulTSGenerator({
    outputDir: path.join(args.out, 'generated'),
    schemaFile: args.file,
  })

  await Promise.all([
    installer.install(),
    generator.generate(),
  ])
}

const args = Object.assign<Partial<IArgv>, Partial<IArgv>>(
  {
    ...defaults,
    out: defaults.outputDir,
    file: defaults.schemaFile,
  },
  yargs.argv as Partial<IArgv>)

if (typeof (args.download) == 'undefined') {
  if (args.managementToken && args.space && args.environment) {
    args.download = true
  }
} else if (typeof (args.download) == 'string') {
  args.download = args.download == 'true'
}

// tslint:disable:no-console

const logger: ILogger = {
  error: console.error,
  log: console.log,
  debug: () => undefined,
}

if (args.verbose) {
  logger.debug = (...msg: any[]) => {
    console.debug(chalk.gray(...msg))
  }
}

Run(args as IArgv, logger)
  .catch((err) =>
    console.error(chalk.red('An unexpected error occurred!'), err))
