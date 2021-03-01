import * as fs from 'fs-extra'

let outputDir: string
if (fs.existsSync('app/assets/javascripts')) {
  outputDir = 'app/assets/javascripts/lib/contentful'
} else {
  outputDir = 'lib/contentful'
}

let schemaFile: string
if (fs.existsSync('db') && fs.statSync('db').isDirectory()) {
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
