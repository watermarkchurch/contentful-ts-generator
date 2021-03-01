import * as inflection from 'inflection'
import { ClassDeclaration, InterfaceDeclaration, Scope, SourceFile } from 'ts-morph'
import * as util from 'util'

export class ContentTypeWriter {
  public readonly interfaceName: string
  public readonly className: string
  public readonly fieldsName: string

  private linkedTypes: any[]

  constructor(private readonly contentType: any, private readonly file: SourceFile) {
    this.linkedTypes = []

    const name = idToName(contentType.sys.id)
    this.interfaceName = `I${name}`
    this.className = name
    this.fieldsName = `I${name}Fields`
  }

  public write = () => {
    const contentType = this.contentType
    const file = this.file

    file.addImportDeclaration({
      moduleSpecifier: '../base',
      namedImports: ['Asset', 'IAsset', 'Entry', 'IEntry', 'ILink', 'ISys', 'isAsset', 'isEntry'],
    })
    file.addImportDeclaration({
      moduleSpecifier: '.',
      namedImports: ['wrap'],
    })

    const fieldsInterface = file.addInterface({
      name: this.fieldsName,
      isExported: true,
    })

    contentType.fields.forEach((f: any) =>
      this.writeField(f, fieldsInterface))

    if (this.linkedTypes.length > 0) {
      this.linkedTypes = this.linkedTypes.filter((t, index, self) => self.indexOf(t) === index).sort()
      const indexOfSelf = this.linkedTypes.indexOf(contentType.sys.id)
      if (indexOfSelf > -1) {
        this.linkedTypes.splice(indexOfSelf, 1)
      }

      this.linkedTypes.forEach((id) => {
        file.addImportDeclaration({
          moduleSpecifier: `./${idToFilename(id)}`,
          namedImports: [
            `I${idToName(id)}`,
            idToName(id),
          ],
        })
      })
    }

    file.addInterface({
      name: this.interfaceName,
      isExported: true,
      docs: [[
        contentType.name,
        contentType.description && '',
        contentType.description && contentType.description,
      ].filter(exists).join('\n')],
      extends: [`IEntry<${this.fieldsName}>`],
    })

    file.addFunction({
      name: `is${this.className}`,
      isExported: true,
      parameters: [{
        name: 'entry',
        type: 'IEntry<any>',
      }],
      returnType: `entry is ${this.interfaceName}`,
      bodyText: (writer) => {
        writer.writeLine('return entry &&')
          .writeLine('entry.sys &&')
          .writeLine('entry.sys.contentType &&')
          .writeLine('entry.sys.contentType.sys &&')
          .writeLine(`entry.sys.contentType.sys.id == '${contentType.sys.id}'`)
      },
    })

    const klass = file.addClass({
      name: this.className,
      isExported: true,
      extends: `Entry<${this.fieldsName}>`,
      implements: [this.interfaceName],
      properties: [
        // These are inherited from the base class and do not need to be redefined here.
        // Further, babel 7 transforms the constructor in such a way that the `Object.assign(this, entryOrId)`
        // in the base class gets wiped if these properties are present.
        // { name: 'sys', isReadonly: true, hasExclamationToken: true, scope: Scope.Public, type: `ISys<'Entry'>` },
        // { name: 'fields', isReadonly: true, hasExclamationToken: true, scope: Scope.Public, type: this.fieldsName },
      ],
    })

    contentType.fields.filter((f: any) => !f.omitted)
      .map((f: any) => this.writeFieldAccessor(f, klass))

    klass.addConstructor({
      parameters: [{
        name: 'entryOrId',
        type: `${this.interfaceName} | string`,
      }, {
        name: 'fields',
        hasQuestionToken: true,
        type: this.fieldsName,
      }],
      overloads: [
        { parameters: [{ name: 'entry', type: this.interfaceName }] },
        { parameters: [{ name: 'id', type: 'string' }, { name: 'fields', type: this.fieldsName }] },
      ],
      bodyText: `super(entryOrId, '${contentType.sys.id}', fields)`,
    })
  }

  public writeField(field: any, fieldsInterface: InterfaceDeclaration) {
    fieldsInterface.addProperty({
      name: field.id,
      hasQuestionToken: field.omitted || (!field.required),
      type: this.writeFieldType(field),
    })
  }

