import { createUnplugin } from 'unplugin'
import {
  type BaseOptions,
  type MarkRequired,
  REGEX_SETUP_SFC,
  REGEX_VUE_SFC,
  REGEX_VUE_SUB,
  createFilter,
  detectVueVersion,
} from '@vue-macros/common'
import { generatePluginName } from '#macros' assert { type: 'macro' }
import { transformDefineCustomEl, transformDefineCustomOption } from './core'

export type Options = BaseOptions
export type OptionsResolved = MarkRequired<Options, 'include' | 'version'>

function resolveOption(options: Options): OptionsResolved {
  const version = options.version || detectVueVersion()
  return {
    include: [REGEX_VUE_SFC, REGEX_SETUP_SFC, REGEX_VUE_SUB],
    ...options,
    version,
  }
}
const name = generatePluginName()

export default createUnplugin<Options | undefined, true>((userOptions = {}) => {
  const options = resolveOption(userOptions)
  const filter = createFilter(options)
  return [
    {
      name: `${name}:pre`,
      enforce: 'pre',
      transformInclude(id) {
        return filter(id)
      },

      transform(code, id) {
        return transformDefineCustomOption(code, id)
      },
    },
    {
      name: `${name}:post`,
      enforce: 'post',

      transformInclude(id) {
        return filter(id)
      },

      transform(code, id) {
        return transformDefineCustomEl(code, id)
      },
    },
  ]
})
