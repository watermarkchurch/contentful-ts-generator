# contentful-ts-generator

[![npm version](https://badge.fury.io/js/contentful-ts-generator.svg)](https://badge.fury.io/js/contentful-ts-generator)
[![Build Status](https://travis-ci.org/gburgett/ts-generators.svg?branch=master)](https://travis-ci.org/gburgett/ts-generators)
[![Coverage Status](https://coveralls.io/repos/github/gburgett/ts-generators/badge.svg?branch=master)](https://coveralls.io/github/gburgett/ts-generators?branch=master)

A CLI & webpack plugin for automatically generating Typescript code based on the
content types in your Contentful space.

### Installation:
```
npm install contentful-ts-generator
```

### Usage:

#### CLI:
```
$ node_modules/.bin/contentful-ts-generator --help
Options:
  --help                 Show help                                     [boolean]
  --version              Show version number                           [boolean]
  --file, -f             The location on disk of the schema file.
  --out, -o              Where to place the generated code.
  --download, -d         Whether to download the schema file from the Contentful
                         space first                                   [boolean]
  --managementToken, -m  The Contentful management token.  Defaults to the env
                         var CONTENTFUL_MANAGEMENT_TOKEN
  --space, -s            The Contentful space ID. Defaults to the env var
                         CONTENTFUL_SPACE_ID
  --environment, -e      The Contentful environment.  Defaults to the env var
                         CONTENTFUL_ENVIRONMENT or 'master'
```

It requires no parameters to function, provided you've set the appropriate environment
variables or have already downloaded a `contentful-schema.json` file.  By default,
in a Rails project it will look for `db/contentful-schema.json` and generate
Typescript files in `app/assets/javascripts/lib/contentful/generated`.

#### Webpack plugin

In your webpack.config.js:
```js
module.exports = {
  ...
  plugins: [    
    new ContentfulTsGeneratorPlugin({
      /** (Optional) The location on disk of the schema file. */
      schemaFile: 'db/contentful-schema.json',
      /** (Optional) Where to place the generated code. */
      outputDir: 'app/assets/javascripts/lib/contentful',
      /**
       * (Optional) Whether to download the schema file from the Contentful space first.
       * This can take a long time - it's best to set this to "false" and commit your
       * contentful-schema.json to the repository.
       */
      downloadSchema: true,
      /** (Optional) The Contentful space ID. Defaults to the env var CONTENTFUL_SPACE_ID */
      space?: '1xab...',
      /** (Optional) The Contentful environment.  Defaults to the env var CONTENTFUL_ENVIRONMENT or \'master\' */
      environment?: 'master',
      /** (Optional) The Contentful management token.  Defaults to the env var CONTENTFUL_MANAGEMENT_TOKEN */
      managementToken?: 'xxxx',
    })
  ]
};
```

or in `config/webpack/environment.js` for a
[webpacker](https://github.com/rails/webpacker) project
```js
const { ContentfulTsGeneratorPlugin } = require('contentful-ts-generator')
environment.plugins.append('ContentfulTsGenerator', new ContentfulTsGeneratorPlugin({
    // options
  }))
```

#### Example:

```tsx
import { ContentfulClientApi } from 'contentful'
import { Resolved } from './lib/contentful'
import {
  IMenu
} from './lib/contentful/generated'

interface IProps {
  menuId: string,
  client: ContentfulClientApi
}

interface IState {
  resolvedMenu: Resolved<IMenu>
}

export class MenuRenderer extends React.Component<IProps, IState> {

  public componentDidMount() {
    this.loadMenu()
  }

  public render() {
    const { resolvedMenu } = this.state

    if (!resolvedMenu) {
      return <div className="waiting-indicator">Loading...</div>
    }

    return <div>
      {resolvedMenu.fields.items.map(
        // no need to cast here, the generated interface tells us it's an IMenuButton
        (btn) => (
          <a href={btn.fields.externalLink}>
            <i className={btn.fields.ionIcon}>
            {btn.fields.text}
          </a>
        )
      )}
    </div>
  } 
  
  private async loadMenu() {
    const { menuId, client } = this.props

    // By default, client.getEntry resolves one level of links.
    // This is represented with the `Resolved<IMenu>` type, which is what gets
    // returned here.
    const resolvedMenu = await client.getEntry<IMenu>(menuId)
   
    this.setState({
      resolvedMenu
    })
  }
}
```

What does `'generated/menu.ts'` look like?

Given a content type defined like this:
```json
{
      "sys": {
        "id": "menu",
        "type": "ContentType"
      },
      "displayField": "internalTitle",
      "name": "Menu",
      "description": "A Menu contains a number of Menu Buttons or other Menus, which will be rendered as drop-downs.",
      "fields": [
        {
          "id": "internalTitle",
          "name": "Internal Title (Contentful Only)",
          "type": "Symbol",
          "localized": false,
          "required": true,
          "validations": [],
          "disabled": false,
          "omitted": true
        },
        {
          "id": "name",
          "name": "Menu Name",
          "type": "Symbol",
          "localized": false,
          "required": true,
          "validations": [],
          "disabled": false,
          "omitted": false
        },
        {
          "id": "items",
          "name": "Items",
          "type": "Array",
          "localized": false,
          "required": false,
          "validations": [],
          "disabled": false,
          "omitted": false,
          "items": {
            "type": "Link",
            "validations": [
              {
                "linkContentType": [
                  "cartButton",
                  "divider",
                  "dropdownMenu",
                  "loginButton",
                  "menuButton"
                ],
                "message": "The items must be either buttons, drop-down menus, or dividers."
              }
            ],
            "linkType": "Entry"
          }
        }
      ]
    }
```

The following types are generated:
```ts
import { wrap } from ".";
import { IEntry, ILink, isEntry, ISys } from "../base";
import { CartButton, ICartButton } from "./cart_button";
import { Divider, IDivider } from "./divider";
import { DropdownMenu, IDropdownMenu } from "./dropdown_menu";
import { ILoginButton, LoginButton } from "./login_button";
import { IMenuButton, MenuButton } from "./menu_button";

export interface IMenuFields {
  internalTitle?: never;
  name: string;
  items?: Array<ILink<'Entry'> | MenuItem>;
}

export type MenuItem = ICartButton | IDivider | IDropdownMenu | ILoginButton | IMenuButton;
export type MenuItemClass = CartButton | Divider | DropdownMenu | LoginButton | MenuButton;

/**
 * Menu
 * A Menu contains a number of Menu Buttons or other Menus, which will be rendered as drop-downs.
 */
export interface IMenu extends IEntry<IMenuFields> {
}

export function isMenu(entry: IEntry<any>): entry is IMenu {
  return entry &&
    entry.sys &&
    entry.sys.contentType &&
    entry.sys.contentType.sys &&
    entry.sys.contentType.sys.id == 'menu'
}

export class Menu implements IMenu {
  public readonly sys!: ISys<'Entry'>;
  public readonly fields!: IMenuFields;

  get name(): string {
    return this.fields.name
  }

  get items(): Array<MenuItemClass | null> | undefined {
    return !this.fields.items ? undefined :
      this.fields.items.map((item) =>
        isEntry(item) ? wrap<'cartButton' | 'divider' | 'dropdownMenu' | 'loginButton' | 'menuButton'>(item) : null
      )
  }

  constructor(entry: IMenu);
  constructor(id: string, fields: IMenuFields);
  constructor(entryOrId: IMenu | string, fields?: IMenuFields) {

    if (typeof entryOrId == 'string') {
      if (!fields) {
        throw new Error('No fields provided')
      }

      this.sys = {
        id: entryOrId,
        type: 'Entry',
        space: undefined,
        contentType: {
          sys: {
            type: 'Link',
            linkType: 'ContentType',
            id: 'menu'
          }
        }
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

```

The interface represents data coming back from Contentful's `getEntry` SDK function.
The generated class can be used as a convenient wrapper.  For example:

```ts
const menu = new Menu(await client.getEntry('my-menu-id'))
const button0 = menu.items[0]

expect(button0.text).to.equal('About Us')
```

You can also extend the generated classes with your own functions and properties.
As an example, suppose you wanted to use some client-side logic to determine
whether a certain menu button should be hidden from users. You could define
an `accessLevel` property on menu button:

```ts
// in lib/contentful/ext/menu_button.ts
import { MenuButton } from '../generated/menu_button'

// reopen the MenuButton module to add properties and functions to
// the Typescript definition
declare module '../generated/menu_button' {
  export interface MenuButton {
    accessLevel: number
  }
}


const restrictedPages: Array<[string | RegExp, number]> = [
  [/^admin/, 9],
]

// Define a javascript property which becomes the actual
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
      const accessLevel = restriction[1]

      if (test.test(slug)) {
        return restriction[1]
      }

      return 0
    }
  },
  enumerable: true,
})
```

And using it in your react component:

```tsx
import { Menu } from './lib/contentful/generated'

interface IProps {
  resolvedMenu: Menu,
  currentUser: {
    accessLevel: number
  }
}

export class MenuRenderer extends React.Component<IProps> {

  public render() {
    const { resolvedMenu, currentUser } = this.props

    return <div>
      {
        resolvedMenu.items
          // Here we only show the buttons that the current user has access to see.
          // Since `resolvedMenu` is an instance of Menu, its `items` field contains
          // only MenuButton instances, which have our property defined on them.
          .filter((btn) => currentUser.accessLevel >= btn.accessLevel)
          .map((btn) => (
            <a href={btn.externalLink}>
              <i className={btn.ionIcon}>
              {btn.text}
            </a>
          ))
      }
    </div>
  }
}
```

This is a cleaner implementation than putting the access level logic in the view.