  public writeFieldAccessor(field: any, klass: ClassDeclaration) {
    let accessorImpl = `return this.fields.${field.id}`
    let returnType = ``

    const getLinkImpl = (f: any, val: string) => {
      if (f.linkType == 'Asset') {
        returnType = `Asset | null`
        return `isAsset(${val}) ? new Asset(${val}) : null`
      } else {
        const validation = f.validations &&
          f.validations.find((v: any) => v.linkContentType && v.linkContentType.length > 0)
        if (validation) {
          const union = validation.linkContentType.map((ct: string) => `'${ct}'`).join(' | ')

          if (validation.linkContentType.length == 1) {
            returnType = `${idToName(validation.linkContentType[0])} | null`
          } else {
            returnType = `${unionTypeDefName(this.contentType.sys.id, f)}Class | null`
          }

          return `isEntry(${val}) ? wrap<${union}>(${val}) : null`
        } else {
          returnType = `IEntry<any> | null`
          return `isEntry(${val}) ? wrap(${val}) : null`
        }
      }
    }

    const optionalFieldDeclaration = field.required && !field.omitted ? '' : ' | undefined'

    if (field.type == 'Link') {
      accessorImpl = 'return '
      if (!field.required) {
        accessorImpl += `!this.fields.${field.id} ? undefined :\n`
      }
      accessorImpl += `(${getLinkImpl(field, `this.fields.${field.id}`)})`
      returnType = `${returnType}${optionalFieldDeclaration}`
    } else if (field.type == 'Array' && field.items.type == 'Link') {
      const mapFnImpl = getLinkImpl(Object.assign({ id: field.id }, field.items), 'item')
      accessorImpl = 'return '
      if (!field.required) {
        accessorImpl += `!this.fields.${field.id} ? undefined :\n`
      }

      accessorImpl += `this.fields.${field.id}.map((item) =>
        ${mapFnImpl}
      )`

      returnType = `Array<${returnType}>${optionalFieldDeclaration}`
    } else {
      returnType = `${this.writeFieldType(field)}${optionalFieldDeclaration}`
    }

    const fieldId = ['fields', 'sys'].indexOf(field.id) >= 0 ?
      // section-contact-us has a field named 'fields'
      field.id + '_get' :
      field.id
    const underscored = inflection.underscore(fieldId)

    klass.addGetAccessor({
      name: fieldId,
      returnType,
      bodyText: accessorImpl,
    })

    if (underscored != fieldId) {
      klass.addGetAccessor({
        name: underscored,
        returnType,
        bodyText: accessorImpl,
      })
    }
  }

  public writeFieldType(field: any): string {
    if (field.omitted) {
      return 'never'
    }
    switch (field.type) {
      case 'Symbol':
      case 'Text':
      case 'Date':
        return this.writePotentialUnionType(field) || 'string'
      case 'Integer':
      case 'Number':
        return this.writePotentialUnionType(field) || 'number'
      case 'Boolean':
        return 'boolean'
      case 'Location':
        return '{ lon: number, lat: number }'
      case 'Link':
        if (field.linkType == 'Asset') {
          return 'ILink<\'Asset\'> | IAsset'
        } else {
          return `ILink<'Entry'> | ${this.resolveLinkContentType(field)}`
        }
      case 'Array':
        const itemType = this.writeFieldType(Object.assign({ id: field.id }, field.items))
        if (itemType.includes(' | ') || itemType.includes('{')) {
          return `Array<${itemType}>`
        } else {
          return itemType + '[]'
        }
      default:
        return 'any'
    }
  }

  public resolveLinkContentType(field: any) {
    if (field.validations) {
      const validation = field.validations.find((v: any) => v.linkContentType && v.linkContentType.length > 0)
      if (validation) {
        this.linkedTypes.push(...validation.linkContentType)
        if (validation.linkContentType.length == 1) {
          const name = idToName(validation.linkContentType[0])
          return ('I' + name)
        }

        const unionName = unionTypeDefName(this.contentType.sys.id, field)
        if (!this.file.getTypeAlias(unionName)) {
          this.file.addTypeAlias({
            name: unionName,
            isExported: true,
            type: validation.linkContentType.map((v: any) => 'I' + idToName(v)).join(' | '),
          })

          this.file.addTypeAlias({
            name: unionName + 'Class',
            isExported: true,
            type: validation.linkContentType.map((v: any) => idToName(v)).join(' | '),
          })
        }
        return unionName
      }
    }
    return 'IEntry<any>'
  }

  public writePotentialUnionType(field: any) {
    if (field.validations) {
      const validation = field.validations.find((v: any) => v.in && v.in.length > 0)
      if (validation) {
        const name = unionTypeDefName(this.contentType.sys.id, field)
        if (!this.file.getTypeAlias(name)) {
          this.file.addTypeAlias({
            name,
            isExported: true,
            type: validation.in.map((val: any) => dump(val)).join(' | '),
          })
        }

        return name
      }
    }
  }
}
function idToName(id: string) {
  id = inflection.underscore(id)
  id = id.replace(/[^\w]/g, ' ')
  id = inflection.titleize(id)
  id = id.replace(/[\s+]/g, '')
  return id
}

function unionTypeDefName(contentType: string, field: { id: string }) {
  return `${idToName(contentType)}${inflection.singularize(idToName(field.id))}`
}

function idToFilename(id: string) {
  return inflection.underscore(id, false)
}

function dump(obj: any) {
  return util.inspect(obj, {
    depth: null,
    maxArrayLength: null,
    breakLength: 0,
  })
}

function exists(val: any): boolean {
  return !!val
}
