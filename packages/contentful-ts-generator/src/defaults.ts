import * as fs from 'fs-extra'

let outputDir: string
if (fs.statSync('app/assets/javascripts')) {
  outputDir = 'app/assets/javascripts/lib/contentful/generated'
} else {
  outputDir = 'lib/contentful/generated'
}

let schemaFile: string
if (fs.statSync('db').isDirectory()) {
  schemaFile = 'db/contentful-schema.json'
} else {
  schemaFile = 'contentful-schema.json'
}

const defaults = {
  managementToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  space: process.env.CONTENTFUL_SPACE_ID,
  environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  outputDir,
  schemaFile,
}

export default defaults
