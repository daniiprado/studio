'use client';
import { useAuth } from '@/hooks/use-auth';
import { useGoogleApis } from '@/hooks/use-google-apis';
import { ScrollArea } from './ui/scroll-area';
import { Calendar, CheckSquare, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const RightSidebar = () => {
    const { accessToken } = useAuth();
    const { gapiReady, events, tasks } = useGoogleApis(accessToken);
    
    const formatTime = (dateTimeString?: string) => {
        if (!dateTimeString) return 'All day';
        return format(parseISO(dateTimeString), 'h:mm a');
    }

    return (
        <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
            <header className="p-4 border-b border-sidebar-border">
                <h2 className="font-headline text-xl text-sidebar-primary-foreground">Daily Quests</h2>
                <p className="text-sm text-muted-foreground">Synced from Google</p>
            </header>
            
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {gapiReady === 'loading' && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="animate-spin text-accent" />
                            <p className="ml-2">Connecting to Google...</p>
                        </div>
                    )}
                    {gapiReady === 'error' && (
                        <div className="text-destructive-foreground p-4 bg-destructive rounded-md">
                            Could not connect to Google APIs. Please try refreshing or re-logging.
                        </div>
                    )}
                    {gapiReady === 'ready' && (
                        <>
                            <div>
                                <h3 className="flex items-center font-headline text-lg mb-2 text-accent">
                                    <Calendar className="mr-2 h-5 w-5"/>
                                    Today's Events
                                </h3>
                                <div className="space-y-2">
                                    {events.length > 0 ? events.map(event => (
                                        <div key={event.id} className="p-3 rounded-md bg-sidebar-accent/30 border border-sidebar-border">
                                            <p className="font-semibold text-sidebar-accent-foreground">{event.summary}</p>
                                            <p className="text-xs text-muted-foreground">{formatTime(event.start?.dateTime)} - {formatTime(event.end?.dateTime)}</p>
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground">No events for today.</p>}
                                </div>
                            </div>

                            <div>
                                <h3 className="flex items-center font-headline text-lg mb-2 text-accent">
                                    <CheckSquare className="mr-2 h-5 w-5"/>
                                    Active Tasks
                                </h3>
                                <div className="space-y-2">
                                    {tasks.length > 0 ? tasks.map(task => (
                                        <div key={task.id} className="p-3 rounded-md bg-sidebar-accent/30 border border-sidebar-border">
                                            <p className="font-semibold text-sidebar-accent-foreground">{task.title}</p>
                                            {task.due && <p className="text-xs text-muted-foreground">Due: {format(parseISO(task.due), 'MMM d, yyyy')}</p>}
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground">No active tasks.</p>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

export default RightSidebar;
