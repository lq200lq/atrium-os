import type { Component } from 'vue'
import {
  BatteryFull,
  Bell,
  Bot,
  Boxes,
  Check,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  NotebookPen,
  Presentation,
  Puzzle,
  ScrollText,
  Search,
  Sparkles,
  Trash2,
  Wifi,
  X,
} from 'lucide-vue-next'
import type { FsNode } from './fs/types'

export const ICON_MAP = {
  'battery-full': BatteryFull,
  bell: Bell,
  bot: Bot,
  boxes: Boxes,
  check: Check,
  file: File,
  'file-spreadsheet': FileSpreadsheet,
  'file-text': FileText,
  folder: Folder,
  'notebook-pen': NotebookPen,
  presentation: Presentation,
  puzzle: Puzzle,
  'scroll-text': ScrollText,
  search: Search,
  sparkles: Sparkles,
  'trash-2': Trash2,
  wifi: Wifi,
  x: X,
} as const satisfies Record<string, Component>

export type IconName = keyof typeof ICON_MAP

export function fileIconName(node: FsNode): IconName {
  if (node.type === 'dir') return 'folder'
  switch (node.name.split('.').pop()?.toLowerCase()) {
    case 'docx':
      return 'file-text'
    case 'xlsx':
      return 'file-spreadsheet'
    case 'pptx':
      return 'presentation'
    case 'pdf':
      return 'scroll-text'
    default:
      return 'file'
  }
}

export function fileIconClass(node: FsNode): string {
  if (node.type === 'dir') return 'text-amber-500'
  switch (node.name.split('.').pop()?.toLowerCase()) {
    case 'docx':
      return 'text-sky-500'
    case 'xlsx':
      return 'text-emerald-500'
    case 'pptx':
      return 'text-orange-500'
    case 'pdf':
      return 'text-rose-500'
    default:
      return 'text-slate-400'
  }
}
