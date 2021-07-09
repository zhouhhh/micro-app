import { appInstanceMap } from '../create_app'
import { CompletionPath, isSafari, pureCreateElement, getLinkFileDir, rawDocument } from '../libs/utils'
import microApp from '../micro_app'

// https://developer.mozilla.org/zh-CN/docs/Web/API/CSSRule
enum CSSRuleType {
  STYLE_RULE = 1,
  MEDIA_RULE = 4,
  SUPPORTS_RULE = 12,
}

/**
 * 绑定css作用域
 * 特殊情况:
 * 1. html-abc | abc-html
 * 2. html body.abc
 * 3. abchtml | htmlabc | abcbody | bodyabc
 * 4. html + body | html > body | html.body | html[name=xx] | body[name=xx]
 * 5. xxx, html xxx, body xxx
 *
 * TODO: BUG
  .test-b {
    border: 1px solid var(--color-a);
    border-bottom-color: var(--color-b);
  }
 */
function scopedStyleRule (rule: CSSStyleRule, prefix: string): string {
  const { selectorText, cssText } = rule
  if (/^((html[\s>~,]+body)|(html|body|:root))$/.test(selectorText)) {
    return cssText.replace(/^((html[\s>~,]+body)|(html|body|:root))/, prefix)
  } else if (selectorText === '*') {
    return cssText.replace('*', `${prefix} *`)
  }

  const builtInRootSelectorRE = /(^|\s+)((html[\s>~]+body)|(html|body|:root))(?=[\s>~]+|$)/

  return cssText.replace(/^[\s\S]+{/, (selectors) => {
    return selectors.replace(/(^|,)([^,]+)/g, (all, $1, $2) => {
      if (builtInRootSelectorRE.test($2)) {
        // body[name=xx]|body.xx|body#xx 等都不需要转换
        return all.replace(builtInRootSelectorRE, prefix)
      }
      return `${$1} ${prefix} ${$2.replace(/^\s*/, '')}`
    })
  })
}

/**
 * 补全静态资源地址
 * @param cssText css内容
 * @param baseURI 域名
 * @param textContent 原始内容
 * @param linkpath link资源地址，如果是link转换为的style，会带有linkpath
 */
function scopedHost (
  cssText: string,
  baseURI: string,
  textContent: string,
  linkpath: string | undefined,
) {
  return cssText.replace(/url\(["']?([^)"']+)["']?\)/gm, (all, $1) => {
    if (/^data:/.test($1)) {
      return all
    } else if (/^(https?:)?\/\//.test($1)) {
      if (isSafari()) {
        const purePath = $1.replace(/^https?:/, '')
        if (textContent.indexOf(purePath) === -1) {
          $1 = $1.replace(window.location.origin, '')
        } else {
          return all
        }
      } else {
        return all
      }
    }

    // ./a/b.png  ../a/b.png  a/b.png
    if (/^((\.\.?\/)|[^/])/.test($1) && linkpath) {
      baseURI = getLinkFileDir(linkpath)
    }

    return `url("${CompletionPath($1, baseURI)}")`
  })
}

// 处理media 和 supports
function scopedPackRule (
  rule: CSSMediaRule | CSSSupportsRule,
  prefix: string,
  packName: string,
): string {
  const result = scopedRule(Array.from(rule.cssRules), prefix)
  return `@${packName} ${rule.conditionText} {${result}}`
}

/**
 * 依次处理每个cssRule
 * @param rules cssRule
 * @param prefix 前缀
 */
function scopedRule (rules: CSSRule[], prefix: string): string {
  let result = ''
  for (const rule of rules) {
    switch (rule.type) {
      case CSSRuleType.STYLE_RULE:
        result += scopedStyleRule(rule as CSSStyleRule, prefix)
        break
      case CSSRuleType.MEDIA_RULE:
        result += scopedPackRule(rule as CSSMediaRule, prefix, 'media')
        break
      case CSSRuleType.SUPPORTS_RULE:
        result += scopedPackRule(rule as CSSSupportsRule, prefix, 'supports')
        break
      default:
        result += rule.cssText
        break
    }
  }

  return result.replace(/^\s+/, '')
}

/**
 * 绑定css通用方法
 */
function commonAction (
  packStyle: HTMLStyleElement,
  styleElement: HTMLStyleElement,
  originContent: string,
  prefix: string,
  baseURI: string,
  linkpath: string | undefined,
) {
  packStyle.textContent = originContent
  const rules: CSSRule[] = Array.from(packStyle.sheet?.cssRules ?? [])
  let result = scopedHost(
    scopedRule(rules, prefix),
    baseURI,
    originContent,
    linkpath,
  )
  /**
   * 解决部分safari浏览器下content引号丢失的问题
   * 参考文档 https://developer.mozilla.org/zh-CN/docs/Web/CSS/content
   * 如果依然有问题，推荐使用attr()方案降级处理
   */
  if (isSafari()) {
    result = result.replace(/([;{]\s*content:\s*)([^\s"][^";}]*)/gm, (all, $1, $2) => {
      if (
        $2 === 'none' ||
        /^(url\()|(counter\()|(attr\()|(open-quote)|(close-quote)/.test($2)
      ) {
        return all
      }
      return `${$1}"${$2}"`
    })
  }
  styleElement.textContent = result
  packStyle.textContent = ''
}

let packStyle: HTMLStyleElement = rawDocument.body.querySelector('#micro-app-template-style')

/**
 * 绑定css作用域
 * @param styleElement 目标style元素
 * @param appName 应用名称
 */
export default function scopedCSS (styleElement: HTMLStyleElement, appName: string): HTMLStyleElement {
  const app = appInstanceMap.get(appName)
  if (app?.scopecss) {
    const prefix = `${microApp.tagName}[name=${appName}]`
    if (!packStyle) {
      packStyle = pureCreateElement('style')
      packStyle.setAttribute('id', 'micro-app-template-style')
      rawDocument.body.appendChild(packStyle)
      packStyle.sheet!.disabled = true
    }

    if (styleElement.textContent) {
      commonAction(packStyle, styleElement, styleElement.textContent, prefix, app.url, styleElement.linkpath)
    } else {
      const observer = new MutationObserver(function () {
        commonAction(packStyle, styleElement, styleElement.textContent!, prefix, app.url, styleElement.linkpath)
        observer.disconnect()
      })

      observer.observe(styleElement, { childList: true })
    }
  }

  return styleElement
}
