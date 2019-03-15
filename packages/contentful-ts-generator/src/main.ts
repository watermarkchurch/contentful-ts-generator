import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as yargs from 'yargs'

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
}

interface ILogger {
  log: Console['log'],
  error: Console['error'],
  debug: Console['debug'],
}

// tslint:disable-next-line:no-shadowed-variable
async function Run(args: IArgv, logger: ILogger = console) {
  if (args.download) {
    const downloader = new SchemaDownloader({
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

const args = Object.assign<Partial<IArgv>, Partial<IArgv>>({
  managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  space: process.env.CONTENTFUL_SPACE_ID,
  environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
}, yargs.argv as Partial<IArgv>)

if (!args.file) {
  if (fs.statSync('db').isDirectory()) {
    args.file = 'db/contentful-schema.json'
  } else {
    args.file = 'contentful-schema.json'
  }
}

if (!args.out) {
  if (fs.statSync('app/assets/javascripts')) {
    args.out = 'app/assets/javascripts/lib/contentful'
  } else {
    args.out = 'lib/contentful'
  }
}

if (typeof (args.download) == 'undefined') {
  if (args.managementToken && args.space && args.environment) {
    args.download = true
  }
} else if (typeof (args.download) == 'string') {
  args.download = args.download == 'true'
}

// tslint:disable:no-console

const logger = {
  error: console.error,
  log: console.log,
  debug: () => undefined,
}

Run(args as IArgv, logger)
  .catch((err) =>
    console.error(chalk.red('An unexpected error occurred!'), err))
