'use client'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Lightbulb, CheckSquare, Circle } from 'lucide-react'
import type { Activity } from '@/lib/types'

interface ActivityFeedProps {
  activities: Activity[]
  className?: string
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = 'BUGUN' // In real app, calculate from timestamp
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(activity)
    return groups
  }, {} as Record<string, Activity[]>)

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(groupedActivities).map(([date, items]) => (
        <div key={date}>
          <h3 className="mb-3 text-xs font-medium uppercase text-muted-foreground">
            {date}
          </h3>
          <div className="space-y-1">
            {items.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface ActivityItemProps {
  activity: Activity
}

function ActivityItem({ activity }: ActivityItemProps) {
  const getIcon = () => {
    // Determine icon based on project type or activity
    if (activity.projectName === 'testsdf') {
      return <Lightbulb className="h-4 w-4 text-warning" />
    }
    if (activity.projectName === 'Test') {
      return <Circle className="h-4 w-4 text-muted-foreground" />
    }
    return <CheckSquare className="h-4 w-4 text-success" />
  }

  return (
    <div className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50">
      {/* Icon */}
      <div className="flex h-6 w-6 items-center justify-center">
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {activity.title}
        </span>
        <p className="text-xs text-muted-foreground">
          {activity.projectKey} · {activity.projectName}
        </p>
      </div>

      {/* Timestamp & Avatar */}
      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
        <Avatar className="h-6 w-6">
          <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
          <AvatarFallback className="text-xs">
            {activity.user.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
