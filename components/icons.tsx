import {
  Search,
  Plus,
  Bell,
  HelpCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  ExternalLink,
  Home,
  Target,
  Folder,
  Users,
  Zap,
  Mail,
  MessageSquare,
  Code,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  ArrowUpDown,
  Columns,
  Trash2,
  Copy,
  Edit,
  Eye,
  Star,
  Heart,
  ThumbsUp,
  Share2,
  Link2,
  Hash,
  Layers,
  Grid,
  List,
  LayoutGrid,
  PanelLeft,
  ArrowLeft,
  X,
  Check,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Download,
  Upload,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Bookmark,
  Flag,
  Tag,
  type LucideIcon,
} from 'lucide-react'

// Youtorch-specific custom icons
export function YoutorchIcon({ className }: { className?: string }) {
  return (
    <img
      src="/youtorch-logo.png"
      alt=""
      className={className}
      draggable={false}
    />
  )
}

export function GoalsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export function TrelloIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="6" width="4" height="10" rx="1" fill="currentColor" />
      <rect x="14" y="6" width="4" height="6" rx="1" fill="currentColor" />
    </svg>
  )
}

export function ConfluenceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.093 18.937c-.31.46-.63.96-.89 1.38a.62.62 0 0 0 .21.85l3.6 2.19a.62.62 0 0 0 .85-.21c.21-.35.49-.79.81-1.26 2.14-3.17 4.3-2.76 8.17-.87l3.59 1.76a.62.62 0 0 0 .83-.29l1.76-3.87a.62.62 0 0 0-.29-.83c-4.01-1.97-7.17-3.53-10.72-3.53-3.24 0-5.87 1.94-7.91 4.72zM21.907 5.063c.31-.46.63-.96.89-1.38a.62.62 0 0 0-.21-.85l-3.6-2.19a.62.62 0 0 0-.85.21c-.21.35-.49.79-.81 1.26-2.14 3.17-4.3 2.76-8.17.87L5.533 1.2a.62.62 0 0 0-.83.29l-1.76 3.87a.62.62 0 0 0 .29.83c4.01 1.97 7.17 3.53 10.72 3.53 3.24 0 5.87-1.94 7.91-4.72z" />
    </svg>
  )
}

export function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  )
}

export function RovoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="url(#rovo-gradient)" />
      <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="rovo-gradient" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#FF5630" />
          <stop offset="1" stopColor="#FFAB00" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Icon mapping for dynamic usage
export const iconMap: Record<string, LucideIcon> = {
  search: Search,
  plus: Plus,
  bell: Bell,
  help: HelpCircle,
  settings: Settings,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  more: MoreHorizontal,
  external: ExternalLink,
  home: Home,
  target: Target,
  folder: Folder,
  users: Users,
  zap: Zap,
  mail: Mail,
  message: MessageSquare,
  code: Code,
  branch: GitBranch,
  warning: AlertTriangle,
  check: CheckCircle,
  clock: Clock,
  calendar: Calendar,
  filter: Filter,
  sort: ArrowUpDown,
  columns: Columns,
  trash: Trash2,
  copy: Copy,
  edit: Edit,
  eye: Eye,
  star: Star,
  heart: Heart,
  'thumbs-up': ThumbsUp,
  share: Share2,
  link: Link2,
  hash: Hash,
  layers: Layers,
  grid: Grid,
  list: List,
  'layout-grid': LayoutGrid,
  'panel-left': PanelLeft,
  'arrow-left': ArrowLeft,
  x: X,
  'check-mark': Check,
  sparkles: Sparkles,
  play: Play,
  pause: Pause,
  refresh: RefreshCw,
  download: Download,
  upload: Upload,
  file: FileText,
  image: Image,
  video: Video,
  music: Music,
  archive: Archive,
  bookmark: Bookmark,
  flag: Flag,
  tag: Tag,
}

export {
  Search,
  Plus,
  Bell,
  HelpCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  ExternalLink,
  Home,
  Target,
  Folder,
  Users,
  Zap,
  Mail,
  MessageSquare,
  Code,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  ArrowUpDown,
  Columns,
  Trash2,
  Copy,
  Edit,
  Eye,
  Star,
  Heart,
  ThumbsUp,
  Share2,
  Link2,
  Hash,
  Layers,
  Grid,
  List,
  LayoutGrid,
  PanelLeft,
  ArrowLeft,
  X,
  Check,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Download,
  Upload,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Bookmark,
  Flag,
  Tag,
}
