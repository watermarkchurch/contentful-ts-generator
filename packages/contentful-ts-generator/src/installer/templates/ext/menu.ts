/*
 * This is a sample extension file to illustrate extending the
 * generated wrapper classes with custom methods or properties.
 * Uncomment the require line in 'ext.ts' to use this file.
 */

import { isEntry } from '../base'
import { IMenu, Menu, MenuButton } from '../generated/menu_button'

// reopen the MenuButton module to add properties and functions to
// the Typescript definition
declare module '../generated/menu_button' {
  // tslint:disable-next-line:interface-name
  export interface MenuButton {
    /**
     * Determines the access level for the linked page.
     */
    readonly accessLevel: number

    /**
     * Gets all the menus that link to me
     */
    menusThatLinkToMe(): Promise<Menu[]>
  }
}

const restrictedPages: Array<[string | RegExp, number]> = [
  [/^admin/, 9],
  ['restricted', 2],
]

// Define a javascript prototype which gets compiled into the actual
// property implementation
Object.defineProperty(MenuButton.prototype, 'accessLevel', {
  get() {
    const slug: string = this.link && isEntry(this.link) ?
      this.link.slug :
      this.externalLink

    if (!slug) {
      return 0
    }

    for (const restriction of restrictedPages) {
      const test = restriction[0]
      if (typeof test == 'string') {
        if (slug.includes(test)) {
          return restriction[1]
        }
      } else {
        if (test.test(slug)) {
          return restriction[1]
        }
      }
    }
  },
  enumerable: true,
})

declare var window: any

// Define a javascript function on the MenuButton prototype
// which gets compiled into the function implementation
MenuButton.prototype.menusThatLinkToMe = async function() {
  const client = window.globalContentfulClient
  const entries = await client.entries({ links_to_entry: this.sys.id })
  return entries.map((e: IMenu) => new Menu(e))
}

export {}
