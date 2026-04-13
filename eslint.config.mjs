import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**', 'coverage/**'],
  },
  ...nextVitals,
  ...nextTypescript,
]

export default config
