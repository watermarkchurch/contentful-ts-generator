import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as yargs from 'yargs'

import { ContentfulTSGenerator } from './generator'
import { SchemaDownloader } from './schema-downloader'

interface Argv {
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

// tslint:disable-next-line:no-shadowed-variable
async function Run(args: Argv) {
  if (args.download) {
    const downloader = new SchemaDownloader({
      directory: path.dirname(args.file),
      filename: path.basename(args.file),
    })

    await downloader.downloadSchema()
  }

  const generator = new ContentfulTSGenerator({
    outputDir: path.join(args.out, 'generated'),
    schemaFile: args.file,
  })

  await generator.generate()
}

const args = Object.assign<Partial<Argv>, Partial<Argv>>({
  managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  space: process.env.CONTENTFUL_SPACE_ID,
  environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
}, yargs.argv as Partial<Argv>)

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

Run(args as Argv)
  .catch((err) =>
    console.error(chalk.red('An unexpected error occurred!'), err))
