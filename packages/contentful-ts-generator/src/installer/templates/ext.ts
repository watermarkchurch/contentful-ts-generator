import { Resolved } from '.'
import { IAsset, IEntry } from './base'
import { TypeDirectory } from './generated'

declare module 'contentful' {
  // tslint:disable:interface-name
  export interface Entry<T> {
    toPlainObject(): IEntry<T>
  }

  export interface Asset {
    toPlainObject(): IAsset
  }

  export interface ContentfulClientApi {
    /**
     * Get an entry, casting to its content type.
     *
     * Since the Contentful API by default resolves to one layer, the resulting
     * type is a Resolved entry.
     */
    getEntry<T extends IEntry<any>>(id: string, query?: any): Promise<Resolved<T>>
  }

  // tslint:enable:interface-name
}
