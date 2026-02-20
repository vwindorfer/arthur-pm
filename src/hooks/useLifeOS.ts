import { useState, useEffect, useCallback, useRef } from 'react';
import { LifeOSData, Area, Task } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'life_os_data';

const INITIAL_DATA: LifeOSData = {
  areaGroups: [],
  areas: [
    {
      id: '1',
      title: 'Work',
      icon: 'briefcase',
      tasks: [],
      projects: [],
      resources: [],
      labels: []
    },
    {
      id: '2',
      title: 'Health',
      icon: 'heart',
      tasks: [],
      projects: [],
      resources: [],
      labels: []
    }
  ],
  inbox: []
};

function normalizeData(parsed: any): LifeOSData {
  const normalizeTask = (t: any): Task => ({
    ...t,
    description: t.description || '',
    labels: t.labels || [],
    attachments: t.attachments || [],
    contextTags: t.contextTags || []
  });

  return {
    ...parsed,
    areaGroups: parsed.areaGroups || [],
    inbox: (parsed.inbox || []).map(normalizeTask),
    areas: (parsed.areas || []).map((area: any) => ({
      ...area,
      labels: area.labels || [],
      description: area.description || '',
      tasks: (area.tasks || []).map(normalizeTask),
      projects: (area.projects || []).map((project: any) => ({
        ...project,
        status: project.status || 'Backlog',
        labels: project.labels || [],
        attachments: project.attachments || [],
        tasks: (project.tasks || []).map(normalizeTask),
        phases: (project.phases || []).map((phase: any) => ({
          ...phase,
          status: phase.status || 'Backlog',
          labels: phase.labels || [],
          attachments: phase.attachments || [],
          tasks: (phase.tasks || []).map(normalizeTask)
        }))
      }))
    }))
  };
}

export function useLifeOS() {
  const { user } = useAuth();
  const [data, setData] = useState<LifeOSData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeData(saved ? JSON.parse(saved) : INITIAL_DATA);
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFromCloud = useRef(false);

  // Load from Supabase when user logs in
  useEffect(() => {
    if (!user) {
      loadedFromCloud.current = false;
      return;
    }
    if (loadedFromCloud.current) return;

    const loadFromCloud = async () => {
      setSyncing(true);
      try {
        const { data: row, error } = await supabase
          .from('user_data')
          .select('data')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found (new user)
          setLastSyncError(error.message);
          return;
        }

        if (row?.data) {
          const cloudData = normalizeData(row.data);
          setData(cloudData);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
        } else {
          // New user: push local data to cloud
          const localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
          if (localData) {
            await supabase.from('user_data').upsert({
              user_id: user.id,
              data: localData,
              updated_at: new Date().toISOString()
            });
          }
        }
        loadedFromCloud.current = true;
        setLastSyncError(null);
      } catch (err: any) {
        setLastSyncError(err.message);
      } finally {
        setSyncing(false);
      }
    };

    loadFromCloud();
  }, [user]);

  // Save to localStorage immediately, debounce Supabase save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    if (!user) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const { error } = await supabase.from('user_data').upsert({
          user_id: user.id,
          data: data,
          updated_at: new Date().toISOString()
        });
        if (error) setLastSyncError(error.message);
        else setLastSyncError(null);
      } catch (err: any) {
        setLastSyncError(err.message);
      } finally {
        setSyncing(false);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [data, user]);

  const addArea = (title: string, icon: string, groupId?: string) => {
    const newArea: Area = {
      id: crypto.randomUUID(),
      title,
      icon,
      tasks: [],
      projects: [],
      resources: [],
      labels: [],
      groupId
    };
    setData(prev => ({ ...prev, areas: [...prev.areas, newArea] }));
  };

  const updateData = (newData: LifeOSData) => {
    setData(newData);
  };

  const deleteArea = (id: string) => {
    setData(prev => ({ ...prev, areas: prev.areas.filter(a => a.id !== id) }));
  };

  const deleteGroup = (id: string) => {
    setData(prev => ({
      ...prev,
      areaGroups: prev.areaGroups.filter(g => g.id !== id),
      areas: prev.areas.map(a => a.groupId === id ? { ...a, groupId: undefined } : a)
    }));
  };

  const deleteTask = (taskId: string) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData.inbox = newData.inbox.filter((t: any) => t.id !== taskId);
      newData.areas.forEach((area: any) => {
        area.tasks = area.tasks.filter((t: any) => t.id !== taskId);
        area.projects.forEach((project: any) => {
          project.tasks = project.tasks.filter((t: any) => t.id !== taskId);
          project.phases.forEach((phase: any) => {
            phase.tasks = phase.tasks.filter((t: any) => t.id !== taskId);
          });
        });
      });
      return newData;
    });
  };

  const deleteProject = (projectId: string) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData.areas.forEach((area: any) => {
        area.projects = area.projects.filter((p: any) => p.id !== projectId);
      });
      return newData;
    });
  };

  const deletePhase = (phaseId: string) => {
    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData.areas.forEach((area: any) => {
        area.projects.forEach((project: any) => {
          project.phases = project.phases.filter((ph: any) => ph.id !== phaseId);
        });
      });
      return newData;
    });
  };

  return { data, updateData, addArea, deleteArea, deleteGroup, deleteTask, deleteProject, deletePhase, syncing, lastSyncError };
}
