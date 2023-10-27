import {
  DEFINE_CUSTOM_EL,
  MagicString,
  babelParse,
  generateTransform,
  getLang,
  isCallOf,
  isFunctionType,
  walkAST,
} from '@vue-macros/common'
import type * as t from '@babel/types'

export function transformDefineCustomEl(code: string, id: string) {
  if (!code.includes(DEFINE_CUSTOM_EL)) return
  const lang = getLang(id)
  const program = babelParse(code, lang === 'vue' ? 'js' : lang)

  let defineComponentNodes: t.CallExpression | null = null
  let importNodes: t.ImportSpecifier | null = null
  const nodes: {
    parent: t.BlockStatement
    node: t.ExpressionStatement
    arg: t.Node
  }[] = []
  walkAST<t.Node>(program, {
    enter(node, parent) {
      if (
        parent?.type === 'ImportDeclaration' &&
        node.type === 'ImportSpecifier' &&
        node.imported.type === 'Identifier' &&
        node.imported.name === 'defineComponent' &&
        node.local.name === '_defineComponent'
      ) {
        importNodes = node
        return
      }
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
        !isCallOf(node.expression, DEFINE_CUSTOM_EL) ||
        parent?.type !== 'BlockStatement'
      )
        return

      nodes.push({
        parent,
        node,
        arg: node.expression.arguments[0],
      })
    },
  })
  if (nodes.length === 0 || !defineComponentNodes) return

  const s = new MagicString(code)

  for (const { parent, node, arg } of nodes) {
    // check arg 'name'
    debugger
    // check parent
    // const returnStmt = parent.body.find(
    //   (node) => node.type === 'ReturnStatement'
    // )
    // if (returnStmt) s.removeNode(returnStmt)

    // const index = returnStmt ? returnStmt.start! : parent.end! - 1
    // const shouldAddFn = !isFunctionType(arg) && arg.type !== 'Identifier'
    // s.appendLeft(index, `return ${shouldAddFn ? '() => (' : ''}`)
    // s.moveNode(arg, index)
    // if (shouldAddFn) s.appendRight(index, `)`)

    // removes `defineRender(`
    s.remove(node.start!, arg.start!)
    // removes `)`
    s.remove(arg.end!, node.end!)
  }

  const defineCEFn = 'defineCustomElement'
  // 替换导入
  importNodes && s.overwrite(importNodes.imported.start!, importNodes?.imported.end, defineCEFn);
  importNodes && s.overwrite(importNodes.local.start!, importNodes?.local.end, `_${defineCEFn}`);
  // 替换 defineComponent
  s.appendLeft((defineComponentNodes as t.CallExpression).start!, `_${defineCEFn}(`)
  // TODO 生成 styles 和 stylesAttrs
  s.appendRight(defineComponentNodes.end, `)`);
  // TODO: customElements.define('ce-app', ceApp)
  s.appendRight(defineComponentNodes.end, `)`);

  return generateTransform(s, id)
}
// TODO: 1.识别defineCustomEl 引入 defineCustomElement 或 引入 defineCustomElementSSR
// TODO: 2.修改导出结果
// TODO: 3.defineCustomElement 或 defineCustomElementSSR 包裹
// TODO: 4.styles 选项传入 defineCustomElement 或 defineCustomElementSSR 包裹
// TODO: 5.自动注册 customElement
// TODO: 6.如何不使用.ce.vue，自动生成样式 ❓
// TODO: 7.如何自动添加子组件的样式（1.分析引用关系，如果子组件只存在于CE树下，则阻断组件style在document.head的注入，将其收集放在 styles 上） ❓
// TODO: 8.如何设置的style标签的属性 ❓
