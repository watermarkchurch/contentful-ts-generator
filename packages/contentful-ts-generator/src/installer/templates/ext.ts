import { ContentfulClientApi, Entry as ContentfulEntry } from 'contentful'
import { Entry, IAsset, IEntry, JsonObject, Resolved } from './base'

// Comment this out if you do not have the `contentful` NPM module installed.
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
    getEntry<T>(id: string, query?: any): Promise<Resolved<Entry<T>>>
  }
}

declare module './base' {
  export interface Entry<TFields extends JsonObject> {
    /**
     * Resolves this entry to the specified depth (less than 10), and returns the
     * raw object.
     * @param n The depth to resolve to.
     * @param client The client to use.
     */
    resolve(n: number, client: ContentfulClientApi, query?: any): Promise<Resolved<IEntry<TFields>>>
  }
}

Entry.prototype.resolve = async function(n, client, query?: any) {
  const id = this.sys.id
  const entry = await client.getEntry(id, Object.assign({}, query, { include: n }))
  const pojo = (entry as ContentfulEntry<any>).toPlainObject()

  Object.assign(this, pojo)
  return pojo
}
