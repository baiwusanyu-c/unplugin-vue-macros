import { createUnplugin } from 'unplugin'
import {
  REGEX_SETUP_SFC,
  REGEX_VUE_SFC,
  REGEX_VUE_SUB,
  createFilter,
  detectVueVersion,
} from '@vue-macros/common'
import { RollupResolve, setResolveTSFileIdImpl } from '@vue-macros/api'
import { transformDefineProp } from './core'
import type { Edition } from './core'
import type { PluginContext } from 'rollup'
import type { BaseOptions, MarkRequired } from '@vue-macros/common'
import type { UnpluginContextMeta } from 'unplugin'

export interface Options extends BaseOptions {
  isProduction?: boolean
  edition?: Edition
}

export type OptionsResolved = MarkRequired<
  Options,
  'include' | 'version' | 'isProduction' | 'edition'
>

function resolveOption(
  options: Options,
  framework: UnpluginContextMeta['framework']
): OptionsResolved {
  const version = options.version || detectVueVersion()
  return {
    include: [REGEX_VUE_SFC, REGEX_SETUP_SFC].concat(
      version === 2 && framework === 'webpack' ? REGEX_VUE_SUB : []
    ),
    isProduction: process.env.NODE_ENV === 'production',
    edition: 'kevinEdition',
    ...options,
    version,
  }
}

const name = 'unplugin-vue-define-prop'

export default createUnplugin<Options | undefined, false>(
  (userOptions = {}, { framework }) => {
    const options = resolveOption(userOptions, framework)
    const filter = createFilter(options)
    const { resolve, handleHotUpdate } = RollupResolve()

    return {
      name,
      enforce: 'pre',

      buildStart() {
        if (framework === 'rollup' || framework === 'vite') {
          setResolveTSFileIdImpl(resolve(this as PluginContext))
        }
      },

      transformInclude(id) {
        return filter(id)
      },

      transform(code, id) {
        return transformDefineProp(
          code,
          id,
          options.edition,
          options.isProduction
        )
      },

      vite: {
        configResolved(config) {
          options.isProduction = config.isProduction
        },

        handleHotUpdate,
      },
    }
  }
)
