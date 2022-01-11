/* eslint-disable no-useless-escape, no-cond-assign */
import type { AppInterface } from '@micro-app/types'
import { CompletionPath, getLinkFileDir, logError, trim } from '../libs/utils'
import microApp from '../micro_app'

// common reg
const rootSelectorREG = /(^|\s+)(html|:root)(?=[\s>~[.#:]+|$)/
const bodySelectorREG = /(^|\s+)((html[\s>~]+body)|body)(?=[\s>~[.#:]+|$)/
const cssUrlREG = /url\(["']?([^)"']+)["']?\)/gm

type parseErrorType = Error & { reason: string, filename?: string }
function parseError (msg: string, linkPath?: string): void {
  msg = linkPath ? `${linkPath}:${msg}` : msg
  const err = new Error(msg) as parseErrorType
  err.reason = msg
  if (linkPath) {
    err.filename = linkPath
  }

  throw err
}

/**
 * Reference resources https://github.com/reworkcss/css
 * CSSParser mainly deals with 3 scenes: styleRule, @, and comment
 * And scopecss deals with 2 scenes: selector & url
 * And can also disable scopecss with inline comments
 */
class CSSParser {
  private cssText = '' // css content
  private prefix = '' // prefix as micro-app[name=xxx]
  private baseURI = '' // domain name
  private linkPath = '' // link resource address, if it is the style converted from link, it will have linkPath
  private result = '' // parsed cssText
  private scopecssDisable = false // use block comments /* scopecss-disable */ to disable scopecss in your file, and use /* scopecss-enable */ to enable scopecss
  private scopecssDisableSelectors: Array<string> = [] // disable or enable scopecss for specific selectors
  private scopecssDisableNextLine = false // use block comments /* scopecss-disable-next-line */ to disable scopecss on a specific line

  public exec (
    cssText: string,
    prefix: string,
    baseURI: string,
    linkPath?: string,
  ): string {
    this.cssText = cssText
    this.prefix = prefix
    this.baseURI = baseURI
    this.linkPath = linkPath || ''
    this.matchRules()
    return this.result
  }

  public reset (): void {
    this.cssText = this.prefix = this.baseURI = this.linkPath = this.result = ''
    this.scopecssDisable = this.scopecssDisableNextLine = false
    this.scopecssDisableSelectors = []
  }

  // core action for match rules
  private matchRules (): void {
    this.matchLeadingSpaces()
    this.matchComments()
    while (
      this.cssText.length &&
      this.cssText.charAt(0) !== '}' &&
      (this.matchAtRule() || this.matchStyleRule())
    ) {
      this.matchComments()
    }
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleRule
  private matchStyleRule (): boolean | void {
    const selectorList = this.formatSelector()

    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false

    if (!selectorList) return parseError('selector missing', this.linkPath)

    this.result += (selectorList as Array<string>).join(', ')

    this.matchComments()

    this.styleDeclarations()

    this.matchLeadingSpaces()

    return true
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration
  private styleDeclarations (): boolean | void {
    if (!this.matchOpenBrace()) return parseError("Declaration missing '{'", this.linkPath)

    this.matchComments()

    while (this.styleDeclaration()) {
      this.matchComments()
    }

    if (!this.matchCloseBrace()) return parseError("Declaration missing '}'", this.linkPath)

    return true
  }

  // match one styleDeclaration at a time
  private styleDeclaration (): boolean | void {
    // css property
    if (!this.commonMatch(/^(\*?[-#\/\*\\\w]+(\[[0-9a-z_-]+\])?)\s*/)) return false

    // match :
    if (!this.commonMatch(/^:\s*/)) return parseError("property missing ':'", this.linkPath)

    // match css value
    const r = this.commonMatch(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^\)]*?\)|[^};])+)/, true)

    let cssValue = r ? r[0] : ''

    if (
      !this.scopecssDisableNextLine &&
      (!this.scopecssDisable || this.scopecssDisableSelectors.length)
    ) {
      cssValue = cssValue.replace(cssUrlREG, (all, $1) => {
        if (/^((data|blob):|#)/.test($1) || /^(https?:)?\/\//.test($1)) {
          return all
        }

        // ./a/b.png  ../a/b.png  a/b.png
        if (/^((\.\.?\/)|[^/])/.test($1) && this.linkPath) {
          this.baseURI = getLinkFileDir(this.linkPath)
        }

        return `url("${CompletionPath($1, this.baseURI)}")`
      })
    }

    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false

    this.result += cssValue

    this.matchLeadingSpaces()

    this.commonMatch(/^[;\s]*/)

    return true
  }

  private formatSelector (): boolean | Array<string> {
    const m = this.commonMatch(/^([^{]+)/, true)
    if (!m) return false
    return trim(m[0])
      .replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
      .replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, (r) => {
        return r.replace(/,/g, '\u200C')
      })
      .split(/\s*(?![^(]*\)),\s*/)
      .map((s: string) => {
        const selectorText = s.replace(/\u200C/g, ',')
        if (this.scopecssDisableNextLine) {
          return selectorText
        } else if (this.scopecssDisable) {
          if (
            !this.scopecssDisableSelectors.length ||
            this.scopecssDisableSelectors.includes(selectorText)
          ) {
            return selectorText
          }
        }

        if (selectorText === '*') {
          return this.prefix + ' *'
        } else if (bodySelectorREG.test(selectorText)) {
          return selectorText.replace(bodySelectorREG, this.prefix + ' micro-app-body')
        } else if (rootSelectorREG.test(selectorText)) { // ignore root selector
          return selectorText
        }
        return this.prefix + ' ' + selectorText
      })
  }

  private matchAtRule (): boolean | void {
    if (this.cssText[0] !== '@') return false
    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false

    return this.keyframesRule() ||
      this.mediaRule() ||
      this.customMediaRule() ||
      this.supportsRule() ||
      this.importRule() ||
      this.charsetRule() ||
      this.namespaceRule() ||
      this.documentRule() ||
      this.pageRule() ||
      this.hostRule() ||
      this.fontFaceRule()
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSKeyframesRule
  private keyframesRule (): boolean | void {
    if (!this.commonMatch(/^@([-\w]+)?keyframes\s*/)) return false

    if (!this.commonMatch(/^([-\w]+)\s*/)) return parseError('@keyframes missing name', this.linkPath)

    this.matchComments()

    if (!this.matchOpenBrace()) return parseError("@keyframes missing '{'", this.linkPath)

    this.matchComments()
    while (this.keyframeRule()) {
      this.matchComments()
    }

    if (!this.matchCloseBrace()) return parseError("@keyframes missing '}'", this.linkPath)

    this.matchLeadingSpaces()

    return true
  }

  private keyframeRule (): boolean {
    let r; const valList = []

    while (r = this.commonMatch(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/)) {
      valList.push(r[1])
      this.commonMatch(/^,\s*/)
    }

    if (!valList.length) return false

    this.styleDeclarations()

    this.matchLeadingSpaces()

    return true
  }

  // https://github.com/postcss/postcss-custom-media
  private customMediaRule (): boolean {
    if (!this.commonMatch(/^@custom-media\s+(--[^\s]+)\s*([^{;]+);/)) return false

    this.matchLeadingSpaces()

    return true
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSPageRule
  private pageRule (): boolean | void {
    if (!this.commonMatch(/^@page */)) return false

    this.formatSelector()

    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false

    return this.commonHandlerForAtRuleWithSelfRule('page')
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSFontFaceRule
  private fontFaceRule (): boolean | void {
    if (!this.commonMatch(/^@font-face\s*/)) return false

    return this.commonHandlerForAtRuleWithSelfRule('font-face')
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/CSSMediaRule
  private mediaRule = this.createMatcherForAtRuleWithChildRule(/^@media *([^{]+)/, 'media')
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSSupportsRule
  private supportsRule = this.createMatcherForAtRuleWithChildRule(/^@supports *([^{]+)/, 'supports')
  private documentRule = this.createMatcherForAtRuleWithChildRule(/^@([-\w]+)?document *([^{]+)/, 'document')
  private hostRule = this.createMatcherForAtRuleWithChildRule(/^@host\s*/, 'host')
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSImportRule
  private importRule = this.createMatcherForNoneBraceAtRule('import')
  // Removed in most browsers
  private charsetRule = this.createMatcherForNoneBraceAtRule('charset')
  // https://developer.mozilla.org/en-US/docs/Web/API/CSSNamespaceRule
  private namespaceRule = this.createMatcherForNoneBraceAtRule('namespace')

  // common matcher for @media, @supports, @document, @host
  private createMatcherForAtRuleWithChildRule (reg: RegExp, name: string): () => boolean | void {
    return () => {
      if (!this.commonMatch(reg)) return false

      if (!this.matchOpenBrace()) return parseError(`@${name} missing '{'`, this.linkPath)

      this.matchComments()

      this.matchRules()

      if (!this.matchCloseBrace()) return parseError(`@${name} missing '}'`, this.linkPath)

      this.matchLeadingSpaces()

      return true
    }
  }

  // common matcher for @import, @charset, @namespace
  private createMatcherForNoneBraceAtRule (name: string): () => boolean {
    const reg = new RegExp('^@' + name + '\\s*([^;]+);')
    return () => {
      if (!this.commonMatch(reg)) return false
      this.matchLeadingSpaces()
      return false
    }
  }

  // common handler for @font-face, @page
  private commonHandlerForAtRuleWithSelfRule (name: string): boolean | void {
    if (!this.matchOpenBrace()) return parseError(`@${name} missing '{'`, this.linkPath)

    this.matchComments()

    while (this.styleDeclaration()) {
      this.matchComments()
    }

    if (!this.matchCloseBrace()) return parseError(`@${name} missing '}'`, this.linkPath)

    this.matchLeadingSpaces()

    return true
  }

  // match and slice comments
  private matchComments (): void {
    while (this.matchComment());
  }

  // css comment
  private matchComment (): boolean | void {
    if (this.cssText.charAt(0) !== '/' || this.cssText.charAt(1) !== '*') return false
    // reset scopecssDisableNextLine
    this.scopecssDisableNextLine = false

    let i = 2
    while (this.cssText.charAt(i) !== '' && (this.cssText.charAt(i) !== '*' || this.cssText.charAt(i + 1) !== '/')) ++i
    i += 2

    if (this.cssText.charAt(i - 1) === '') {
      return parseError('End of comment missing', this.linkPath)
    }

    // get comment content
    let commentText = this.cssText.slice(2, i - 2)

    this.result += `/*${commentText}*/`

    commentText = trim(commentText.replace(/^\s*!/, ''))

    // set ignore config
    if (commentText === 'scopecss-disable-next-line') {
      this.scopecssDisableNextLine = true
    } else if (/^scopecss-disable/.test(commentText)) {
      if (commentText === 'scopecss-disable') {
        this.scopecssDisable = true
      } else {
        this.scopecssDisable = true
        const ignoreRules = commentText.replace('scopecss-disable', '').split(',')
        ignoreRules.forEach((rule: string) => {
          this.scopecssDisableSelectors.push(trim(rule))
        })
      }
    } else if (commentText === 'scopecss-enable') {
      this.scopecssDisable = false
      this.scopecssDisableSelectors = []
    }

    this.cssText = this.cssText.slice(i)

    this.matchLeadingSpaces()

    return true
  }

  private commonMatch (reg: RegExp, skip = false): RegExpExecArray | void {
    const matchArray = reg.exec(this.cssText)
    if (!matchArray) return
    const matchStr = matchArray[0]
    this.cssText = this.cssText.slice(matchStr.length)
    if (!skip) this.result += matchStr
    return matchArray
  }

  private matchOpenBrace () {
    return this.commonMatch(/^{\s*/)
  }

  private matchCloseBrace () {
    return this.commonMatch(/^}/)
  }

  // match and slice the leading spaces
  private matchLeadingSpaces (): void {
    this.commonMatch(/^\s*/)
  }
}

/**
 * common method of bind CSS
 */
function commonAction (
  styleElement: HTMLStyleElement,
  appName: string,
  prefix: string,
  baseURI: string,
  linkPath?: string,
) {
  if (!styleElement.__MICRO_APP_HAS_SCOPED__) {
    styleElement.__MICRO_APP_HAS_SCOPED__ = true
    let result: string | null = null
    try {
      result = parser.exec(
        styleElement.textContent!,
        prefix,
        baseURI,
        linkPath,
      )
      parser.reset()
    } catch (e) {
      parser.reset()
      logError('CSSParser: An error occurred while parsing CSS', appName, e)
    }

    if (result) styleElement.textContent = result
  }
}

let parser: CSSParser
/**
 * scopedCSS
 * @param styleElement target style element
 * @param appName app name
 */
export default function scopedCSS (
  styleElement: HTMLStyleElement,
  app: AppInterface,
): HTMLStyleElement {
  if (app.scopecss) {
    const prefix = `${microApp.tagName}[name=${app.name}]`

    if (!parser) parser = new CSSParser()

    if (styleElement.textContent) {
      commonAction(
        styleElement,
        app.name,
        prefix,
        app.url,
        styleElement.__MICRO_APP_LINK_PATH__,
      )
    } else {
      const observer = new MutationObserver(function () {
        observer.disconnect()
        // styled-component will be ignore
        if (styleElement.textContent && !styleElement.hasAttribute('data-styled')) {
          commonAction(
            styleElement,
            app.name,
            prefix,
            app.url,
            styleElement.__MICRO_APP_LINK_PATH__,
          )
        }
      })

      observer.observe(styleElement, { childList: true })
    }
  }

  return styleElement
}
