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
  Settings,
  Shield,
  Sparkles,
  Trash2,
  User,
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
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  'trash-2': Trash2,
  user: User,
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
  if (node.type === 'dir') return 'text-file-dir'
  switch (node.name.split('.').pop()?.toLowerCase()) {
    case 'docx':
      return 'text-file-docx'
    case 'xlsx':
      return 'text-file-xlsx'
    case 'pptx':
      return 'text-file-pptx'
    case 'pdf':
      return 'text-file-pdf'
    default:
      return 'text-file-other'
  }
}
