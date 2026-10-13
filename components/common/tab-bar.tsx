'use client'

import * as React from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function TabBar({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        'mt-8 mb-0 h-11 w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
      {...props}
    />
  )
}

function TabBarItem({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        'relative -mb-px h-11 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-0 py-0 text-[15px] font-medium leading-5 tracking-normal text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-[#8EA7FF] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground',
        className
      )}
      {...props}
    />
  )
}

export { TabBar, TabBarItem }
