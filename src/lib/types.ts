
export interface Player {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  characterId: string;
  isOnline: boolean;
  lastActive: number;
  x: number;
  y: number;
  direction: 'front' | 'back' | 'left' | 'right';
  isMicOn?: boolean;
  isCameraOn?: boolean;
}

export type GoogleApiStatus = 'loading' | 'error' | 'ready';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
}

export interface GoogleTaskList {
    id: string;
    title: string;
}
