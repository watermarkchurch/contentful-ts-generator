import { IEntry, ILink } from './base'
import { TypeDirectory } from './generated'

export * from './base'
export {wrap} from './generated'

export type KnownContentType = keyof TypeDirectory

/**
 * This complex type & associated helper allow us to mark an entry as
 * not including any links.  The compiler will understand that even though
 * the entry type (i.e. 'IPage') contains links, a Resolved<IPage> will have
 * resolved the links into the actual entries or assets.
 */
export type Resolved<TEntry> =
  TEntry extends IEntry<infer TProps> ?
    // TEntry is an entry and we know the type of it's props
    IEntry<{
      [P in keyof TProps]: ResolvedField<Exclude<TProps[P], ILink<any>>>
    }>
    : never

type ResolvedField<TField> =
    TField extends Array<infer TItem> ?
      // Array of entries - dive into the item type to remove links
      Array<Exclude<TItem, ILink<any>>> :
      TField
