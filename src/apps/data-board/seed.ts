export interface Employee extends Record<string, unknown> {
  id: number
  name: string
  dept: string
  role: string
  salary: number
  joinedAt: string
}

export const DEPTS = ['技术部', '产品部', '设计部', '市场部'] as const

// 本地 JSON 种子数据（内存副本，不起 mock server）
export const SEED: Employee[] = [
  {
    id: 1,
    name: '张伟',
    dept: '技术部',
    role: '前端工程师',
    salary: 22000,
    joinedAt: '2021-03-15',
  },
  { id: 2, name: '李娜', dept: '产品部', role: '产品经理', salary: 25000, joinedAt: '2020-07-01' },
  {
    id: 3,
    name: '王强',
    dept: '技术部',
    role: '后端工程师',
    salary: 24000,
    joinedAt: '2019-11-20',
  },
  { id: 4, name: '刘洋', dept: '设计部', role: 'UI 设计师', salary: 18000, joinedAt: '2022-01-10' },
  { id: 5, name: '陈静', dept: '市场部', role: '市场专员', salary: 15000, joinedAt: '2022-05-06' },
  { id: 6, name: '杨帆', dept: '技术部', role: '架构师', salary: 38000, joinedAt: '2018-09-01' },
  { id: 7, name: '赵敏', dept: '产品部', role: '产品总监', salary: 40000, joinedAt: '2017-04-18' },
  {
    id: 8,
    name: '孙磊',
    dept: '设计部',
    role: '交互设计师',
    salary: 19000,
    joinedAt: '2021-08-23',
  },
  {
    id: 9,
    name: '周涛',
    dept: '技术部',
    role: '测试工程师',
    salary: 17000,
    joinedAt: '2022-02-14',
  },
  { id: 10, name: '吴倩', dept: '市场部', role: '品牌经理', salary: 23000, joinedAt: '2020-10-30' },
  { id: 11, name: '郑凯', dept: '技术部', role: 'DevOps', salary: 27000, joinedAt: '2021-06-08' },
  {
    id: 12,
    name: '冯雪',
    dept: '设计部',
    role: '视觉设计师',
    salary: 16000,
    joinedAt: '2023-03-01',
  },
  {
    id: 13,
    name: '蒋鹏',
    dept: '产品部',
    role: '数据分析师',
    salary: 21000,
    joinedAt: '2022-09-12',
  },
  { id: 14, name: '韩梅', dept: '市场部', role: '渠道运营', salary: 14000, joinedAt: '2023-01-05' },
  {
    id: 15,
    name: '许飞',
    dept: '技术部',
    role: '前端工程师',
    salary: 20000,
    joinedAt: '2022-11-16',
  },
  { id: 16, name: '何丽', dept: '产品部', role: '产品经理', salary: 24000, joinedAt: '2021-12-20' },
  {
    id: 17,
    name: '吕刚',
    dept: '技术部',
    role: '后端工程师',
    salary: 26000,
    joinedAt: '2019-05-09',
  },
  {
    id: 18,
    name: '施蕾',
    dept: '设计部',
    role: 'UI 设计师',
    salary: 18500,
    joinedAt: '2023-04-11',
  },
  { id: 19, name: '孔武', dept: '市场部', role: '市场专员', salary: 13500, joinedAt: '2023-06-01' },
  { id: 20, name: '曹颖', dept: '产品部', role: '产品助理', salary: 12000, joinedAt: '2023-07-15' },
]
