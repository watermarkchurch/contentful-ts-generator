import * as fs from 'fs-extra'
import * as inflection from 'inflection'
import * as path from 'path'
import { FunctionDeclarationOverloadStructure, Project, PropertySignatureStructure } from 'ts-morph'
import { Compiler } from 'webpack'

interface Options {
  schemaFile: string
  outputDir: string
  downloadSchema: boolean
  space?: string
  environment?: string
  managementToken?: string
}

export class ContentfulTSGenerator {
  private readonly options: Readonly<Options>

  constructor(options?: Partial<Options>) {
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

    if (!opts.schemaFile) {
      if (fs.statSync('db').isDirectory()) {
        opts.schemaFile = 'db/contentful-schema.json'
      } else {
        opts.schemaFile = 'contentful-schema.json'
      }
    }

    if (!opts.outputDir) {
      if (fs.statSync('app/assets/javascripts')) {
        opts.outputDir = 'app/assets/javascripts/lib/contentful'
      } else {
        opts.outputDir = 'lib/contentful'
      }
    }
    this.options = opts as Options
  }

  public apply = (compiler: Compiler) => {
    compiler.plugin('compile', this.compile)
  }

  public compile = (params: any) => {
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

    const schema = JSON.parse(fs.readFileSync(options.schemaFile).toString())

    fs.mkdirpSync(options.outputDir)
    if (fs.existsSync(indexFileName)) {
      fs.truncateSync(indexFileName)
    }

    const project = new Project()
    const indexFile = project.addExistingSourceFileIfExists(indexFileName) || project.createSourceFile(indexFileName)

    const typeDirectory = {} as { [id: string]: string }
    const fieldsDirectory = {} as { [id: string]: string }
    const classDirectory = {} as { [id: string]: string }
    schema.contentTypes.forEach((ct: any) => {
      const fileName = idToFilename(ct.sys.id)

      const writer = new ContentTypeWriter(ct, project)
      writer.write(path.join(path.resolve(options.outputDir), fileName + '.ts'))

      indexFile.addExportDeclaration({
        moduleSpecifier: `./${fileName}`,
        namedExports: ['*'],
      })
      // fs.appendFileSync(indexFileName, `export * from './${fileName}'\n`)
      typeDirectory[ct.sys.id] = writer.interfaceName
      fieldsDirectory[ct.sys.id] = writer.fieldsName
      classDirectory[ct.sys.id] = writer.className
    })

    // import * as C from '.'
    indexFile.addImportDeclaration({
      namespaceImport: 'C',
      moduleSpecifier: '.',
    })
    // import { IEntry } from '../base'
    indexFile.addImportDeclaration({
      namedImports: ['IEntry'],
      moduleSpecifier: '../base',
    })

    indexFile.addInterface({
      name: 'TypeDirectory',
      isExported: true,
      properties: Object.keys(typeDirectory).map<PropertySignatureStructure>((ct: any) => (
        {
          name: ct,
          type: `C.${typeDirectory[ct]}`,
        }
      )),
    })

    indexFile.addInterface({
      name: 'ClassDirectory',
      isExported: true,
      properties: Object.keys(classDirectory).map<PropertySignatureStructure>((ct: any) => (
        {
          name: ct,
          type: `C.${classDirectory[ct]}`,
        }
      )),
    })

    const wrapOverloads = Object.keys(classDirectory)
      .map<FunctionDeclarationOverloadStructure>((ct) => ({
        parameters: [{
          name: 'entry',
          type: `C.${typeDirectory[ct]}`,
        }],
        returnType: `C.${classDirectory[ct]}`,
      }))

    // wrap<CT extends keyof TypeDirectory>(entry: TypeDirectory[CT]): ClassDirectory[CT]
    wrapOverloads.push({
      typeParameters: [{
        name: 'CT',
        constraint: 'keyof TypeDirectory',
      }],
      parameters: [{
        name: 'entry',
        type: 'TypeDirectory[CT]',
      }],
      returnType: 'ClassDirectory[CT]',
    })

    // export function wrap(entry: IEntry<any>): IEntry<any>
    const wrapFn = indexFile.addFunction({
      name: 'wrap',
      parameters: [{
        name: 'entry',
        type: 'IEntry<any>',
      }],
      returnType: 'IEntry<any>',
      overloads: wrapOverloads,
    })

    wrapFn.setBodyText((writer) => {
      writer.writeLine('const id = entry.sys.contentType.sys.id')
        .writeLine('switch(id) {')

      Object.keys(classDirectory).map((ct) => {
        writer.writeLine(`case '${ct}':`)
          .writeLine(`return new C.${classDirectory[ct]}(entry)`)
      })
      writer.writeLine('default:')
      writer.writeLine('throw new Error(\'Unknown content type:\' + id)')
      writer.writeLine('}')
    })

  }
}

function idToFilename(id) {
  return inflection.underscore(id, false)
}
