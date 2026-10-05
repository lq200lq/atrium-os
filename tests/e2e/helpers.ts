import type { Page } from '@playwright/test'

// 按主题拆分后的 e2e spec 共享的定位/装配助手。
// 仓库规则「同类信息收敛一处」：新 spec 一律从这里导入，不再各自复制。

/** Dock 磁贴（按钮以 title 属性标注应用名） */
export const dockTile = (name: string) => `nav button[title="${name}"]`

/** 冷启动进入壳层（各 spec 文件在 beforeEach 中调用） */
export const gotoShell = (page: Page) => page.goto('/')
