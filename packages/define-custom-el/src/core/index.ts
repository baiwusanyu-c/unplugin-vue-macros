import {
  DEFINE_CUSTOM_EL,
  MagicString,
  babelParse,
  generateTransform,
  getLang,
  isCallOf,
  parseSFC,
  walkAST,
} from '@vue-macros/common'
import type * as t from '@babel/types'

export function transformDefineCustomOption(code: string, id: string) {
  if (!code.includes(DEFINE_CUSTOM_EL)) return

  const lang = getLang(id)
  if (lang !== 'vue') return

  const sfcParseResult = parseSFC(code, id)
  if (!sfcParseResult || !sfcParseResult.scriptSetup) return

  const program = babelParse(sfcParseResult.scriptSetup.content, 'js')
  const nodes: {
    node: t.ExpressionStatement
  }[] = []
  walkAST<t.Node>(program!, {
    enter(node) {
      if (
        node.type === 'ExpressionStatement' &&
        isCallOf(node.expression, DEFINE_CUSTOM_EL)
      ) {
        nodes.push({
          node,
        })
      }
    },
  })
  if (nodes.length === 0) return
  const s = new MagicString(code)

  for (const { node } of nodes) {
    // replace `defineCustomEl` to `defineOptions`
    const start = node.start! + sfcParseResult.offset
    s.overwrite(start, start + DEFINE_CUSTOM_EL.length, 'defineOptions')
    s.prependLeft(start, `__${DEFINE_CUSTOM_EL}()\n`);
  }
  return generateTransform(s, id)
}

export function transformDefineCustomEl(code: string, id: string) {
  if (!code.includes(`__${DEFINE_CUSTOM_EL}`)) return
  const lang = getLang(id)
  const program = babelParse(code, lang === 'vue' ? 'js' : lang)

  let defineComponentNodes: t.CallExpression | null = null
  const nodes: { node: t.ExpressionStatement }[] = []
  walkAST<t.Node>(program, {
    enter(node, parent) {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === '_defineComponent'
      ) {
        defineComponentNodes = node
        return
      }

      if (
        node.type !== 'ExpressionStatement' ||
        !isCallOf(node.expression, `__${DEFINE_CUSTOM_EL}`) ||
        parent?.type !== 'BlockStatement'
      )
        return

      nodes.push({node})
    },
  })
  if (!defineComponentNodes) return

  const s = new MagicString(code)
  for (const { node } of nodes) {
    // removes `defineCustomEl()`
    s.remove(node.start!, node.end!)
  }

  const defineCEFn = 'defineSSRCustomElement'
  const importDefineCE = `import { ${defineCEFn} as _${defineCEFn} } from "vue";`
  // generate defineCustomElement import
  s.prependLeft(0, importDefineCE)

  s.appendRight(
    (defineComponentNodes as t.CallExpression).end!,
    `;\n customElements.define(
    _sfc_main.ceName, 
    _${defineCEFn}(_sfc_main)
    )`
  )

  return generateTransform(s, id)
}
// TODO: 1.识别 defineCustomEl 引入 defineSSRCustomElement✅
// TODO: 2.styles 选项传入 ✅
// TODO: 3.自动注册 customElement ✅

// TODO: 4.如何不使用.ce.vue，自动生成样式 ❓
// TODO: 5.如何自动添加子组件的样式（1.分析引用关系，如果子组件只存在于CE树下，则阻断组件style在document.head的注入，将其收集放在 styles 上） ❓

// TODO: 6.如何设置的style标签的属性 ❓
// TODO: 7.volar ❓
