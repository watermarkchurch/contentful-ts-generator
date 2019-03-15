
// tslint:disable-next-line:interface-over-type-literal
export type JsonObject = { [k: string]: any }

export interface IEntry<TFields extends JsonObject> {
  sys: ISys<'Entry'>,
  fields: TFields
}

/**
 * Checks whether the given object is a Contentful entry
 * @param obj
 */
export function isEntry(obj: any): obj is IEntry<any> {
  return obj && obj.sys && obj.sys.type === 'Entry'
}

interface IAssetFields {
  title?: string,
  description?: string,
  file: {
    url?: string,
    details?: {
      size?: number,
    },
    fileName?: string,
    contentType?: string,
  },
}

export interface IAsset {
  sys: ISys<'Asset'>,
  fields: IAssetFields
}

export class Asset implements IAsset {
  public readonly sys!: ISys<'Asset'>
  public readonly fields!: IAssetFields

  constructor(asset: IAsset)
  constructor(id: string, fields: IAssetFields)
  constructor(entryOrId: IAsset | string, fields?: IAssetFields) {
    if (typeof entryOrId == 'string') {
      if (!fields) {
        throw new Error('No fields provided')
      }

      this.sys = {
        id: entryOrId,
        type: 'Asset',
        contentType: undefined,
      }
      this.fields = fields
    } else {
      if (typeof entryOrId.sys == 'undefined') {
        throw new Error('Entry did not have a `sys`!')
      }
      if (typeof entryOrId.fields == 'undefined') {
        throw new Error('Entry did not have a `fields`!')
      }
      Object.assign(this, entryOrId)
    }
  }
}

/**
 * Checks whether the given object is a Contentful asset
 * @param obj
 */
export function isAsset(obj: any): obj is IAsset {
  return obj && obj.sys && obj.sys.type === 'Asset'
}

export interface ILink<Type extends string> {
  sys: {
    type: 'Link',
    linkType: Type,
    id: string,
  },
}

export interface ISys<Type extends string> {
  space?: ILink<'Space'>,
  id: string,
  type: Type,
  createdAt?: string,
  updatedAt?: string,
  revision?: number,
  environment?: ILink<'Environment'>,
  contentType: Type extends 'Entry' ? ILink<'ContentType'> : undefined,
  locale?: string,
}

/**
 * Checks whether the given object is a Contentful link
 * @param obj
 */
export function isLink(obj: any): obj is ILink<string> {
  return obj && obj.sys && obj.sys.type === 'Link'
}
