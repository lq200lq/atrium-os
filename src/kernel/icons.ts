import type { Component } from 'vue'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Battery,
  BatteryCharging,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Eye,
  EyeOff,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  Globe,
  HardDrive,
  Image,
  Info,
  Languages,
  LayoutGrid,
  LoaderCircle,
  Lock,
  MemoryStick,
  Moon,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Presentation,
  Puzzle,
  RotateCcw,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  User,
  Wifi,
  WifiOff,
  X,
} from 'lucide-vue-next'
import type { FsNode } from './fs/types'

export const ICON_MAP = {
  activity: Activity,
  'alert-triangle': AlertTriangle,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  battery: Battery,
  'battery-charging': BatteryCharging,
  bell: Bell,
  'book-open': BookOpen,
  bot: Bot,
  boxes: Boxes,
  calendar: Calendar,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  clock: Clock,
  cpu: Cpu,
  eye: Eye,
  'eye-off': EyeOff,
  file: File,
  'file-spreadsheet': FileSpreadsheet,
  'file-text': FileText,
  folder: Folder,
  globe: Globe,
  'hard-drive': HardDrive,
  image: Image,
  info: Info,
  languages: Languages,
  'layout-grid': LayoutGrid,
  'loader-circle': LoaderCircle,
  lock: Lock,
  'memory-stick': MemoryStick,
  moon: Moon,
  'more-horizontal': MoreHorizontal,
  'notebook-pen': NotebookPen,
  plus: Plus,
  presentation: Presentation,
  puzzle: Puzzle,
  'rotate-ccw': RotateCcw,
  'scroll-text': ScrollText,
  search: Search,
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  sun: Sun,
  'trash-2': Trash2,
  user: User,
  wifi: Wifi,
  'wifi-off': WifiOff,
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
