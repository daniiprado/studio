'use client';
import { useState, useEffect, useCallback } from 'react';
import { GoogleCalendarEvent, GoogleTask, GoogleTaskList, GoogleApiStatus } from '@/lib/types';

const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest"
];

export function useGoogleApis(accessToken: string | null) {
  const [gapiReady, setGapiReady] = useState<GoogleApiStatus>('loading');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);

  const initClient = useCallback(() => {
    if (window.gapi && accessToken) {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapi.client.setToken({ access_token: accessToken });
          setGapiReady('ready');
        } catch (error) {
          console.error("Error initializing Google API client", error);
          setGapiReady('error');
        }
      });
    }
  }, [accessToken]);

  useEffect(() => {
    initClient();
  }, [initClient]);

  const fetchCalendarEvents = useCallback(async () => {
    if (gapiReady !== 'ready') return;
    try {
      const today = new Date();
      const timeMin = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const timeMax = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const response = await gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': timeMin,
        'timeMax': timeMax,
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 10,
        'orderBy': 'startTime'
      });
      setEvents(response.result.items || []);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    }
  }, [gapiReady]);

  const fetchTasks = useCallback(async () => {
    if (gapiReady !== 'ready' || !taskLists.length) return;
    try {
        const allTasks: GoogleTask[] = [];
        for (const list of taskLists) {
            const response = await gapi.client.tasks.tasks.list({
                tasklist: list.id,
                showCompleted: false,
            });
            if (response.result.items) {
                allTasks.push(...response.result.items);
            }
        }
        setTasks(allTasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
    }
}, [gapiReady, taskLists]);


  const fetchTaskLists = useCallback(async () => {
    if (gapiReady !== 'ready') return;
    try {
        const response = await gapi.client.tasks.tasklists.list();
        setTaskLists(response.result.items || []);
    } catch (error) {
        console.error("Error fetching task lists:", error);
    }
}, [gapiReady]);


  useEffect(() => {
    if (gapiReady === 'ready') {
      fetchCalendarEvents();
      fetchTaskLists();
    }
  }, [gapiReady, fetchCalendarEvents, fetchTaskLists]);

  useEffect(() => {
    if(taskLists.length > 0) {
        fetchTasks();
    }
  }, [taskLists, fetchTasks]);

  return { gapiReady, events, tasks };
}
