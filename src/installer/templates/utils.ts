import { IEntry, isEntry, isLink, JsonObject, Resolved } from '.'

/**
 * Returns a boolean indicating whether the given entry is resolved to a certain
 * depth.  Typescript can understand the result of this within an if or switch
 * statement.
 *
 * @param entry The entry whose fields should be checked for links
 * @param depth how far down the tree to expect that the entry was resolved.
 * @returns a boolean indicating that the entry is a Resolved entry.
 */
export function isResolved<TProps extends JsonObject>(
  entry: IEntry<TProps>,
  depth: number = 1,
): entry is Resolved<IEntry<TProps>> {
  if (depth < 1) { throw new Error(`Depth cannot be less than 1 (was ${depth})`) }

  return Object.keys(entry.fields).every((field) => {
    const val = entry.fields[field]

    if (Array.isArray(val)) {
      return val.every(check)
    } else {
      return check(val)
    }
  })

  function check(val: any): boolean {
    if (isLink(val)) {
      return false
    }
    if (depth > 1 && isEntry(val)) {
      return isResolved(val, depth - 1)
    }
    return true
  }
}

/**
 * Expects that an entry has been resolved to at least a depth of 1,
 * throwing an error if not.
 *
 * @param entry The entry whose fields should be checked for links
 * @returns the same entry object, declaring it as resolved.
 */
export function expectResolved<TProps extends JsonObject>(
  entry: IEntry<TProps>,
  depth: number = 1,
): Resolved<IEntry<TProps>> {
  if (isResolved(entry, depth)) {
    return entry
  }
  throw new Error(`${entry.sys.contentType.sys.id} ${entry.sys.id} was not fully resolved`)
}
