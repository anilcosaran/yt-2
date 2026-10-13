'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Filter, 
  ArrowUpDown, 
  Columns3, 
  ChevronDown,
  Settings2,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UiText } from '@/components/i18n/ui-text'

interface DataTableToolbarProps {
  onCreateClick?: () => void
  createLabel?: string
  showGroupBy?: boolean
  showFilter?: boolean
  showSort?: boolean
  showColumns?: boolean
  showSettings?: boolean
  columnCount?: number
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  className?: string
  filterMenu?: React.ReactNode
  sortMenu?: React.ReactNode
  groupByMenu?: React.ReactNode
  columnsMenu?: React.ReactNode
}

export function DataTableToolbar({
  onCreateClick,
  createLabel = 'Olustur',
  showGroupBy = true,
  showFilter = true,
  showSort = true,
  showColumns = true,
  showSettings = true,
  columnCount = 6,
  searchPlaceholder = 'Bu gorunumdeki bir fikri bulun',
  onSearch,
  className,
  filterMenu,
  sortMenu,
  groupByMenu,
  columnsMenu,
}: DataTableToolbarProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2', className)}>
      {/* Left Side */}
      <div className="flex items-center gap-2">
        {/* Create Button */}
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onCreateClick}
        >
          {createLabel}
        </Button>

        {/* Group By */}
        {showGroupBy && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-dashed">
                <span><UiText id="suna_gore_grupla_953f5620" /></span>
                <Plus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {groupByMenu || (
                <>
                  <DropdownMenuItem><UiText id="tema_6ae1bcaf" /></DropdownMenuItem>
                  <DropdownMenuItem><UiText id="durum_1f8de55f" /></DropdownMenuItem>
                  <DropdownMenuItem><UiText id="atanan_296c39e5" /></DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Filter */}
        {showFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                <span><UiText id="filtre_9b759d62" /></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {filterMenu || (
                <>
                  <DropdownMenuItem><UiText id="aktif_89f29d42" /></DropdownMenuItem>
                  <DropdownMenuItem><UiText id="tamamlandi_ac09cd02" /></DropdownMenuItem>
                  <DropdownMenuItem><UiText id="beklemede_8d68c1ce" /></DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Sort */}
        {showSort && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <span><UiText id="sirala_07b122af" /></span>
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {sortMenu || (
                <>
                  <DropdownMenuItem><UiText id="rice_skoru_yuksekten_dusuge_db2561a4" /></DropdownMenuItem>
                  <DropdownMenuItem><UiText id="rice_skoru_dusukten_yuksege_68485f2d" /></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><UiText id="olusturma_tarihi_530bdd1f" /></DropdownMenuItem>
                  <DropdownMenuItem><UiText id="guncelleme_tarihi_0d8a83ac" /></DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Columns */}
        {showColumns && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <span><UiText id="alanlar_4649d3e8" /></span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{columnCount}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {columnsMenu || (
                <>
                  <DropdownMenuCheckboxItem checked><UiText id="ozet_901db109" /></DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked><UiText id="tema_6ae1bcaf" /></DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked><UiText id="rice_skoru_5278735d" /></DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked><UiText id="etki_f2cb17d3" /></DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked><UiText id="ongoruler_9093d6e4" /></DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked><UiText id="musteri_segmentleri_3d221038" /></DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Settings */}
        {showSettings && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Right Side - Search */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="h-8 w-64 pl-8 text-sm"
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
