// 提交信息门禁：对齐仓库既有的中文「类型：描述」单行约定。
// 全角冒号必须覆盖 headerPattern——conventional-commits-parser 默认按半角 `:` 拆分，
// 不改则 type 恒为空、type-empty 全红。
const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
]

export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern: /^([a-z]+)(?:\(([^)]*)\))?(!)?：(.+)$/,
      headerCorrespondence: ['type', 'scope', 'breaking', 'subject'],
    },
  },
  rules: {
    'type-empty': [2, 'never'],
    'type-enum': [2, 'always', TYPES],
    'subject-empty': [2, 'never'],
    // 中文描述信息密度高，放宽到 100；正文行长不限制（变更明细常一行写多个要点）
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    // 阶段提交常带括号分组描述，不强制 scope 枚举
    'scope-case': [0],
    // 中文描述里嵌组件名（OsAlert/OsProgress）会被判成 pascal-case，属误报
    'subject-case': [0],
    'subject-full-stop': [0],
  },
}
