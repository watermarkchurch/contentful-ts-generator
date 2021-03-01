import { IEntry, ILink } from './base'
import { TypeDirectory } from './generated'

export * from './base'
export {wrap} from './generated'

export type KnownContentType = keyof TypeDirectory

require('./ext')
// include this to extend the generated objects
// require('./ext/menu')
