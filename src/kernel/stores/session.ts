import { defineStore } from 'pinia'
import { idbGet, idbSet } from '../fs/idb'
import { persistBoundary } from './persistHelper'

const SESSION_KEY = 'session-v1'

/** 任何可鉴权对象：应用与小组件 manifest 都只有这一个字段参与判定 */
export interface Permissioned {
  permissions?: string[]
}

export interface Role {
  id: string
  name: string
  /** 权限点集合；`*` 表示全部权限 */
  permissions: string[]
}

export interface User {
  id: string
  name: string
  desc: string
  roles: string[]
}

// 纯前端 fixture：不做登录协议，角色数据来自本地
export const ROLES: Role[] = [
  { id: 'admin', name: '管理员', permissions: ['*'] },
  {
    id: 'editor',
    name: '编辑者',
    permissions: ['app:file-manager', 'app:doc-editor', 'app:ai-assistant'],
  },
  { id: 'viewer', name: '访客', permissions: [] },
]

export const USERS: User[] = [
  { id: 'admin', name: '管理员', desc: '拥有全部应用访问权限', roles: ['admin'] },
  { id: 'editor', name: '编辑者', desc: '可访问文件、文档与 AI 助手', roles: ['editor'] },
  { id: 'guest', name: '访客', desc: '仅可访问公开应用（应用中心、设置）', roles: ['viewer'] },
]

export const useSession = defineStore('session', {
  state: () => ({
    currentUserId: 'admin',
  }),
  getters: {
    currentUser(state): User {
      return USERS.find((u) => u.id === state.currentUserId) ?? USERS[0]
    },
    currentRoles(): Role[] {
      return this.currentUser.roles
        .map((rid) => ROLES.find((r) => r.id === rid))
        .filter((r): r is Role => Boolean(r))
    },
    effectivePermissions(): string[] {
      const set = new Set<string>()
      for (const role of this.currentRoles) for (const p of role.permissions) set.add(p)
      return [...set]
    },
  },
  actions: {
    setUser(id: string) {
      if (!USERS.some((u) => u.id === id)) return
      this.currentUserId = id
      void this.persist()
    },

    has(perm: string): boolean {
      const perms = this.effectivePermissions
      return perms.includes('*') || perms.includes(perm)
    },

    /** 唯一鉴权判定：无 permissions 视为公开，否则要求全部权限点命中。应用与小组件共用 */
    canAccess(target?: Permissioned | null): boolean {
      if (!target) return false
      const required = target.permissions ?? []
      if (required.length === 0) return true
      return required.every((p) => this.has(p))
    },

    async persist() {
      await persistBoundary('session', '持久化失败', () =>
        idbSet(SESSION_KEY, { userId: this.currentUserId }),
      )
    },

    async restore() {
      await persistBoundary('session', '恢复失败', async () => {
        const saved = await idbGet<{ userId?: unknown }>(SESSION_KEY)
        if (saved && typeof saved.userId === 'string' && USERS.some((u) => u.id === saved.userId)) {
          this.currentUserId = saved.userId
        }
      })
    },
  },
})
