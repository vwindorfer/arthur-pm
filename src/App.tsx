/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  Inbox,
  Briefcase,
  Heart,
  Plus,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  Zap,
  Link as LinkIcon,
  FileText,
  MoreVertical,
  Search,
  Settings,
  ArrowLeft,
  Layers,
  Target,
  Trash2,
  Edit2,
  X,
  Kanban as KanbanIcon,
  Upload,
  Filter,
  ArrowUpDown,
  Rows,
  File,
  ChevronDown,
  LogOut,
  Cloud,
  CloudOff,
  Loader2,
  GripVertical,
  Eye,
  EyeOff,
  ExternalLink,
  Image,
  Youtube,
  FileSpreadsheet,
  FileType,
  Download,
  ChevronUp,
  Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLifeOS } from './hooks/useLifeOS';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import { Area, Project, Phase, Task, Priority, Energy, Resource, Attachment, LifeOSData, AreaGroup, AppSettings, DisplaySettings, ProjectEvent } from './types';
import { format } from 'date-fns';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const matchesSearch = (text: string, query: string) => {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.toLowerCase());
};

const taskMatchesSearch = (task: Task, query: string) => {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return task.title.toLowerCase().includes(q) ||
    (task.description || '').toLowerCase().includes(q) ||
    task.labels.some(l => l.toLowerCase().includes(q));
};

// --- Components ---

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", className)}>
    {children}
  </span>
);

const IconButton = ({ icon: Icon, onClick, className }: { icon: any, onClick?: (e: React.MouseEvent) => void, className?: string }) => (
  <button 
    onClick={onClick}
    className={cn("p-1.5 rounded-lg hover:bg-black/5 transition-colors text-gray-500", className)}
  >
    <Icon size={18} />
  </button>
);

// --- Main App ---

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data, updateData, addArea, deleteTask, deleteProject, deleteArea, deleteGroup, deletePhase, syncing, lastSyncError } = useLifeOS();

  const [activeView, setActiveView] = useState<{
    type: 'inbox' | 'area' | 'project' | 'phase' | 'kanban' | 'settings' | 'completed' | 'graph';
    id?: string;
    parentId?: string;
    grandParentId?: string;
  }>({ type: 'inbox' });

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingArea, setIsAddingArea] = useState<{ groupId?: string } | null>(null);
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');

  // Modals state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<{ target: 'inbox' | 'area' | 'project' | 'phase', id?: string } | null>(null);
  const [isAddingProject, setIsAddingProject] = useState<string | null>(null);
  const [isAddingPhase, setIsAddingPhase] = useState<string | null>(null);

  // Inbox View State
  const [inboxSort, setInboxSort] = useState<'deadline' | 'energy' | 'priority'>('deadline');
  const [inboxGroup, setInboxGroup] = useState<'none' | 'project' | 'phase' | 'status' | 'label'>('none');
  const [inboxFilter, setInboxFilter] = useState<{ project?: string, phase?: string, status?: string, label?: string }>({});
  const [inboxShowBacklog, setInboxShowBacklog] = useState(false);
  const [inboxDeadlineView, setInboxDeadlineView] = useState<'all' | 'today' | 'overdue' | 'no-date'>('all');

  // Kanban View State
  const [kanbanGroup, setKanbanGroup] = useState<'status' | 'area' | 'project' | 'priority' | 'energy' | 'label'>('status');
  const [kanbanFilter, setKanbanFilter] = useState<{ status?: string, label?: string, priority?: string, energy?: string }>({});
  const [kanbanShowBacklog, setKanbanShowBacklog] = useState(false);
  const [kanbanDeadlineView, setKanbanDeadlineView] = useState<'all' | 'today' | 'overdue' | 'no-date'>('all');

  // Area View State
  const [areaProjectFilter, setAreaProjectFilter] = useState<string>('');

  // Resource/File preview modal
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [addingResourceTo, setAddingResourceTo] = useState<{ type: 'area' | 'project', id: string } | null>(null);

  // Event editing state
  const [editingEvent, setEditingEvent] = useState<{ projectId: string, event: ProjectEvent | null } | null>(null);

  // Drag reorder state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Settings helper
  const appSettings = data.settings || {
    taskStatuses: ['Backlog', 'In Progress', 'Done'],
    projectStatuses: ['Backlog', 'In Progress', 'Done'],
    phaseStatuses: ['Backlog', 'In Progress', 'Done'],
    display: { showPriority: true, showEnergy: true, showDeadline: true, showLabels: true, showAttachments: true, showDescription: true }
  };
  const display = appSettings.display;

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAreaTitle.trim()) {
      addArea(newAreaTitle.trim(), 'briefcase', isAddingArea?.groupId);
      setNewAreaTitle('');
      setIsAddingArea(null);
    }
  };

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupTitle.trim()) {
      const newGroup = { id: generateId(), title: newGroupTitle.trim() };
      updateData({ ...data, areaGroups: [...(data.areaGroups || []), newGroup] });
      setNewGroupTitle('');
      setIsAddingGroup(false);
    }
  };

  const updateArea = (updatedArea: Area) => {
    const newData = JSON.parse(JSON.stringify(data));
    const idx = newData.areas.findIndex((a: any) => a.id === updatedArea.id);
    if (idx !== -1) newData.areas[idx] = updatedArea;
    updateData(newData);
    setEditingArea(null);
  };

  // Navigation Helpers
  const currentArea = useMemo(() => 
    activeView.type === 'area' ? data.areas.find(a => a.id === activeView.id) : 
    activeView.type === 'project' ? data.areas.find(a => a.id === activeView.parentId) :
    activeView.type === 'phase' ? data.areas.find(a => a.id === activeView.grandParentId) :
    null
  , [activeView, data.areas]);

  const currentProject = useMemo(() => 
    activeView.type === 'project' ? currentArea?.projects.find(p => p.id === activeView.id) :
    activeView.type === 'phase' ? currentArea?.projects.find(p => p.id === activeView.parentId) :
    null
  , [activeView, currentArea]);

  const currentPhase = useMemo(() => 
    activeView.type === 'phase' ? currentProject?.phases.find(ph => ph.id === activeView.id) :
    null
  , [activeView, currentProject]);

  // Handlers
  const handleAddTask = (title: string, target: 'inbox' | 'area' | 'project' | 'phase', id?: string, labels?: string[]) => {
    const newTask: Task = {
      id: generateId(),
      title: title || 'New Task',
      description: '',
      status: 'Backlog',
      priority: 'P2',
      contextTags: [],
      energy: 'Low',
      labels: labels || [],
      createdAt: new Date().toISOString()
    };

    const newData = JSON.parse(JSON.stringify(data));
    if (target === 'inbox') {
      newData.inbox.unshift(newTask);
    } else if (target === 'area' && id) {
      const area = newData.areas.find((a: any) => a.id === id);
      if (area) area.tasks.unshift(newTask);
    } else if (target === 'project' && id) {
      newData.areas.forEach((area: any) => {
        const project = area.projects.find((p: any) => p.id === id);
        if (project) project.tasks.unshift(newTask);
      });
    } else if (target === 'phase' && id) {
      newData.areas.forEach((area: any) => {
        area.projects.forEach((project: any) => {
          const phase = project.phases.find((ph: any) => ph.id === id);
          if (phase) phase.tasks.unshift(newTask);
        });
      });
    }
    updateData(newData);
    setIsAddingTask(null);
  };

  const handleAddProject = (title: string, areaId: string) => {
    const newProject: Project = {
      id: generateId(),
      title: title || 'New Project',
      description: '',
      status: 'Backlog',
      tasks: [],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      phases: [],
      resources: [],
      labels: []
    };
    const newData = { ...data };
    const area = newData.areas.find(a => a.id === areaId);
    if (area) {
      area.projects = [newProject, ...area.projects];
      updateData(newData);
    }
    setIsAddingProject(null);
  };

  const handleAddPhase = (title: string, projectId: string) => {
    const newPhase: Phase = {
      id: generateId(),
      title: title || 'New Phase',
      description: '',
      status: 'Backlog',
      tasks: [],
      labels: []
    };
    const newData = { ...data };
    newData.areas.forEach(area => {
      const project = area.projects.find(p => p.id === projectId);
      if (project) {
        project.phases = [...project.phases, newPhase];
      }
    });
    updateData(newData);
    setIsAddingPhase(null);
  };

  const handleFileUpload = (file: File, targetId: string, type: 'project' | 'phase' | 'task') => {
    const attachment: Attachment = {
      id: generateId(),
      name: file.name,
      url: URL.createObjectURL(file), // In a real app, this would be a server URL
      type: file.type,
      size: file.size,
      createdAt: new Date().toISOString()
    };

    const newData = JSON.parse(JSON.stringify(data));
    if (type === 'task') {
      const updateInList = (tasks: Task[]) => {
        const task = tasks.find(t => t.id === targetId);
        if (task) {
          task.attachments = [...(task.attachments || []), attachment];
        }
      };
      updateInList(newData.inbox);
      newData.areas.forEach((area: any) => area.projects.forEach((project: any) => project.phases.forEach((phase: any) => updateInList(phase.tasks))));
    } else if (type === 'project') {
      newData.areas.forEach((area: any) => {
        const project = area.projects.find((p: any) => p.id === targetId);
        if (project) {
          project.attachments = [...(project.attachments || []), attachment];
        }
      });
    } else if (type === 'phase') {
      newData.areas.forEach((area: any) => {
        area.projects.forEach((project: any) => {
          const phase = project.phases.find((ph: any) => ph.id === targetId);
          if (phase) {
            phase.attachments = [...(phase.attachments || []), attachment];
          }
        });
      });
    }
    updateData(newData);
  };

  const updateTask = (updatedTask: Task) => {
    const newData = JSON.parse(JSON.stringify(data));
    const updateInList = (tasks: Task[]) => {
      const idx = tasks.findIndex(t => t.id === updatedTask.id);
      if (idx !== -1) tasks[idx] = updatedTask;
    };

    updateInList(newData.inbox);
    newData.areas.forEach((area: any) => {
      updateInList(area.tasks || []);
      area.projects.forEach((project: any) => {
        updateInList(project.tasks || []);
        project.phases.forEach((phase: any) => {
          updateInList(phase.tasks);
        });
      });
    });
    updateData(newData);
    setEditingTask(null);
  };

  const updateProject = (updatedProject: Project) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.areas.forEach((area: any) => {
      const idx = area.projects.findIndex((p: any) => p.id === updatedProject.id);
      if (idx !== -1) area.projects[idx] = updatedProject;
    });
    updateData(newData);
    setEditingProject(null);
  };

  const updatePhase = (updatedPhase: Phase) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.areas.forEach((area: any) => {
      area.projects.forEach((project: any) => {
        const idx = project.phases.findIndex((ph: any) => ph.id === updatedPhase.id);
        if (idx !== -1) project.phases[idx] = updatedPhase;
      });
    });
    updateData(newData);
    setEditingPhase(null);
  };

  const moveTask = (taskId: string, targetType: 'inbox' | 'area' | 'project' | 'phase', targetId?: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    let taskToMove: Task | null = null;

    const removeFromList = (tasks: Task[]) => {
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        taskToMove = tasks.splice(idx, 1)[0];
        return true;
      }
      return false;
    };

    removeFromList(newData.inbox);
    newData.areas.forEach((area: any) => {
      removeFromList(area.tasks || []);
      area.projects.forEach((project: any) => {
        removeFromList(project.tasks || []);
        project.phases.forEach((phase: any) => removeFromList(phase.tasks));
      });
    });

    if (taskToMove) {
      if (targetType === 'inbox') {
        newData.inbox.unshift(taskToMove);
      } else if (targetType === 'area' && targetId) {
        const area = newData.areas.find((a: any) => a.id === targetId);
        if (area) area.tasks.unshift(taskToMove);
      } else if (targetType === 'project' && targetId) {
        newData.areas.forEach((area: any) => {
          const project = area.projects.find((p: any) => p.id === targetId);
          if (project) project.tasks.unshift(taskToMove);
        });
      } else if (targetType === 'phase' && targetId) {
        newData.areas.forEach((area: any) => {
          area.projects.forEach((project: any) => {
            const phase = project.phases.find((ph: any) => ph.id === targetId);
            if (phase) phase.tasks.unshift(taskToMove);
          });
        });
      }
      updateData(newData);
    }
    setEditingTask(null);
  };

  const moveProject = (projectId: string, targetAreaId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    let projectToMove: Project | null = null;

    newData.areas.forEach((area: any) => {
      const idx = area.projects.findIndex((p: any) => p.id === projectId);
      if (idx !== -1) {
        projectToMove = area.projects.splice(idx, 1)[0];
      }
    });

    if (projectToMove) {
      const targetArea = newData.areas.find((a: any) => a.id === targetAreaId);
      if (targetArea) {
        targetArea.projects.unshift(projectToMove);
        updateData(newData);
      }
    }
    setEditingProject(null);
  };

  const toggleTaskStatus = (taskId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    const updateTaskStatus = (tasks: Task[]) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.status = task.status === 'Done' ? 'In Progress' : 'Done';
      }
    };

    updateTaskStatus(newData.inbox);
    newData.areas.forEach((area: any) => {
      updateTaskStatus(area.tasks || []);
      area.projects.forEach((project: any) => {
        updateTaskStatus(project.tasks || []);
        project.phases.forEach((phase: any) => {
          updateTaskStatus(phase.tasks);
        });
      });
    });
    updateData(newData);
  };

  // Resource handlers
  const handleAddResource = (resource: Resource, targetType: 'area' | 'project', targetId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (targetType === 'area') {
      const area = newData.areas.find((a: any) => a.id === targetId);
      if (area) area.resources.push(resource);
    } else {
      newData.areas.forEach((area: any) => {
        const project = area.projects.find((p: any) => p.id === targetId);
        if (project) project.resources.push(resource);
      });
    }
    updateData(newData);
    setAddingResourceTo(null);
  };

  const handleDeleteResource = (resourceId: string, targetType: 'area' | 'project', targetId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (targetType === 'area') {
      const area = newData.areas.find((a: any) => a.id === targetId);
      if (area) area.resources = area.resources.filter((r: any) => r.id !== resourceId);
    } else {
      newData.areas.forEach((area: any) => {
        const project = area.projects.find((p: any) => p.id === targetId);
        if (project) project.resources = project.resources.filter((r: any) => r.id !== resourceId);
      });
    }
    updateData(newData);
  };

  // Drag reorder handler
  const handleReorder = (list: any[], fromIndex: number, toIndex: number) => {
    const result = [...list];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
  };

  const reorderTasks = (tasks: Task[], fromIndex: number, toIndex: number, target: 'inbox' | 'area' | 'project' | 'phase', targetId?: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (target === 'inbox') {
      newData.inbox = handleReorder(newData.inbox, fromIndex, toIndex);
    } else if (target === 'area' && targetId) {
      const area = newData.areas.find((a: any) => a.id === targetId);
      if (area) area.tasks = handleReorder(area.tasks, fromIndex, toIndex);
    } else if (target === 'project' && targetId) {
      newData.areas.forEach((a: any) => {
        const p = a.projects.find((p: any) => p.id === targetId);
        if (p) p.tasks = handleReorder(p.tasks, fromIndex, toIndex);
      });
    } else if (target === 'phase' && targetId) {
      newData.areas.forEach((a: any) => a.projects.forEach((p: any) => {
        const ph = p.phases.find((ph: any) => ph.id === targetId);
        if (ph) ph.tasks = handleReorder(ph.tasks, fromIndex, toIndex);
      }));
    }
    updateData(newData);
  };

  const reorderProjects = (areaId: string, fromIndex: number, toIndex: number) => {
    const newData = JSON.parse(JSON.stringify(data));
    const area = newData.areas.find((a: any) => a.id === areaId);
    if (area) area.projects = handleReorder(area.projects, fromIndex, toIndex);
    updateData(newData);
  };

  const reorderPhases = (projectId: string, fromIndex: number, toIndex: number) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.areas.forEach((a: any) => {
      const p = a.projects.find((p: any) => p.id === projectId);
      if (p) p.phases = handleReorder(p.phases, fromIndex, toIndex);
    });
    updateData(newData);
  };

  // Event handlers
  const handleAddEvent = (projectId: string, event: ProjectEvent) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.areas.forEach((area: any) => {
      const project = area.projects.find((p: any) => p.id === projectId);
      if (project) {
        project.events = [...(project.events || []), event];
      }
    });
    updateData(newData);
  };

  const handleUpdateEvent = (projectId: string, updatedEvent: ProjectEvent) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.areas.forEach((area: any) => {
      const project = area.projects.find((p: any) => p.id === projectId);
      if (project && project.events) {
        const idx = project.events.findIndex((e: any) => e.id === updatedEvent.id);
        if (idx !== -1) project.events[idx] = updatedEvent;
      }
    });
    updateData(newData);
  };

  const handleDeleteEvent = (projectId: string, eventId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    newData.areas.forEach((area: any) => {
      const project = area.projects.find((p: any) => p.id === projectId);
      if (project && project.events) {
        project.events = project.events.filter((e: any) => e.id !== eventId);
      }
    });
    updateData(newData);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-black/5 bg-white flex flex-col">
        <div className="p-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold">
            A
          </div>
          <h1 className="font-semibold text-lg tracking-tight">arthurOS</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <button 
            onClick={() => setActiveView({ type: 'inbox' })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              activeView.type === 'inbox' ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5"
            )}
          >
            <Inbox size={18} />
            Global Inbox
          </button>

          <button 
            onClick={() => setActiveView({ type: 'kanban' })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              activeView.type === 'kanban' ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5"
            )}
          >
            <KanbanIcon size={18} />
            Kanban Board
          </button>

          <button 
            onClick={() => setActiveView({ type: 'completed' })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              activeView.type === 'completed' ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5"
            )}
          >
            <CheckCircle2 size={18} />
            Completed
          </button>

          <button
            onClick={() => setActiveView({ type: 'graph' })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              activeView.type === 'graph' ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5"
            )}
          >
            <Network size={18} />
            Knowledge Graph
          </button>

          {/* Area Groups and Areas */}
          {(data.areaGroups || []).map(group => (
            <div key={group.id} className="pt-2">
              <div className="px-3 flex items-center justify-between group">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.title}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setIsAddingArea({ groupId: group.id })}
                    className="text-gray-400 hover:text-accent transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    onClick={() => deleteGroup(group.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {data.areas.filter(a => a.groupId === group.id).map(area => (
                <button
                  key={area.id}
                  onClick={() => setActiveView({ type: 'area', id: area.id })}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-left",
                    activeView.type === 'area' && activeView.id === area.id ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5",
                    area.inactive && "opacity-40"
                  )}
                >
                  <span className="shrink-0">{area.color ? <div className="w-4 h-4 rounded-full" style={{ backgroundColor: area.color }} /> : <Briefcase size={18} />}</span>
                  <span className="min-w-0">{area.title}</span>
                </button>
              ))}
              {isAddingArea && isAddingArea.groupId === group.id && (
                <form onSubmit={handleAddArea} className="px-3 py-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Area name..."
                    className="w-full bg-black/5 border-none rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent outline-none"
                    value={newAreaTitle}
                    onChange={(e) => setNewAreaTitle(e.target.value)}
                    onBlur={() => !newAreaTitle && setIsAddingArea(null)}
                  />
                </form>
              )}
            </div>
          ))}

          {/* Ungrouped Areas */}
          <div className="pt-4 pb-2 px-3 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Areas</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsAddingGroup(true)}
                className="text-gray-400 hover:text-accent transition-colors"
                title="Add Group"
              >
                <Layers size={14} />
              </button>
              <button 
                onClick={() => setIsAddingArea({})}
                className="text-gray-400 hover:text-accent transition-colors"
                title="Add Area"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {isAddingGroup && (
            <form onSubmit={handleAddGroup} className="px-3 py-2">
              <input 
                autoFocus
                type="text"
                placeholder="Group name..."
                className="w-full bg-black/5 border-none rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent outline-none"
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                onBlur={() => !newGroupTitle && setIsAddingGroup(false)}
              />
            </form>
          )}

          {isAddingArea && !isAddingArea.groupId && (
            <form onSubmit={handleAddArea} className="px-3 py-2">
              <input 
                autoFocus
                type="text"
                placeholder="Area name..."
                className="w-full bg-black/5 border-none rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent outline-none"
                value={newAreaTitle}
                onChange={(e) => setNewAreaTitle(e.target.value)}
                onBlur={() => !newAreaTitle && setIsAddingArea(null)}
              />
            </form>
          )}

          {data.areas.filter(a => !a.groupId).map(area => (
            <button
              key={area.id}
              onClick={() => setActiveView({ type: 'area', id: area.id })}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-left",
                activeView.type === 'area' && activeView.id === area.id ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5",
                area.inactive && "opacity-40"
              )}
            >
              <span className="shrink-0">{area.color ? <div className="w-4 h-4 rounded-full" style={{ backgroundColor: area.color }} /> : <Briefcase size={18} />}</span>
              <span className="min-w-0">{area.title}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-black/5 space-y-2">
          <button
            onClick={() => setActiveView({ type: 'settings' })}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
              activeView.type === 'settings' ? "text-accent" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="flex items-center justify-between px-3 py-1">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 truncate">
              {syncing ? (
                <Loader2 size={12} className="animate-spin text-accent shrink-0" />
              ) : lastSyncError ? (
                <CloudOff size={12} className="text-red-400 shrink-0" />
              ) : (
                <Cloud size={12} className="text-green-400 shrink-0" />
              )}
              <span className="truncate">{user?.email}</span>
            </div>
            <button
              onClick={signOut}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#F5F5F7] p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header & Breadcrumbs */}
          <header className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <button onClick={() => setActiveView({ type: 'inbox' })} className="hover:text-gray-600 transition-colors">Home</button>
              {currentArea && (
                <>
                  <ChevronRight size={14} />
                  <button onClick={() => setActiveView({ type: 'area', id: currentArea.id })} className="hover:text-gray-600 transition-colors">{currentArea.title}</button>
                </>
              )}
              {currentProject && (
                <>
                  <ChevronRight size={14} />
                  <button onClick={() => setActiveView({ type: 'project', id: currentProject.id, parentId: currentArea?.id })} className="hover:text-gray-600 transition-colors">{currentProject.title}</button>
                </>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold tracking-tight">
                  {activeView.type === 'inbox' && "Global Inbox"}
                  {activeView.type === 'area' && currentArea?.title}
                  {activeView.type === 'project' && currentProject?.title}
                  {activeView.type === 'phase' && currentPhase?.title}
                  {activeView.type === 'graph' && "Knowledge Graph"}
                </h2>
                {activeView.type === 'area' && currentArea && (
                  <IconButton icon={Edit2} onClick={() => setEditingArea(currentArea)} />
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    className="pl-10 pr-4 py-2 bg-white border border-black/5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {activeView.type === 'area' && (
                  <button 
                    onClick={() => setIsAddingProject(activeView.id!)}
                    className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors shadow-sm"
                  >
                    <Plus size={18} />
                    New Project
                  </button>
                )}
                {activeView.type === 'project' && (
                  <button 
                    onClick={() => setIsAddingPhase(activeView.id!)}
                    className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors shadow-sm"
                  >
                    <Plus size={18} />
                    New Phase
                  </button>
                )}
                {activeView.type === 'inbox' && (
                  <button 
                    onClick={() => setIsAddingTask({ target: 'inbox' })}
                    className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-accent/90 transition-colors shadow-sm"
                  >
                    <Plus size={18} />
                    New Task
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* View Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={JSON.stringify(activeView)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView.type === 'inbox' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-black/5 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <ArrowUpDown size={14} />
                      Sort by:
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={inboxSort}
                        onChange={(e) => setInboxSort(e.target.value as any)}
                      >
                        <option value="deadline">Deadline</option>
                        <option value="priority">Priority</option>
                        <option value="energy">Energy</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <Rows size={14} />
                      Group by:
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={inboxGroup}
                        onChange={(e) => setInboxGroup(e.target.value as any)}
                      >
                        <option value="none">None</option>
                        <option value="project">Project</option>
                        <option value="phase">Phase</option>
                        <option value="status">Status</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <Filter size={14} />
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={inboxFilter.status || ''}
                        onChange={(e) => setInboxFilter({ ...inboxFilter, status: e.target.value || undefined })}
                      >
                        <option value="">All Status</option>
                        {appSettings.taskStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer ml-2"
                        value={inboxFilter.label || ''}
                        onChange={(e) => setInboxFilter({ ...inboxFilter, label: e.target.value || undefined })}
                      >
                        <option value="">All Labels</option>
                        {Array.from(new Set([
                          ...data.areas.flatMap(a => [
                            ...(a.labels || []),
                            ...a.projects.flatMap(p => [
                              ...(p.labels || []),
                              ...p.phases.flatMap(ph => [...(ph.labels || []), ...ph.tasks.flatMap(t => t.labels || [])])
                            ])
                          ]),
                          ...data.inbox.flatMap(t => t.labels || [])
                        ])).map(label => (
                          <option key={label} value={label}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <Calendar size={14} />
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={inboxDeadlineView}
                        onChange={(e) => setInboxDeadlineView(e.target.value as any)}
                      >
                        <option value="all">All Dates</option>
                        <option value="today">Due Today</option>
                        <option value="overdue">Overdue</option>
                        <option value="no-date">No Deadline</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setInboxShowBacklog(!inboxShowBacklog)}
                      className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg transition-colors", inboxShowBacklog ? "bg-accent/10 text-accent" : "text-gray-400 hover:bg-black/5")}
                    >
                      <Briefcase size={12} />
                      Backlogged
                    </button>
                  </div>
                  <InboxView
                    data={data}
                    sort={inboxSort}
                    group={inboxGroup}
                    filter={inboxFilter}
                    searchQuery={searchQuery}
                    display={display}
                    showBacklog={inboxShowBacklog}
                    deadlineView={inboxDeadlineView}
                    onToggle={toggleTaskStatus}
                    onEdit={setEditingTask}
                    onDelete={deleteTask}
                    onUpload={handleFileUpload}
                  />
                </div>
              )}

              {activeView.type === 'kanban' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-black/5 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <Rows size={14} />
                      Group by:
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={kanbanGroup}
                        onChange={(e) => { setKanbanGroup(e.target.value as any); setKanbanFilter({}); }}
                      >
                        <option value="status">Status</option>
                        <option value="area">Area</option>
                        <option value="project">Project</option>
                        <option value="priority">Priority</option>
                        <option value="energy">Energy</option>
                        <option value="label">Label</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <Filter size={14} />
                      {kanbanGroup !== 'status' && (
                        <select
                          className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                          value={kanbanFilter.status || ''}
                          onChange={(e) => setKanbanFilter({ ...kanbanFilter, status: e.target.value || undefined })}
                        >
                          <option value="">All Status</option>
                          {appSettings.taskStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {kanbanGroup !== 'priority' && (
                        <select
                          className="bg-transparent text-gray-900 focus:outline-none cursor-pointer ml-2"
                          value={kanbanFilter.priority || ''}
                          onChange={(e) => setKanbanFilter({ ...kanbanFilter, priority: e.target.value || undefined })}
                        >
                          <option value="">All Priority</option>
                          <option value="P1">P1</option>
                          <option value="P2">P2</option>
                          <option value="P3">P3</option>
                        </select>
                      )}
                      {kanbanGroup !== 'energy' && (
                        <select
                          className="bg-transparent text-gray-900 focus:outline-none cursor-pointer ml-2"
                          value={kanbanFilter.energy || ''}
                          onChange={(e) => setKanbanFilter({ ...kanbanFilter, energy: e.target.value || undefined })}
                        >
                          <option value="">All Energy</option>
                          <option value="High">High</option>
                          <option value="Low">Low</option>
                        </select>
                      )}
                      {kanbanGroup !== 'label' && (
                        <select
                          className="bg-transparent text-gray-900 focus:outline-none cursor-pointer ml-2"
                          value={kanbanFilter.label || ''}
                          onChange={(e) => setKanbanFilter({ ...kanbanFilter, label: e.target.value || undefined })}
                        >
                          <option value="">All Labels</option>
                          {Array.from(new Set([
                            ...data.areas.flatMap(a => [
                              ...(a.labels || []),
                              ...a.projects.flatMap(p => [
                                ...(p.labels || []),
                                ...p.phases.flatMap(ph => [...(ph.labels || []), ...ph.tasks.flatMap(t => t.labels || [])])
                              ])
                            ]),
                            ...data.inbox.flatMap(t => t.labels || [])
                          ])).map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 border-r border-black/5 pr-4">
                      <Calendar size={14} />
                      <select
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={kanbanDeadlineView}
                        onChange={(e) => setKanbanDeadlineView(e.target.value as any)}
                      >
                        <option value="all">All Dates</option>
                        <option value="today">Due Today</option>
                        <option value="overdue">Overdue</option>
                        <option value="no-date">No Deadline</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setKanbanShowBacklog(!kanbanShowBacklog)}
                      className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg transition-colors", kanbanShowBacklog ? "bg-accent/10 text-accent" : "text-gray-400 hover:bg-black/5")}
                    >
                      <Briefcase size={12} />
                      Backlogged
                    </button>
                  </div>
                  <KanbanView
                    data={data}
                    group={kanbanGroup}
                    filter={kanbanFilter}
                    searchQuery={searchQuery}
                    display={display}
                    showBacklog={kanbanShowBacklog}
                    deadlineView={kanbanDeadlineView}
                    onToggle={toggleTaskStatus}
                    onEdit={setEditingTask}
                    onDelete={deleteTask}
                    onUpload={handleFileUpload}
                  />
                </div>
              )}

              {activeView.type === 'settings' && (
                <SettingsView data={data} updateData={updateData} deleteArea={deleteArea} />
              )}

              {activeView.type === 'completed' && (
                <CompletedView
                  data={data}
                  searchQuery={searchQuery}
                  onToggle={toggleTaskStatus}
                  onEdit={setEditingTask}
                  onDelete={deleteTask}
                />
              )}

              {activeView.type === 'graph' && (
                <GraphView
                  data={data}
                  searchQuery={searchQuery}
                  onNavigate={setActiveView}
                />
              )}

              {activeView.type === 'area' && currentArea && (() => {
                const filteredProjects = currentArea.projects.filter(p => (!areaProjectFilter || p.status === areaProjectFilter) && (!searchQuery || matchesSearch(p.title, searchQuery) || matchesSearch(p.description, searchQuery) || p.labels.some(l => matchesSearch(l, searchQuery))));
                return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Target size={20} className="text-accent" />
                        Projects
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                          <Filter size={12} />
                          <select
                            className="bg-transparent text-gray-900 focus:outline-none cursor-pointer text-xs"
                            value={areaProjectFilter}
                            onChange={(e) => setAreaProjectFilter(e.target.value)}
                          >
                            <option value="">All Status</option>
                            {appSettings.projectStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => setIsAddingProject(currentArea.id)}
                          className="text-accent hover:text-accent/80 text-xs font-medium flex items-center gap-1"
                        >
                          <Plus size={14} />
                          New Project
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-4">
                      {filteredProjects.map((project, idx) => (
                        <div
                          key={project.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedItemId(project.id); }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedItemId && draggedItemId !== project.id) {
                              const fromIdx = currentArea.projects.findIndex(p => p.id === draggedItemId);
                              const toIdx = currentArea.projects.findIndex(p => p.id === project.id);
                              if (fromIdx !== -1 && toIdx !== -1) reorderProjects(currentArea.id, fromIdx, toIdx);
                            }
                            setDraggedItemId(null);
                          }}
                          onDragEnd={() => setDraggedItemId(null)}
                          className={cn("flex items-start gap-2 rounded-2xl transition-all", draggedItemId && draggedItemId !== project.id && "border-2 border-dashed border-transparent hover:border-accent/30")}
                        >
                          <div className="cursor-grab text-gray-300 hover:text-gray-400 pt-6 shrink-0">
                            <GripVertical size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <ProjectCard
                              project={project}
                              onClick={() => setActiveView({ type: 'project', id: project.id, parentId: currentArea.id })}
                              onEdit={setEditingProject}
                              onDelete={deleteProject}
                            />
                          </div>
                        </div>
                      ))}
                      {currentArea.projects.length === 0 && (
                        <div className="p-12 glass rounded-2xl flex flex-col items-center justify-center text-gray-400 border-dashed">
                          <Layers size={32} className="mb-2 opacity-20" />
                          <p className="text-sm">No projects yet</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-8 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <CheckCircle2 size={20} className="text-accent" />
                          Area Tasks
                        </h3>
                        <button
                          onClick={() => setIsAddingTask({ target: 'area', id: currentArea.id })}
                          className="text-accent hover:text-accent/80 text-xs font-medium flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Add Task
                        </button>
                      </div>
                      <TaskList
                        tasks={currentArea.tasks.filter(t => t.status !== 'Done').filter(t => taskMatchesSearch(t, searchQuery))}
                        onToggle={toggleTaskStatus}
                        onEdit={setEditingTask}
                        onDelete={deleteTask}
                        display={display}
                        onReorder={(from, to) => reorderTasks(currentArea.tasks, from, to, 'area', currentArea.id)}
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText size={20} className="text-accent" />
                      Resource Library
                    </h3>
                    <ResourceList
                      resources={currentArea.resources}
                      onAdd={(r) => handleAddResource(r, 'area', currentArea.id)}
                      onDelete={(id) => handleDeleteResource(id, 'area', currentArea.id)}
                      onPreview={setPreviewResource}
                    />
                  </div>
                </div>
                );
              })()}

              {activeView.type === 'project' && currentProject && (
                <div className="space-y-8">
                  {currentProject.description && (
                    <p className="text-sm text-gray-500 -mt-4 max-w-2xl leading-relaxed">{currentProject.description}</p>
                  )}
                  <div className="glass p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar size={16} />
                        {format(new Date(currentProject.startDate), 'MMM d')} - {format(new Date(currentProject.endDate), 'MMM d, yyyy')}
                      </div>
                      <div className="h-4 w-px bg-black/5" />
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Layers size={16} />
                        {currentProject.phases.length} Phases
                      </div>
                      <div className="h-4 w-px bg-black/5" />
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Badge className="bg-accent/10 text-accent border-none">{currentProject.status}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconButton icon={Edit2} onClick={() => setEditingProject(currentProject)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Project Tasks</h4>
                          <button
                            onClick={() => setIsAddingTask({ target: 'project', id: currentProject.id })}
                            className="text-accent hover:text-accent/80 text-xs font-medium flex items-center gap-1"
                          >
                            <Plus size={14} />
                            Add Task
                          </button>
                        </div>
                        <TaskList
                          tasks={currentProject.tasks.filter(t => t.status !== 'Done').filter(t => taskMatchesSearch(t, searchQuery))}
                          onToggle={toggleTaskStatus}
                          onEdit={setEditingTask}
                          onDelete={deleteTask}
                          display={display}
                          onReorder={(from, to) => reorderTasks(currentProject.tasks, from, to, 'project', currentProject.id)}
                        />
                      </div>

                      {currentProject.phases.map((phase, phaseIdx) => (
                        <div
                          key={phase.id}
                          className="space-y-4"
                          draggable
                          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedItemId(phase.id); }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedItemId && draggedItemId !== phase.id) {
                              const fromIdx = currentProject.phases.findIndex(ph => ph.id === draggedItemId);
                              const toIdx = currentProject.phases.findIndex(ph => ph.id === phase.id);
                              if (fromIdx !== -1 && toIdx !== -1) reorderPhases(currentProject.id, fromIdx, toIdx);
                            }
                            setDraggedItemId(null);
                          }}
                          onDragEnd={() => setDraggedItemId(null)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="cursor-grab text-gray-300 hover:text-gray-400"><GripVertical size={16} /></div>
                              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{phase.title}</h4>
                              <Badge className="bg-black/5 text-gray-500 border-none text-[10px]">{phase.status}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <IconButton icon={Edit2} onClick={() => setEditingPhase(phase)} />
                              <IconButton icon={Trash2} className="hover:text-red-500" onClick={() => deletePhase(phase.id)} />
                              <label className="text-accent hover:text-accent/80 text-xs font-medium flex items-center gap-1 cursor-pointer">
                                <Upload size={14} />
                                Upload
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file, phase.id, 'phase');
                                  }}
                                />
                              </label>
                              <button
                                onClick={() => setIsAddingTask({ target: 'phase', id: phase.id })}
                                className="text-accent hover:text-accent/80 text-xs font-medium flex items-center gap-1"
                              >
                                <Plus size={14} />
                                Add Task
                              </button>
                            </div>
                          </div>
                          {phase.description && (
                            <p className="text-xs text-gray-500 mb-2">{phase.description}</p>
                          )}
                          {phase.labels && phase.labels.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {phase.labels.map(label => (
                                <Badge key={label} className="bg-accent/5 text-accent border border-accent/10">{label}</Badge>
                              ))}
                            </div>
                          )}
                          {phase.attachments && phase.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {phase.attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-2 bg-black/5 rounded-lg px-2 py-1 text-[10px] text-gray-500">
                                  <File size={10} />
                                  <span className="truncate max-w-[120px]">{att.name}</span>
                                  <span className="text-gray-400">{(att.size / 1024).toFixed(1)} KB</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <TaskList
                            tasks={phase.tasks.filter(t => t.status !== 'Done').filter(t => taskMatchesSearch(t, searchQuery))}
                            onToggle={toggleTaskStatus}
                            onEdit={setEditingTask}
                            onDelete={deleteTask}
                            display={display}
                            onReorder={(from, to) => reorderTasks(phase.tasks, from, to, 'phase', phase.id)}
                          />
                        </div>
                      ))}
                      {currentProject.phases.length === 0 && (
                        <div className="p-12 glass rounded-2xl flex flex-col items-center justify-center text-gray-400 border-dashed">
                          <Layers size={32} className="mb-2 opacity-20" />
                          <p className="text-sm">No phases defined for this project</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-8">
                      {/* Project Events */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Calendar size={20} className="text-accent" />
                            Project Events
                          </h3>
                          <button
                            onClick={() => setEditingEvent({ projectId: currentProject.id, event: null })}
                            className="text-accent hover:text-accent/80 text-xs font-medium flex items-center gap-1"
                          >
                            <Plus size={14} />
                            Add Event
                          </button>
                        </div>
                        {(currentProject.events || []).length === 0 && !editingEvent && (
                          <div className="p-6 glass rounded-2xl flex flex-col items-center justify-center text-gray-400 border-dashed">
                            <Calendar size={24} className="mb-2 opacity-20" />
                            <p className="text-xs">No events yet</p>
                          </div>
                        )}
                        {(currentProject.events || []).sort((a, b) => {
                          const dateA = a.time ? `${a.date}T${a.time}` : a.date;
                          const dateB = b.time ? `${b.date}T${b.time}` : b.date;
                          return dateA.localeCompare(dateB);
                        }).map(event => {
                          const eventDate = event.time ? new Date(`${event.date}T${event.time}`) : new Date(event.date + 'T23:59:59');
                          const now = new Date();
                          const diffMs = eventDate.getTime() - now.getTime();
                          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          const isPast = diffMs < 0;
                          const linkedPhases = currentProject.phases.filter(ph => event.linkedPhaseIds?.includes(ph.id));
                          const allTasks = [...currentProject.tasks, ...currentProject.phases.flatMap(ph => ph.tasks)];
                          const linkedTasks = allTasks.filter(t => event.linkedTaskIds?.includes(t.id));

                          return (
                            <div key={event.id} className="glass p-4 rounded-xl space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm text-gray-900">{event.title}</h4>
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                      isPast ? "bg-red-50 text-red-500" :
                                      diffDays === 0 ? "bg-amber-50 text-amber-600" :
                                      diffDays <= 3 ? "bg-orange-50 text-orange-500" :
                                      "bg-accent/10 text-accent"
                                    )}>
                                      {isPast ? 'Past' :
                                       diffDays === 0 ? (event.time ? `${diffHours}h left` : 'Today') :
                                       diffDays === 1 ? '1 day left' :
                                       `${diffDays} days left`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                    <Calendar size={10} />
                                    {format(new Date(event.date), 'MMM d, yyyy')}
                                    {event.time && <span>at {event.time}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <IconButton icon={Edit2} onClick={() => setEditingEvent({ projectId: currentProject.id, event })} />
                                  <IconButton icon={Trash2} className="hover:text-red-500" onClick={() => handleDeleteEvent(currentProject.id, event.id)} />
                                </div>
                              </div>
                              {event.description && (
                                <p className="text-xs text-gray-500">{event.description}</p>
                              )}
                              {(linkedPhases.length > 0 || linkedTasks.length > 0) && (
                                <div className="flex flex-wrap gap-1.5">
                                  {linkedPhases.map(ph => (
                                    <span key={ph.id} className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                      <Layers size={8} className="inline mr-1" />{ph.title}
                                    </span>
                                  ))}
                                  {linkedTasks.map(t => (
                                    <span key={t.id} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 size={8} className="inline mr-1" />{t.title}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Project Resources */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <FileText size={20} className="text-accent" />
                          Project Resources
                        </h3>
                        <ResourceList
                          resources={currentProject.resources}
                          onAdd={(r) => handleAddResource(r, 'project', currentProject.id)}
                          onDelete={(id) => handleDeleteResource(id, 'project', currentProject.id)}
                          onPreview={setPreviewResource}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingTask && (
          <CreationModal
            title="Create New Task"
            placeholder="Task title..."
            data={data}
            initialTarget={{ type: isAddingTask.target, id: isAddingTask.id }}
            onClose={() => setIsAddingTask(null)}
            onConfirm={(val, type, id, labels) => handleAddTask(val, type || isAddingTask.target, id || isAddingTask.id, labels)}
          />
        )}
        {isAddingProject && (
          <CreationModal 
            title="Create New Project" 
            placeholder="Project title..." 
            onClose={() => setIsAddingProject(null)} 
            onConfirm={(val) => handleAddProject(val, isAddingProject)} 
          />
        )}
        {isAddingPhase && (
          <CreationModal 
            title="Create New Phase" 
            placeholder="Phase title..." 
            onClose={() => setIsAddingPhase(null)} 
            onConfirm={(val) => handleAddPhase(val, isAddingPhase)} 
          />
        )}
        {editingTask && (
          <EditTaskModal
            task={editingTask}
            data={data}
            appSettings={appSettings}
            onClose={() => setEditingTask(null)}
            onSave={updateTask}
            onMove={moveTask}
          />
        )}
        {editingProject && (
          <EditProjectModal
            project={editingProject}
            areas={data.areas}
            appSettings={appSettings}
            onClose={() => setEditingProject(null)}
            onSave={updateProject}
            onMove={moveProject}
          />
        )}
        {editingPhase && (
          <EditPhaseModal
            phase={editingPhase}
            appSettings={appSettings}
            allPhases={data.areas.flatMap(a => a.projects.flatMap(p => p.phases))}
            onClose={() => setEditingPhase(null)}
            onSave={updatePhase}
          />
        )}
        {editingArea && (
          <EditAreaModal
            area={editingArea}
            areaGroups={data.areaGroups || []}
            onClose={() => setEditingArea(null)}
            onSave={updateArea}
            onDelete={deleteArea}
          />
        )}
        {previewResource && (
          <FilePreviewModal
            resource={previewResource}
            onClose={() => setPreviewResource(null)}
          />
        )}
        {editingEvent && currentProject && (
          <EditEventModal
            event={editingEvent.event}
            project={currentProject}
            onClose={() => setEditingEvent(null)}
            onSave={(event) => {
              if (editingEvent.event) {
                handleUpdateEvent(editingEvent.projectId, event);
              } else {
                handleAddEvent(editingEvent.projectId, event);
              }
              setEditingEvent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function CreationModal({ title, placeholder, onClose, onConfirm, data, initialTarget }: { title: string, placeholder: string, onClose: () => void, onConfirm: (val: string, targetType?: 'inbox' | 'area' | 'project' | 'phase', targetId?: string, labels?: string[]) => void, data?: LifeOSData, initialTarget?: { type: 'inbox' | 'area' | 'project' | 'phase', id?: string } }) {
  const [val, setVal] = useState('');
  const [target, setTarget] = useState<{ type: 'inbox' | 'area' | 'project' | 'phase', id?: string }>(initialTarget || { type: 'inbox' });
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');

  const isTask = title === "Create New Task";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
      >
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <input 
          autoFocus
          type="text" 
          placeholder={placeholder}
          className="w-full bg-black/5 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent outline-none mb-4"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm(val, target.type, target.id, labels)}
        />

        {isTask && data && (
          <div className="mb-6">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Target Location</label>
            <select 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={target.id || 'inbox'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'inbox') setTarget({ type: 'inbox' });
                else {
                  const isArea = data.areas.some(a => a.id === val);
                  const isProject = data.areas.some(a => a.projects.some(p => p.id === val));
                  const isPhase = data.areas.some(a => a.projects.some(p => p.phases.some(ph => ph.id === val)));
                  
                  if (isArea) setTarget({ type: 'area', id: val });
                  else if (isProject) setTarget({ type: 'project', id: val });
                  else if (isPhase) setTarget({ type: 'phase', id: val });
                }
              }}
            >
              <option value="inbox">Global Inbox</option>
              {data.areas.map(area => (
                <optgroup key={area.id} label={area.title}>
                  <option value={area.id}>{area.title} (Area)</option>
                  {area.projects.map(project => (
                    <optgroup key={project.id} label={`  ${project.title}`}>
                      <option value={project.id}>    {project.title} (Project)</option>
                      {project.phases.map(phase => (
                        <option key={phase.id} value={phase.id}>      {phase.title} (Phase)</option>
                      ))}
                    </optgroup>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {isTask && (
          <div className="mb-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Labels</label>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {labels.map(l => (
                  <span key={l} className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs flex items-center gap-1">
                    {l}
                    <button onClick={() => setLabels(labels.filter(x => x !== l))} className="hover:text-red-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="Add label and press Enter..."
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (newLabel.trim() && !labels.includes(newLabel.trim())) {
                    setLabels([...labels, newLabel.trim()]);
                    setNewLabel('');
                  }
                }
              }}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={() => onConfirm(val, target.type, target.id, labels)} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">Create</button>
        </div>
      </motion.div>
    </div>
  );
}

function EditTaskModal({ task, data, appSettings, onClose, onSave, onMove }: { task: Task, data: LifeOSData, appSettings: AppSettings, onClose: () => void, onSave: (t: Task) => void, onMove: (id: string, type: 'inbox' | 'area' | 'project' | 'phase', targetId?: string) => void }) {
  const [edited, setEdited] = useState<Task>({ ...task });
  const [newLabel, setNewLabel] = useState('');
  
  // Find current location
  const currentLocation = useMemo(() => {
    for (const area of data.areas) {
      if (area.tasks?.some(t => t.id === task.id)) return { type: 'area' as const, areaId: area.id };
      for (const project of area.projects) {
        if (project.tasks?.some(t => t.id === task.id)) return { type: 'project' as const, areaId: area.id, projectId: project.id };
        for (const phase of project.phases) {
          if (phase.tasks?.some(t => t.id === task.id)) return { type: 'phase' as const, areaId: area.id, projectId: project.id, phaseId: phase.id };
        }
      }
    }
    return { type: 'inbox' as const };
  }, [data, task.id]);

  const [moveTarget, setMoveTarget] = useState<{ type: 'inbox' | 'area' | 'project' | 'phase', areaId?: string, projectId?: string, phaseId?: string }>({
    type: currentLocation.type,
    areaId: currentLocation.areaId,
    projectId: currentLocation.projectId,
    phaseId: currentLocation.phaseId
  });

  const selectedArea = data.areas.find(a => a.id === moveTarget.areaId);
  const selectedProject = selectedArea?.projects.find(p => p.id === moveTarget.projectId);

  const handleMove = () => {
    let targetId: string | undefined;
    if (moveTarget.type === 'area') targetId = moveTarget.areaId;
    else if (moveTarget.type === 'project') targetId = moveTarget.projectId;
    else if (moveTarget.type === 'phase') targetId = moveTarget.phaseId;
    
    onMove(edited.id, moveTarget.type, targetId);
  };

  const addLabel = () => {
    const labels = edited.labels || [];
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setEdited({ ...edited, labels: [...labels, newLabel.trim()] });
      setNewLabel('');
    }
  };

  const removeLabel = (label: string) => {
    const labels = edited.labels || [];
    setEdited({ ...edited, labels: labels.filter(l => l !== label) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Edit Task</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Title</label>
            <input 
              type="text" 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={edited.title}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Description</label>
            <textarea 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none h-20 resize-none"
              value={edited.description || ''}
              onChange={(e) => setEdited({ ...edited, description: e.target.value })}
              placeholder="Add an optional description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
              <select
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.status}
                onChange={(e) => setEdited({ ...edited, status: e.target.value as string })}
              >
                {appSettings.taskStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Priority</label>
              <select
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.priority}
                onChange={(e) => setEdited({ ...edited, priority: e.target.value as Priority })}
              >
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Energy</label>
              <select 
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.energy}
                onChange={(e) => setEdited({ ...edited, energy: e.target.value as Energy })}
              >
                <option value="Low">Low</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Deadline</label>
              <input 
                type="date" 
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.deadline?.split('T')[0] || ''}
                onChange={(e) => setEdited({ ...edited, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Labels</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(edited.labels || []).map(label => (
                <span key={label} className="bg-accent/10 text-accent px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  {label}
                  <button onClick={() => removeLabel(label)}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                placeholder="New label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
              />
              <button onClick={addLabel} className="p-2 bg-accent text-white rounded-xl"><Plus size={18} /></button>
            </div>
          </div>

          <DependencySelector
            label="Dependencies"
            items={(() => {
              const scopedTasks: Task[] = [];
              if (currentLocation.projectId) {
                data.areas.forEach(a => a.projects.forEach(p => {
                  if (p.id === currentLocation.projectId) {
                    p.tasks.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); });
                    p.phases.forEach(ph => ph.tasks.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); }));
                  }
                }));
              } else if (currentLocation.areaId) {
                const area = data.areas.find(a => a.id === currentLocation.areaId);
                if (area) {
                  (area.tasks || []).forEach(t => { if (t.id !== task.id) scopedTasks.push(t); });
                  area.projects.forEach(p => {
                    p.tasks.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); });
                    p.phases.forEach(ph => ph.tasks.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); }));
                  });
                }
              } else {
                data.inbox.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); });
                data.areas.forEach(a => {
                  (a.tasks || []).forEach(t => { if (t.id !== task.id) scopedTasks.push(t); });
                  a.projects.forEach(p => {
                    p.tasks.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); });
                    p.phases.forEach(ph => ph.tasks.forEach(t => { if (t.id !== task.id) scopedTasks.push(t); }));
                  });
                });
              }
              return scopedTasks;
            })()}
            selected={edited.dependsOn || []}
            onChange={(deps) => setEdited({ ...edited, dependsOn: deps })}
          />

          <div className="pt-4 border-t border-black/5 space-y-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Location</label>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-gray-400 uppercase mb-1 block">Area</label>
                <select
                  className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                  value={moveTarget.areaId || 'inbox'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'inbox') setMoveTarget({ type: 'inbox' });
                    else setMoveTarget({ type: 'area', areaId: val });
                  }}
                >
                  <option value="inbox">Global Inbox</option>
                  {data.areas.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>

              {moveTarget.type !== 'inbox' && (
                <div>
                  <label className="text-[9px] text-gray-400 uppercase mb-1 block">Project (Optional)</label>
                  <select 
                    className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                    value={moveTarget.projectId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) setMoveTarget({ ...moveTarget, type: 'area', projectId: undefined, phaseId: undefined });
                      else setMoveTarget({ ...moveTarget, type: 'project', projectId: val, phaseId: undefined });
                    }}
                  >
                    <option value="">None (Keep in Area)</option>
                    {selectedArea?.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}

              {moveTarget.type === 'project' || moveTarget.type === 'phase' ? (
                <div>
                  <label className="text-[9px] text-gray-400 uppercase mb-1 block">Phase (Optional)</label>
                  <select 
                    className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                    value={moveTarget.phaseId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) setMoveTarget({ ...moveTarget, type: 'project', phaseId: undefined });
                      else setMoveTarget({ ...moveTarget, type: 'phase', phaseId: val });
                    }}
                  >
                    <option value="">None (Keep in Project)</option>
                    {selectedProject?.phases.map(ph => <option key={ph.id} value={ph.id}>{ph.title}</option>)}
                  </select>
                </div>
              ) : null}

              <button 
                onClick={handleMove}
                disabled={moveTarget.type === currentLocation.type && 
                         (moveTarget.type === 'inbox' || 
                          (moveTarget.areaId === currentLocation.areaId && 
                           moveTarget.projectId === currentLocation.projectId && 
                           moveTarget.phaseId === currentLocation.phaseId))}
                className="w-full py-2 bg-black/5 hover:bg-black/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-colors"
              >
                Update Location
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Attachments</label>
            <div className="space-y-2">
              {edited.attachments?.map(att => (
                <div key={att.id} className="flex items-center justify-between p-2 bg-black/5 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <File size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate">{att.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</span>
                    <button
                      onClick={() => setEdited({ ...edited, attachments: (edited.attachments || []).filter(a => a.id !== att.id) })}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-black/10 rounded-xl text-xs text-gray-400 hover:text-accent hover:border-accent/30 transition-all cursor-pointer">
                <Upload size={14} />
                Upload File
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const attachment: Attachment = {
                        id: crypto.randomUUID(),
                        name: file.name,
                        url: URL.createObjectURL(file),
                        type: file.type,
                        size: file.size,
                        createdAt: new Date().toISOString()
                      };
                      setEdited({ ...edited, attachments: [...(edited.attachments || []), attachment] });
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={() => onSave(edited)} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">Save Changes</button>
        </div>
      </motion.div>
    </div>
  );
}

function EditProjectModal({ project, areas, appSettings, onClose, onSave, onMove }: { project: Project, areas: Area[], appSettings: AppSettings, onClose: () => void, onSave: (p: Project) => void, onMove: (id: string, targetAreaId: string) => void }) {
  const [edited, setEdited] = useState<Project>({ ...project });
  const [newLabel, setNewLabel] = useState('');
  const [moveTargetAreaId, setMoveTargetAreaId] = useState(areas[0]?.id || '');

  const addLabel = () => {
    const labels = edited.labels || [];
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setEdited({ ...edited, labels: [...labels, newLabel.trim()] });
      setNewLabel('');
    }
  };

  const removeLabel = (label: string) => {
    const labels = edited.labels || [];
    setEdited({ ...edited, labels: labels.filter(l => l !== label) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Edit Project</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Title</label>
            <input 
              type="text" 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={edited.title}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Description</label>
            <textarea 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none h-24 resize-none"
              value={edited.description}
              onChange={(e) => setEdited({ ...edited, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
              <select
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.status}
                onChange={(e) => setEdited({ ...edited, status: e.target.value as string })}
              >
                {appSettings.projectStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Start Date</label>
              <input
                type="date"
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.startDate.split('T')[0]}
                onChange={(e) => setEdited({ ...edited, startDate: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">End Date</label>
              <input
                type="date"
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.endDate.split('T')[0]}
                onChange={(e) => setEdited({ ...edited, endDate: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Card Display</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Show task progress bar</span>
                <button
                  onClick={() => setEdited({ ...edited, showProgress: !(edited.showProgress !== false) })}
                  className={cn("w-9 h-5 rounded-full transition-colors flex items-center px-0.5", (edited.showProgress !== false) ? "bg-accent justify-end" : "bg-black/10 justify-start")}
                >
                  <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Show timeline progress bar</span>
                <button
                  onClick={() => setEdited({ ...edited, showTimeline: !(edited.showTimeline !== false) })}
                  className={cn("w-9 h-5 rounded-full transition-colors flex items-center px-0.5", (edited.showTimeline !== false) ? "bg-accent justify-end" : "bg-black/10 justify-start")}
                >
                  <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Labels</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(edited.labels || []).map(label => (
                <span key={label} className="bg-accent/10 text-accent px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  {label}
                  <button onClick={() => removeLabel(label)}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                placeholder="New label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
              />
              <button onClick={addLabel} className="p-2 bg-accent text-white rounded-xl"><Plus size={18} /></button>
            </div>
          </div>
          <DependencySelector
            label="Dependencies"
            items={areas.flatMap(a => a.projects).filter(p => p.id !== project.id)}
            selected={edited.dependsOn || []}
            onChange={(deps) => setEdited({ ...edited, dependsOn: deps })}
          />

          <div className="pt-4 border-t border-black/5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Move Project</label>
            <div className="flex gap-2">
              <select 
                className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={moveTargetAreaId}
                onChange={(e) => setMoveTargetAreaId(e.target.value)}
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.title}</option>
                ))}
              </select>
              <button 
                onClick={() => onMove(edited.id, moveTargetAreaId)}
                className="px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl text-xs font-bold transition-colors"
              >
                Move
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Attachments</label>
            <div className="space-y-2">
              {edited.attachments?.map(att => (
                <div key={att.id} className="flex items-center justify-between p-2 bg-black/5 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <File size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate">{att.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{(att.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-black/10 rounded-xl text-xs text-gray-400 hover:text-accent hover:border-accent/30 transition-all cursor-pointer">
                <Upload size={14} />
                Upload File
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const attachment: Attachment = {
                        id: crypto.randomUUID(),
                        name: file.name,
                        url: URL.createObjectURL(file),
                        type: file.type,
                        size: file.size,
                        createdAt: new Date().toISOString()
                      };
                      setEdited({ ...edited, attachments: [...(edited.attachments || []), attachment] });
                    }
                  }} 
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={() => onSave(edited)} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">Save Changes</button>
        </div>
      </motion.div>
    </div>
  );
}

function KanbanView({ data, group, filter, searchQuery, display, showBacklog, deadlineView, onToggle, onEdit, onDelete, onUpload }: { data: any, group: 'status' | 'area' | 'project' | 'priority' | 'energy' | 'label', filter?: { status?: string, label?: string, priority?: string, energy?: string }, searchQuery?: string, display?: DisplaySettings, showBacklog?: boolean, deadlineView?: 'all' | 'today' | 'overdue' | 'no-date', onToggle: any, onEdit: any, onDelete: any, onUpload: any }) {
  const d = display || { showPriority: true, showEnergy: true, showDeadline: true, showLabels: true, showAttachments: true, showDescription: true };

  const allTasks = useMemo(() => {
    let tasks: (Task & { phaseName?: string, projectName?: string, areaName?: string, areaColor?: string, projectId?: string, phaseId?: string, areaId?: string, effectiveLabels: string[], projectStatus?: string })[] = [
      ...data.inbox.map((t: Task) => ({ ...t, effectiveLabels: t.labels || [] }))
    ];
    data.areas.forEach((area: Area) => {
      if (area.inactive) return;
      (area.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, areaColor: area.color, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(area.labels || [])])) }));
      area.projects.forEach(project => {
        (project.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, areaColor: area.color, projectName: project.title, projectId: project.id, projectStatus: project.status, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(project.labels || [])])) }));
        project.phases.forEach(phase => {
          phase.tasks.forEach(task => {
            tasks.push({
              ...task,
              areaName: area.title,
              areaId: area.id,
              areaColor: area.color,
              phaseName: phase.title,
              projectName: project.title,
              projectId: project.id,
              projectStatus: project.status,
              phaseId: phase.id,
              effectiveLabels: Array.from(new Set([...(task.labels || []), ...(phase.labels || []), ...(project.labels || [])]))
            });
          });
        });
      });
    });

    // Filter out tasks from backlogged projects unless showBacklog is on
    if (!showBacklog) tasks = tasks.filter(t => !t.projectStatus || t.projectStatus !== 'Backlog');

    if (!filter?.status) tasks = tasks.filter(t => t.status !== 'Done');
    else tasks = tasks.filter(t => t.status === filter.status);
    if (filter?.priority) tasks = tasks.filter(t => t.priority === filter.priority);
    if (filter?.energy) tasks = tasks.filter(t => t.energy === filter.energy);
    if (filter?.label) tasks = tasks.filter(t => t.effectiveLabels.includes(filter.label!));

    if (searchQuery) tasks = tasks.filter(t => taskMatchesSearch(t, searchQuery));

    // Deadline view filter
    if (deadlineView && deadlineView !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (deadlineView === 'today') tasks = tasks.filter(t => t.deadline && t.deadline.split('T')[0] === todayStr);
      else if (deadlineView === 'overdue') tasks = tasks.filter(t => t.deadline && t.deadline.split('T')[0] < todayStr);
      else if (deadlineView === 'no-date') tasks = tasks.filter(t => !t.deadline);
    }

    return tasks;
  }, [data, filter, searchQuery, showBacklog, deadlineView]);

  const columns = useMemo(() => {
    if (group === 'status') return ['Backlog', 'In Progress', 'Done'];
    if (group === 'priority') return ['P1', 'P2', 'P3'];
    if (group === 'energy') return ['High', 'Low'];
    if (group === 'area') {
      return ['Inbox', ...data.areas.map((a: Area) => a.title)];
    }
    if (group === 'project') {
      const projects: string[] = [];
      data.areas.forEach((a: Area) => a.projects.forEach(p => projects.push(p.title)));
      return ['Inbox', ...projects];
    }
    if (group === 'label') {
      const labels = new Set<string>();
      allTasks.forEach(t => t.effectiveLabels.forEach(l => labels.add(l)));
      return ['No Label', ...Array.from(labels)];
    }
    return [];
  }, [group, data, allTasks]);

  const getTasksForColumn = (col: string) => {
    if (group === 'status') return allTasks.filter(t => t.status === col);
    if (group === 'priority') return allTasks.filter(t => t.priority === col);
    if (group === 'energy') return allTasks.filter(t => t.energy === col);
    if (group === 'area') {
      if (col === 'Inbox') return allTasks.filter(t => !t.areaName);
      return allTasks.filter(t => t.areaName === col);
    }
    if (group === 'project') {
      if (col === 'Inbox') return allTasks.filter(t => !t.projectName);
      return allTasks.filter(t => t.projectName === col);
    }
    if (group === 'label') {
      if (col === 'No Label') return allTasks.filter(t => t.effectiveLabels.length === 0);
      return allTasks.filter(t => t.effectiveLabels.includes(col));
    }
    return [];
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-250px)] overflow-x-auto pb-4 scrollbar-hide">
      {columns.map(col => {
        const columnTasks = getTasksForColumn(col);
        
        // Sub-grouping logic for Area view
        const subGroups = group === 'area' && col !== 'Inbox' ? (() => {
          const groups: Record<string, typeof columnTasks> = { 'Direct Tasks': [] };
          columnTasks.forEach(t => {
            const key = t.projectName || 'Direct Tasks';
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
          });
          return groups;
        })() : { [col]: columnTasks };

        return (
          <div key={col} className="flex flex-col gap-4 min-w-[320px] max-w-[320px]">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate pr-2">{col}</h4>
              <span className="text-xs font-medium text-gray-400 bg-black/5 px-2 py-0.5 rounded-full shrink-0">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
              {Object.entries(subGroups).map(([subName, tasks]) => (
                <div key={subName} className="space-y-3">
                  {group === 'area' && col !== 'Inbox' && (
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{subName}</span>
                      <div className="h-px flex-1 bg-black/5" />
                    </div>
                  )}
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="glass p-4 rounded-xl group hover:border-accent/30 transition-all cursor-pointer"
                      onClick={() => onEdit(task)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="text-sm font-semibold leading-tight">{task.title}</h5>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconButton icon={Edit2} className="p-1" onClick={(e) => { e.stopPropagation(); onEdit(task); }} />
                            <IconButton icon={Trash2} className="p-1 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} />
                          </div>
                          {task.areaColor && (
                            <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: task.areaColor }} />
                          )}
                        </div>
                      </div>
                      {(task.areaName || task.projectName || task.phaseName) && (
                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-3 flex items-center gap-1">
                          {task.areaColor && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.areaColor }} />}
                          {!task.areaColor && <Layers size={10} />}
                          {task.areaName || 'Inbox'}
                          {task.projectName && ` > ${task.projectName}`}
                          {task.phaseName && ` > ${task.phaseName}`}
                        </div>
                      )}
                      {d.showDescription && task.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.showPriority && (
                          <Badge className={cn(
                            task.priority === 'P1' ? "bg-red-50 text-red-500" :
                            task.priority === 'P2' ? "bg-orange-50 text-orange-500" :
                            "bg-blue-50 text-blue-500"
                          )}>
                            {task.priority}
                          </Badge>
                        )}
                        {d.showLabels && task.effectiveLabels && task.effectiveLabels.length > 0 && (
                          <div className="flex items-center gap-1">
                            {task.effectiveLabels.slice(0, 2).map((label: string) => (
                              <Badge key={label} className="bg-accent/5 text-accent border border-accent/10">{label}</Badge>
                            ))}
                            {task.effectiveLabels.length > 2 && <span className="text-[10px] text-gray-400">+{task.effectiveLabels.length - 2}</span>}
                          </div>
                        )}
                        {d.showEnergy && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            <Zap size={10} className={task.energy === 'High' ? "text-yellow-500" : "text-blue-400"} />
                            {task.energy}
                          </div>
                        )}
                        {d.showDeadline && task.deadline && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            <Clock size={10} />
                            {format(new Date(task.deadline), 'MMM d')}
                          </div>
                        )}
                        {d.showAttachments && task.attachments && task.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            <File size={10} />
                            {task.attachments.length}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InboxView({ data, sort, group, filter, searchQuery, display, showBacklog, deadlineView, onToggle, onEdit, onDelete, onUpload }: { data: any, sort: string, group: string, filter: any, searchQuery?: string, display?: DisplaySettings, showBacklog?: boolean, deadlineView?: 'all' | 'today' | 'overdue' | 'no-date', onToggle: any, onEdit: any, onDelete: any, onUpload: any }) {
  const allTasks = useMemo(() => {
    let tasks: (Task & { phaseName?: string, projectName?: string, areaName?: string, areaColor?: string, projectId?: string, phaseId?: string, areaId?: string, effectiveLabels: string[], projectStatus?: string })[] = [
      ...data.inbox.map((t: Task) => ({ ...t, effectiveLabels: t.labels || [] }))
    ];
    data.areas.forEach((area: Area) => {
      if (area.inactive) return;
      (area.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, areaColor: area.color, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(area.labels || [])])) }));
      area.projects.forEach(project => {
        (project.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, areaColor: area.color, projectName: project.title, projectId: project.id, projectStatus: project.status, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(project.labels || [])])) }));
        project.phases.forEach(phase => {
          phase.tasks.forEach(task => {
            tasks.push({
              ...task,
              areaName: area.title,
              areaId: area.id,
              areaColor: area.color,
              phaseName: phase.title,
              projectName: project.title,
              projectId: project.id,
              projectStatus: project.status,
              phaseId: phase.id,
              effectiveLabels: Array.from(new Set([...(task.labels || []), ...(phase.labels || []), ...(project.labels || [])]))
            });
          });
        });
      });
    });

    // Filter out tasks from backlogged projects unless showBacklog is on
    if (!showBacklog) tasks = tasks.filter(t => !t.projectStatus || t.projectStatus !== 'Backlog');

    // Filter out Done tasks unless explicitly filtered
    if (!filter.status) tasks = tasks.filter(t => t.status !== 'Done');
    else tasks = tasks.filter(t => t.status === filter.status);

    if (filter.label) tasks = tasks.filter(t => t.effectiveLabels.includes(filter.label));

    if (searchQuery) tasks = tasks.filter(t => taskMatchesSearch(t, searchQuery));

    // Deadline view filter
    if (deadlineView && deadlineView !== 'all') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (deadlineView === 'today') tasks = tasks.filter(t => t.deadline && t.deadline.split('T')[0] === todayStr);
      else if (deadlineView === 'overdue') tasks = tasks.filter(t => t.deadline && t.deadline.split('T')[0] < todayStr);
      else if (deadlineView === 'no-date') tasks = tasks.filter(t => !t.deadline);
    }

    // Sort
    tasks.sort((a, b) => {
      if (sort === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sort === 'priority') {
        const pMap = { P1: 0, P2: 1, P3: 2 };
        return pMap[a.priority] - pMap[b.priority];
      }
      if (sort === 'energy') {
        const eMap = { High: 0, Low: 1 };
        return eMap[a.energy] - eMap[b.energy];
      }
      return 0;
    });

    return tasks;
  }, [data, sort, filter, searchQuery, showBacklog, deadlineView]);

  const groupedTasks = useMemo(() => {
    if (group === 'none') return { 'All Tasks': allTasks };
    const groups: Record<string, typeof allTasks> = {};
    allTasks.forEach(task => {
      let keys = ['Other'];
      if (group === 'project') keys = [task.projectName || 'Inbox'];
      if (group === 'phase') keys = [task.phaseName || 'No Phase'];
      if (group === 'status') keys = [task.status];
      if (group === 'label') keys = task.effectiveLabels.length > 0 ? task.effectiveLabels : ['No Label'];
      
      keys.forEach(key => {
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
    });
    return groups;
  }, [allTasks, group]);

  return (
    <div className="space-y-8">
      {Object.entries(groupedTasks).map(([groupName, tasks]) => (
        <div key={groupName} className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{groupName}</h4>
            <div className="h-px flex-1 bg-black/5" />
            <span className="text-xs font-medium text-gray-400">{tasks.length}</span>
          </div>
          <TaskList tasks={tasks} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} display={display} />
        </div>
      ))}
    </div>
  );
}

function CompletedView({ data, searchQuery, onToggle, onEdit, onDelete }: { data: any, searchQuery?: string, onToggle: any, onEdit: any, onDelete: any }) {
  const completedTasks = useMemo(() => {
    let tasks: (Task & { phaseName?: string, projectName?: string, areaName?: string })[] = [...data.inbox.filter((t: Task) => t.status === 'Done')];
    data.areas.forEach((area: Area) => {
      area.tasks.filter(t => t.status === 'Done').forEach(t => tasks.push({ ...t, areaName: area.title }));
      area.projects.forEach(project => {
        project.tasks.filter(t => t.status === 'Done').forEach(t => tasks.push({ ...t, areaName: area.title, projectName: project.title }));
        project.phases.forEach(phase => {
          phase.tasks.filter(t => t.status === 'Done').forEach(t => tasks.push({ ...t, areaName: area.title, projectName: project.title, phaseName: phase.title }));
        });
      });
    });
    if (searchQuery) tasks = tasks.filter(t => taskMatchesSearch(t, searchQuery));
    return tasks;
  }, [data, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completed Tasks</h4>
        <div className="h-px flex-1 bg-black/5" />
        <span className="text-xs font-medium text-gray-400">{completedTasks.length}</span>
      </div>
      <TaskList tasks={completedTasks} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// --- Graph View (Obsidian-style force-directed) ---

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  nodeType: 'areaGroup' | 'area' | 'project' | 'phase' | 'task';
  status?: string;
  nodeId: string;
  areaId?: string;
  projectId?: string;
  phaseId?: string;
  areaColor?: string;
  location?: string;
  connectionCount: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  isDependency: boolean;
}

const GRAPH_TYPE_COLORS: Record<string, string> = {
  areaGroup: '#6b7280',
  area: '#8b5cf6',
  project: '#3b82f6',
  phase: '#f59e0b',
  task: '#10b981',
};

function GraphView({ data, searchQuery, onNavigate }: { data: LifeOSData, searchQuery?: string, onNavigate: (view: any) => void }) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const simulationRef = React.useRef<any>(null);
  const [filterArea, setFilterArea] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState('');
  const [showBacklogged, setShowBacklogged] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const isPanning = React.useRef(false);
  const panStart = React.useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Build graph data
  const { rawNodes, rawLinks } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const connectionCounter: Record<string, number> = {};

    const addConnection = (id: string) => { connectionCounter[id] = (connectionCounter[id] || 0) + 1; };

    // AreaGroups
    (data.areaGroups || []).forEach(group => {
      nodes.push({ id: `group-${group.id}`, label: group.title, nodeType: 'areaGroup', nodeId: group.id, connectionCount: 0 });
    });

    // Areas
    data.areas.forEach(area => {
      nodes.push({ id: `area-${area.id}`, label: area.title, nodeType: 'area', nodeId: area.id, areaColor: area.color, status: area.inactive ? 'Inactive' : undefined, connectionCount: 0 });
      if (area.groupId) {
        links.push({ id: `e-g-${area.groupId}-a-${area.id}`, source: `group-${area.groupId}`, target: `area-${area.id}`, isDependency: false });
        addConnection(`group-${area.groupId}`); addConnection(`area-${area.id}`);
      }

      // Area tasks
      area.tasks.forEach(task => {
        nodes.push({ id: `task-${task.id}`, label: task.title, nodeType: 'task', nodeId: task.id, areaId: area.id, areaColor: area.color, status: task.status, connectionCount: 0 });
        links.push({ id: `e-a-${area.id}-t-${task.id}`, source: `area-${area.id}`, target: `task-${task.id}`, isDependency: false });
        addConnection(`area-${area.id}`); addConnection(`task-${task.id}`);
        (task.dependsOn || []).forEach(depId => {
          links.push({ id: `dep-t-${task.id}-${depId}`, source: `task-${depId}`, target: `task-${task.id}`, isDependency: true });
          addConnection(`task-${depId}`); addConnection(`task-${task.id}`);
        });
      });

      // Projects
      area.projects.forEach(project => {
        nodes.push({ id: `project-${project.id}`, label: project.title, nodeType: 'project', nodeId: project.id, areaId: area.id, areaColor: area.color, status: project.status, connectionCount: 0 });
        links.push({ id: `e-a-${area.id}-p-${project.id}`, source: `area-${area.id}`, target: `project-${project.id}`, isDependency: false });
        addConnection(`area-${area.id}`); addConnection(`project-${project.id}`);
        (project.dependsOn || []).forEach(depId => {
          links.push({ id: `dep-p-${project.id}-${depId}`, source: `project-${depId}`, target: `project-${project.id}`, isDependency: true });
          addConnection(`project-${depId}`); addConnection(`project-${project.id}`);
        });

        // Project tasks
        project.tasks.forEach(task => {
          nodes.push({ id: `task-${task.id}`, label: task.title, nodeType: 'task', nodeId: task.id, areaId: area.id, projectId: project.id, areaColor: area.color, status: task.status, connectionCount: 0 });
          links.push({ id: `e-p-${project.id}-t-${task.id}`, source: `project-${project.id}`, target: `task-${task.id}`, isDependency: false });
          addConnection(`project-${project.id}`); addConnection(`task-${task.id}`);
          (task.dependsOn || []).forEach(depId => {
            links.push({ id: `dep-t-${task.id}-${depId}`, source: `task-${depId}`, target: `task-${task.id}`, isDependency: true });
            addConnection(`task-${depId}`); addConnection(`task-${task.id}`);
          });
        });

        // Phases
        project.phases.forEach(phase => {
          nodes.push({ id: `phase-${phase.id}`, label: phase.title, nodeType: 'phase', nodeId: phase.id, areaId: area.id, projectId: project.id, areaColor: area.color, status: phase.status, connectionCount: 0 });
          links.push({ id: `e-p-${project.id}-ph-${phase.id}`, source: `project-${project.id}`, target: `phase-${phase.id}`, isDependency: false });
          addConnection(`project-${project.id}`); addConnection(`phase-${phase.id}`);
          (phase.dependsOn || []).forEach(depId => {
            links.push({ id: `dep-ph-${phase.id}-${depId}`, source: `phase-${depId}`, target: `phase-${phase.id}`, isDependency: true });
            addConnection(`phase-${depId}`); addConnection(`phase-${phase.id}`);
          });

          phase.tasks.forEach(task => {
            nodes.push({ id: `task-${task.id}`, label: task.title, nodeType: 'task', nodeId: task.id, areaId: area.id, projectId: project.id, phaseId: phase.id, areaColor: area.color, status: task.status, connectionCount: 0 });
            links.push({ id: `e-ph-${phase.id}-t-${task.id}`, source: `phase-${phase.id}`, target: `task-${task.id}`, isDependency: false });
            addConnection(`phase-${phase.id}`); addConnection(`task-${task.id}`);
            (task.dependsOn || []).forEach(depId => {
              links.push({ id: `dep-t-${task.id}-${depId}`, source: `task-${depId}`, target: `task-${task.id}`, isDependency: true });
              addConnection(`task-${depId}`); addConnection(`task-${task.id}`);
            });
          });
        });
      });
    });

    // Inbox tasks
    data.inbox.forEach(task => {
      nodes.push({ id: `task-${task.id}`, label: task.title, nodeType: 'task', nodeId: task.id, location: 'inbox', status: task.status, connectionCount: 0 });
      (task.dependsOn || []).forEach(depId => {
        links.push({ id: `dep-t-${task.id}-${depId}`, source: `task-${depId}`, target: `task-${task.id}`, isDependency: true });
        addConnection(`task-${depId}`); addConnection(`task-${task.id}`);
      });
    });

    // Assign connection counts
    nodes.forEach(n => { n.connectionCount = connectionCounter[n.id] || 0; });

    // Filter out links that reference non-existing nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));

    return { rawNodes: nodes, rawLinks: validLinks };
  }, [data]);

  // Filter
  const { filteredNodes, filteredLinks } = useMemo(() => {
    // Collect hidden project/area IDs for filtering their children
    const hiddenProjectIds = new Set<string>();
    const hiddenAreaIds = new Set<string>();
    if (!showBacklogged) {
      rawNodes.forEach(n => { if (n.nodeType === 'project' && n.status === 'Backlog') hiddenProjectIds.add(n.nodeId); });
    }
    if (!showInactive) {
      rawNodes.forEach(n => { if (n.nodeType === 'area' && n.status === 'Inactive') hiddenAreaIds.add(n.nodeId); });
    }

    const fn = rawNodes.filter(n => {
      if (hiddenTypes.has(n.nodeType)) return false;
      if (filterArea && n.areaId && n.areaId !== filterArea) return false;
      if (filterStatus && n.status && n.status !== filterStatus) return false;
      if (!showBacklogged && n.nodeType === 'project' && n.status === 'Backlog') return false;
      if (!showInactive && n.nodeType === 'area' && n.status === 'Inactive') return false;
      if (n.areaId && hiddenAreaIds.has(n.areaId)) return false;
      if (n.projectId && hiddenProjectIds.has(n.projectId)) return false;
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!n.label.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const fnIds = new Set(fn.map(n => n.id));
    const fl = rawLinks.filter(l => fnIds.has(l.source as string) && fnIds.has(l.target as string));
    return { filteredNodes: fn, filteredLinks: fl };
  }, [rawNodes, rawLinks, hiddenTypes, filterArea, filterStatus, searchQuery, showBacklogged, showInactive]);

  // Run force simulation
  React.useEffect(() => {
    if (filteredNodes.length === 0) return;

    const nodes = filteredNodes.map(n => ({ ...n }));
    const links = filteredLinks.map(l => ({ ...l, source: l.source as string, target: l.target as string }));

    const sim = forceSimulation(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(120).strength(0.4))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(0, 0).strength(0.1))
      .force('collide', forceCollide<GraphNode>().radius(d => getNodeRadius(d) + 20).strength(0.7))
      .force('x', forceX(0).strength(0.02))
      .force('y', forceY(0).strength(0.02))
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    simulationRef.current = sim;

    sim.on('tick', () => {
      setGraphNodes([...nodes]);
      setGraphLinks(links.map(l => ({
        ...l,
        source: (l.source as any).id || l.source,
        target: (l.target as any).id || l.target,
        _sx: (l.source as any).x,
        _sy: (l.source as any).y,
        _tx: (l.target as any).x,
        _ty: (l.target as any).y,
      })) as any);
    });

    // Run for initial stabilization
    sim.alpha(1).restart();

    return () => { sim.stop(); };
  }, [filteredNodes, filteredLinks]);

  // Node size based on connection count
  const getNodeRadius = (node: GraphNode) => {
    const base = node.nodeType === 'areaGroup' ? 28 : node.nodeType === 'area' ? 24 : node.nodeType === 'project' ? 20 : node.nodeType === 'phase' ? 16 : 12;
    return base + Math.min(node.connectionCount * 3, 20);
  };

  const getNodeColor = (node: GraphNode) => node.areaColor || GRAPH_TYPE_COLORS[node.nodeType] || '#6b7280';

  // Shape paths for each type
  const getNodeShape = (node: GraphNode, r: number) => {
    const type = node.nodeType;
    if (type === 'areaGroup') {
      // Hexagon
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
      });
      return `M${pts.join('L')}Z`;
    }
    if (type === 'area') {
      // Rounded square (use rect, but for path: square with chamfered corners)
      const s = r * 0.85;
      const c = s * 0.3;
      return `M${-s + c},${-s} L${s - c},${-s} Q${s},${-s} ${s},${-s + c} L${s},${s - c} Q${s},${s} ${s - c},${s} L${-s + c},${s} Q${-s},${s} ${-s},${s - c} L${-s},${-s + c} Q${-s},${-s} ${-s + c},${-s}Z`;
    }
    if (type === 'project') {
      // Diamond
      return `M0,${-r} L${r},0 L0,${r} L${-r},0Z`;
    }
    if (type === 'phase') {
      // Pentagon
      const pts = Array.from({ length: 5 }, (_, i) => {
        const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
        return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
      });
      return `M${pts.join('L')}Z`;
    }
    // Task: circle (use circle element instead, but we can approximate)
    return '';
  };

  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.max(0.1, Math.min(4, transform.k * delta));
    // Zoom toward mouse position
    const newX = mouseX - (mouseX - transform.x) * (newK / transform.k);
    const newY = mouseY - (mouseY - transform.y) * (newK / transform.k);
    setTransform({ x: newX, y: newY, k: newK });
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      setTransform(t => ({
        ...t,
        x: panStart.current.tx + (e.clientX - panStart.current.x),
        y: panStart.current.ty + (e.clientY - panStart.current.y),
      }));
    }
    if (dragNode && simulationRef.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - transform.x) / transform.k;
      const y = (e.clientY - rect.top - transform.y) / transform.k;

      const sim = simulationRef.current;
      const node = sim.nodes().find((n: any) => n.id === dragNode);
      if (node) {
        node.fx = x;
        node.fy = y;
        sim.alpha(0.3).restart();
      }
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    if (dragNode && simulationRef.current) {
      const sim = simulationRef.current;
      const node = sim.nodes().find((n: any) => n.id === dragNode);
      if (node) {
        node.fx = null;
        node.fy = null;
        sim.alpha(0.3).restart();
      }
      setDragNode(null);
    }
  };

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDragNode(nodeId);
    if (simulationRef.current) {
      const sim = simulationRef.current;
      const node = sim.nodes().find((n: any) => n.id === nodeId);
      if (node) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        node.fx = (e.clientX - rect.left - transform.x) / transform.k;
        node.fy = (e.clientY - rect.top - transform.y) / transform.k;
        sim.alpha(0.3).restart();
      }
    }
  };

  // Center view
  const centerView = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTransform({ x: rect.width / 2, y: rect.height / 2, k: 1 });
  };

  React.useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTransform({ x: rect.width / 2, y: rect.height / 2, k: 0.8 });
  }, []);

  const handleNavigate = () => {
    if (!selectedNode) return;
    const { nodeType, nodeId, areaId, projectId } = selectedNode;
    if (nodeType === 'area') onNavigate({ type: 'area', id: nodeId });
    else if (nodeType === 'project') onNavigate({ type: 'project', id: nodeId, parentId: areaId });
    else if (nodeType === 'phase') onNavigate({ type: 'phase', id: nodeId, parentId: projectId, grandParentId: areaId });
    else if (nodeType === 'task' && selectedNode.location === 'inbox') onNavigate({ type: 'inbox' });
    else if (nodeType === 'task') onNavigate(areaId ? { type: 'area', id: areaId } : { type: 'inbox' });
    setSelectedNode(null);
  };

  // Build a lookup for rendering
  const nodeMap = useMemo(() => {
    const m: Record<string, GraphNode> = {};
    graphNodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [graphNodes]);

  // Connected node highlighting
  const connectedIds = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>([hoveredNode]);
    graphLinks.forEach((l: any) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      if (src === hoveredNode) ids.add(tgt);
      if (tgt === hoveredNode) ids.add(src);
    });
    return ids;
  }, [hoveredNode, graphLinks]);

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        {/* Type toggles */}
        {(['areaGroup', 'area', 'project', 'phase', 'task'] as const).map(type => {
          const labels: Record<string, string> = { areaGroup: 'Groups', area: 'Areas', project: 'Projects', phase: 'Phases', task: 'Tasks' };
          const isVisible = !hiddenTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => setHiddenTypes(prev => {
                const next = new Set(prev);
                if (next.has(type)) next.delete(type); else next.add(type);
                return next;
              })}
              className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5",
                isVisible ? "border-black/10 text-gray-700 bg-white" : "border-transparent bg-black/5 text-gray-400 line-through"
              )}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isVisible ? GRAPH_TYPE_COLORS[type] : '#d1d5db' }} />
              {labels[type]}
            </button>
          );
        })}
        <div className="h-4 w-px bg-black/10" />
        <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="bg-black/5 border-none rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-accent outline-none">
          <option value="">All Areas</option>
          {data.areas.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-black/5 border-none rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-accent outline-none">
          <option value="">All Statuses</option>
          <option value="Backlog">Backlog</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
        <div className="h-4 w-px bg-black/10" />
        <button
          onClick={() => setShowBacklogged(prev => !prev)}
          className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors",
            showBacklogged ? "border-amber-300 text-amber-700 bg-amber-50" : "border-transparent bg-black/5 text-gray-400"
          )}
        >
          Backlogged
        </button>
        <button
          onClick={() => setShowInactive(prev => !prev)}
          className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors",
            showInactive ? "border-gray-400 text-gray-700 bg-gray-100" : "border-transparent bg-black/5 text-gray-400"
          )}
        >
          Inactive
        </button>
        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="-7 -7 14 14"><polygon points={Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 6; return `${Math.cos(a) * 6},${Math.sin(a) * 6}`; }).join(' ')} fill="#6b7280" /></svg>
            Group
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="-7 -7 14 14"><rect x="-5" y="-5" width="10" height="10" rx="2" fill="#6b7280" /></svg>
            Area
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="-7 -7 14 14"><polygon points="0,-6 6,0 0,6 -6,0" fill="#6b7280" /></svg>
            Project
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="-7 -7 14 14"><polygon points={Array.from({ length: 5 }, (_, i) => { const a = (Math.PI * 2 / 5) * i - Math.PI / 2; return `${Math.cos(a) * 6},${Math.sin(a) * 6}`; }).join(' ')} fill="#6b7280" /></svg>
            Phase
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="-7 -7 14 14"><circle r="5" fill="#6b7280" /></svg>
            Task
          </span>
          <span className="w-px h-3 bg-black/10" />
          <span className="flex items-center gap-1"><span className="w-5 h-0.5 bg-gray-300 inline-block" /> Hierarchy</span>
          <span className="flex items-center gap-1"><span className="w-5 h-0.5 inline-block" style={{ borderTop: '2px dashed #f59e0b' }} /> Dependency</span>
        </div>
        <button onClick={centerView} className="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-gray-500 transition-colors" title="Center view">
          <Target size={14} />
        </button>
      </div>

      {/* SVG Graph Canvas */}
      <div
        ref={containerRef}
        className="rounded-2xl border border-black/10 overflow-hidden bg-[#fafafa] relative select-none"
        style={{ height: 'calc(100% - 50px)', cursor: dragNode ? 'grabbing' : isPanning.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg ref={svgRef} width="100%" height="100%" className="block">
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges */}
            {graphLinks.map((link: any) => {
              const src = nodeMap[typeof link.source === 'object' ? link.source.id : link.source];
              const tgt = nodeMap[typeof link.target === 'object' ? link.target.id : link.target];
              if (!src || !tgt || src.x == null || tgt.x == null) return null;
              const isHighlighted = hoveredNode && (connectedIds.has(src.id) && connectedIds.has(tgt.id));
              const opacity = hoveredNode ? (isHighlighted ? 1 : 0.1) : 0.4;
              return (
                <line
                  key={link.id}
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  stroke={link.isDependency ? '#f59e0b' : '#cbd5e1'}
                  strokeWidth={link.isDependency ? 1.5 : 1}
                  strokeDasharray={link.isDependency ? '6 4' : undefined}
                  opacity={opacity}
                  style={{ transition: 'opacity 0.2s' }}
                />
              );
            })}
            {/* Nodes */}
            {graphNodes.map(node => {
              if (node.x == null || node.y == null) return null;
              const r = getNodeRadius(node);
              const color = getNodeColor(node);
              const isHovered = hoveredNode === node.id;
              const isConnected = connectedIds.has(node.id);
              const opacity = hoveredNode ? (isConnected ? 1 : 0.15) : 1;
              const shape = node.nodeType === 'task' ? null : getNodeShape(node, r);
              const showLabel = transform.k > 0.4 || isHovered;

              return (
                <g
                  key={node.id}
                  className="graph-node"
                  transform={`translate(${node.x},${node.y})`}
                  style={{ cursor: 'pointer', opacity, transition: 'opacity 0.2s' }}
                  onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
                >
                  {/* Glow on hover */}
                  {isHovered && (
                    node.nodeType === 'task'
                      ? <circle r={r + 6} fill={color} opacity={0.15} />
                      : <path d={getNodeShape(node, r + 6)} fill={color} opacity={0.15} />
                  )}
                  {/* Shape */}
                  {node.nodeType === 'task' ? (
                    <circle
                      r={r}
                      fill={color}
                      opacity={0.9}
                      stroke={isHovered ? '#fff' : 'transparent'}
                      strokeWidth={2}
                    />
                  ) : (
                    <path
                      d={shape!}
                      fill={color}
                      opacity={0.85}
                      stroke={isHovered ? '#fff' : `${color}40`}
                      strokeWidth={node.nodeType === 'area' ? 3 : 2}
                    />
                  )}
                  {/* Inner icon/text */}
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fill="white"
                    fontSize={Math.max(8, r * 0.45)}
                    fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.label.substring(0, r > 20 ? 3 : 1).toUpperCase()}
                  </text>
                  {/* Label below */}
                  {showLabel && (
                    <text
                      textAnchor="middle"
                      y={r + 14}
                      fill="#374151"
                      fontSize={10}
                      fontWeight="500"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1">
          <button onClick={() => setTransform(t => ({ ...t, k: Math.min(4, t.k * 1.3) }))} className="w-8 h-8 rounded-lg bg-white shadow-md border border-black/10 flex items-center justify-center text-gray-500 hover:text-gray-700 text-lg font-bold">+</button>
          <button onClick={() => setTransform(t => ({ ...t, k: Math.max(0.1, t.k * 0.77) }))} className="w-8 h-8 rounded-lg bg-white shadow-md border border-black/10 flex items-center justify-center text-gray-500 hover:text-gray-700 text-lg font-bold">-</button>
          <button onClick={centerView} className="w-8 h-8 rounded-lg bg-white shadow-md border border-black/10 flex items-center justify-center text-gray-500 hover:text-gray-700"><Target size={14} /></button>
        </div>
      </div>

      {/* Info popup */}
      <AnimatePresence>
        {selectedNode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedNode(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getNodeColor(selectedNode) }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{selectedNode.nodeType}</span>
              </div>
              <h3 className="text-lg font-bold mb-1">{selectedNode.label}</h3>
              {selectedNode.status && (
                <Badge className={cn(
                  selectedNode.status === 'Done' ? "bg-green-50 text-green-600" :
                  selectedNode.status === 'In Progress' ? "bg-accent/10 text-accent" :
                  "bg-black/5 text-gray-500"
                )}>{selectedNode.status}</Badge>
              )}
              <p className="text-xs text-gray-400 mt-2">{selectedNode.connectionCount} connection{selectedNode.connectionCount !== 1 ? 's' : ''}</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setSelectedNode(null)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Close</button>
                <button onClick={handleNavigate} className="px-4 py-2 bg-accent text-white rounded-full text-sm font-medium">Open Detail View</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsView({ data, updateData, deleteArea }: { data: any, updateData: any, deleteArea: any }) {
  const settings: AppSettings = data.settings || {
    taskStatuses: ['Backlog', 'In Progress', 'Done'],
    projectStatuses: ['Backlog', 'In Progress', 'Done'],
    phaseStatuses: ['Backlog', 'In Progress', 'Done'],
    display: { showPriority: true, showEnergy: true, showDeadline: true, showLabels: true, showAttachments: true, showDescription: true }
  };

  const [newTaskStatus, setNewTaskStatus] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState('');
  const [newPhaseStatus, setNewPhaseStatus] = useState('');

  const updateSettings = (patch: Partial<AppSettings>) => {
    updateData({ ...data, settings: { ...settings, ...patch } });
  };

  const addStatus = (type: 'taskStatuses' | 'projectStatuses' | 'phaseStatuses', value: string, setter: (v: string) => void) => {
    if (value.trim() && !settings[type].includes(value.trim())) {
      updateSettings({ [type]: [...settings[type], value.trim()] });
      setter('');
    }
  };

  const removeStatus = (type: 'taskStatuses' | 'projectStatuses' | 'phaseStatuses', value: string) => {
    if (settings[type].length > 1) {
      updateSettings({ [type]: settings[type].filter(s => s !== value) });
    }
  };

  const toggleDisplay = (key: keyof DisplaySettings) => {
    updateSettings({ display: { ...settings.display, [key]: !settings.display[key] } });
  };

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Display Preferences</h3>
        <div className="glass p-6 rounded-2xl space-y-3">
          <p className="text-xs text-gray-400 mb-2">Choose which fields to show on task cards.</p>
          {([
            ['showPriority', 'Priority'],
            ['showEnergy', 'Energy Level'],
            ['showDeadline', 'Deadline'],
            ['showLabels', 'Labels'],
            ['showAttachments', 'Attachments'],
            ['showDescription', 'Description'],
          ] as [keyof DisplaySettings, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <button
                onClick={() => toggleDisplay(key)}
                className={cn("w-10 h-6 rounded-full transition-colors flex items-center px-1", settings.display[key] ? "bg-accent justify-end" : "bg-black/10 justify-start")}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Custom Statuses</h3>
        {([
          ['taskStatuses', 'Task Statuses', newTaskStatus, setNewTaskStatus],
          ['projectStatuses', 'Project Statuses', newProjectStatus, setNewProjectStatus],
          ['phaseStatuses', 'Phase Statuses', newPhaseStatus, setNewPhaseStatus],
        ] as [keyof Pick<AppSettings, 'taskStatuses' | 'projectStatuses' | 'phaseStatuses'>, string, string, (v: string) => void][]).map(([key, label, value, setter]) => (
          <div key={key} className="glass p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</h4>
            <div className="flex flex-wrap gap-2">
              {settings[key].map((status: string) => (
                <span key={status} className="bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2">
                  {status}
                  {settings[key].length > 1 && (
                    <button onClick={() => removeStatus(key, status)} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 bg-black/5 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent outline-none"
                placeholder="Add new status..."
                value={value}
                onChange={(e) => setter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStatus(key, value, setter)}
              />
              <button onClick={() => addStatus(key, value, setter)} className="p-2 bg-accent text-white rounded-lg"><Plus size={16} /></button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Manage Areas</h3>
        <div className="space-y-2">
          {data.areas.map((area: Area) => (
            <div key={area.id} className="glass p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                  <Briefcase size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{area.title}</h4>
                  <p className="text-xs text-gray-400">{area.projects.length} Projects</p>
                </div>
              </div>
              <button
                onClick={() => deleteArea(area.id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Data Management</h3>
        <div className="glass p-6 rounded-2xl space-y-4">
          <p className="text-sm text-gray-500">Your data is synced to the cloud. You can export it or reset the application.</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'arthuros-data.json';
                a.click();
              }}
              className="px-4 py-2 bg-black/5 hover:bg-black/10 rounded-full text-xs font-medium transition-colors"
            >
              Export Data
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="px-4 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-full text-xs font-medium transition-colors"
            >
              Reset All Data
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TaskList({ tasks, onToggle, onEdit, onDelete, display, onReorder }: { tasks: Task[], onToggle: (id: string) => void, onEdit: (t: Task) => void, onDelete: (id: string) => void, display?: DisplaySettings, onReorder?: (fromIndex: number, toIndex: number) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx && onReorder) {
      onReorder(dragIdx, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const d = display || { showPriority: true, showEnergy: true, showDeadline: true, showLabels: true, showAttachments: true, showDescription: true };

  return (
    <div className="space-y-2">
      {tasks.map((task: any, idx: number) => (
        <div
          key={task.id}
          draggable={!!onReorder}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          className={cn(
            "group glass p-4 rounded-xl flex items-center gap-4 hover:border-accent/30 transition-all cursor-pointer",
            overIdx === idx && dragIdx !== null && dragIdx !== idx && "border-accent/50 bg-accent/5"
          )}
          onClick={() => onEdit(task)}
        >
          {onReorder && (
            <div className="cursor-grab text-gray-300 hover:text-gray-400 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
              <GripVertical size={16} />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className={cn(
              "transition-colors shrink-0",
              task.status === 'Done' ? "text-accent" : "text-gray-300 group-hover:text-gray-400"
            )}
          >
            {task.status === 'Done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
          <div className="flex-1 min-w-0">
            <h5 className={cn(
              "text-sm font-medium transition-all",
              task.status === 'Done' && "text-gray-400 line-through"
            )}>
              {task.title}
            </h5>
            {(task.areaName || task.projectName || task.phaseName) && (
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-1">
                {task.areaColor ? <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.areaColor }} /> : <Layers size={10} />}
                {task.areaName || 'Inbox'}
                {task.projectName && ` > ${task.projectName}`}
                {task.phaseName && ` > ${task.phaseName}`}
              </div>
            )}
            {d.showDescription && task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {d.showPriority && (
                <Badge className={cn(
                  task.priority === 'P1' ? "bg-red-50 text-red-500" :
                  task.priority === 'P2' ? "bg-orange-50 text-orange-500" :
                  "bg-blue-50 text-blue-500"
                )}>
                  {task.priority}
                </Badge>
              )}
              {d.showLabels && task.labels && task.labels.length > 0 && (
                <div className="flex items-center gap-1">
                  {task.labels.map((label: string) => (
                    <Badge key={label} className="bg-accent/5 text-accent border border-accent/10">{label}</Badge>
                  ))}
                </div>
              )}
              {d.showEnergy && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  <Zap size={10} className={task.energy === 'High' ? "text-yellow-500" : "text-blue-400"} />
                  {task.energy} Energy
                </div>
              )}
              {d.showDeadline && task.deadline && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  <Clock size={10} />
                  {format(new Date(task.deadline), 'MMM d')}
                </div>
              )}
              {d.showAttachments && task.attachments && task.attachments.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  <File size={10} />
                  {task.attachments.length}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton icon={Edit2} onClick={(e) => { e.stopPropagation(); onEdit(task); }} />
            <IconButton icon={Trash2} className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} />
          </div>
          {task.areaColor && (
            <div className="w-5 h-5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: task.areaColor }} />
          )}
        </div>
      ))}
      {tasks.length === 0 && (
        <p className="text-center py-4 text-sm text-gray-400 italic">No tasks found</p>
      )}
    </div>
  );
}

function ProjectCard({ project, onClick, onEdit, onDelete }: { project: Project, onClick: () => void, onEdit: (p: Project) => void, onDelete: (id: string) => void }) {
  // Count ALL tasks: direct project tasks + tasks inside phases
  const directDone = (project.tasks || []).filter(t => t.status === 'Done').length;
  const phaseDone = project.phases.reduce((acc, phase) => acc + phase.tasks.filter(t => t.status === 'Done').length, 0);
  const completedTasks = directDone + phaseDone;

  const directTotal = (project.tasks || []).length;
  const phaseTotal = project.phases.reduce((acc, phase) => acc + phase.tasks.length, 0);
  const totalTasks = directTotal + phaseTotal;

  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Timeline progress: how far between start and end date
  const now = Date.now();
  const start = new Date(project.startDate).getTime();
  const end = new Date(project.endDate).getTime();
  const timelineProgress = start < end ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;

  return (
    <div
      onClick={onClick}
      className="glass p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 group-hover:text-accent transition-colors">{project.title}</h4>
            <Badge className={cn(
              project.status === 'Done' ? "bg-green-50 text-green-600" :
              project.status === 'In Progress' ? "bg-accent/10 text-accent" :
              "bg-black/5 text-gray-500"
            )}>{project.status}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{project.description}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconButton icon={Edit2} onClick={(e) => { e.stopPropagation(); onEdit(project); }} />
          <IconButton icon={Trash2} className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} />
        </div>
      </div>

      {(project.showProgress !== false || project.showTimeline !== false) && (
        <div className="space-y-3">
          {project.showProgress !== false && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Tasks</span>
                <span>{completedTasks}/{totalTasks} ({Math.round(taskProgress)}%)</span>
              </div>
              <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${taskProgress}%` }}
                  className="h-full bg-accent"
                />
              </div>
            </div>
          )}
          {project.showTimeline !== false && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Timeline</span>
                <span>{Math.round(timelineProgress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${timelineProgress}%` }}
                  className={cn("h-full", timelineProgress > taskProgress + 20 ? "bg-red-400" : "bg-emerald-400")}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Next event countdown */}
      {(() => {
        const events = (project.events || [])
          .map(ev => {
            const evDate = ev.time ? new Date(`${ev.date}T${ev.time}`) : new Date(ev.date + 'T23:59:59');
            return { ...ev, evDate };
          })
          .filter(ev => ev.evDate.getTime() > Date.now())
          .sort((a, b) => a.evDate.getTime() - b.evDate.getTime());
        const next = events[0];
        if (!next) return null;
        const diffMs = next.evDate.getTime() - Date.now();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Clock size={12} className={diffDays <= 3 ? "text-orange-500" : "text-accent"} />
            <span className={cn("font-medium", diffDays <= 3 ? "text-orange-500" : "text-accent")}>
              {next.title}: {diffDays === 0 ? (next.time ? `${diffHours}h left` : 'Today') :
               diffDays === 1 ? (next.time ? `1d ${diffHours}h` : '1 day left') :
               next.time ? `${diffDays}d ${diffHours}h` : `${diffDays} days left`}
            </span>
          </div>
        );
      })()}

      <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          {format(new Date(project.startDate), 'MMM d')} – {format(new Date(project.endDate), 'MMM d')}
        </div>
        {project.labels && project.labels.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {project.labels.map(label => (
              <Badge key={label} className="bg-accent/5 text-accent border border-accent/10">{label}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match ? match[1] : null;
}

function getUrlDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function DependencySelector({ label, items, selected, onChange }: { label: string, items: { id: string, title: string }[], selected: string[], onChange: (deps: string[]) => void }) {
  const [depSearch, setDepSearch] = useState('');
  if (items.length === 0) return null;

  const filtered = depSearch.trim()
    ? items.filter(t => t.title.toLowerCase().includes(depSearch.trim().toLowerCase()))
    : items;

  // Show selected items first, then filtered unselected
  const selectedItems = items.filter(t => selected.includes(t.id));
  const unselectedFiltered = filtered.filter(t => !selected.includes(t.id));

  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{label}</label>
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedItems.map(t => (
            <button
              key={t.id}
              onClick={() => onChange(selected.filter(id => id !== t.id))}
              className="text-[10px] px-2 py-1 rounded-full border bg-amber-50 text-amber-600 border-amber-200 transition-colors flex items-center gap-1"
            >
              {t.title}
              <X size={8} />
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        placeholder="Search..."
        className="w-full bg-black/5 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-accent outline-none mb-2"
        value={depSearch}
        onChange={(e) => setDepSearch(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {unselectedFiltered.map(t => (
          <button
            key={t.id}
            onClick={() => onChange([...selected, t.id])}
            className="text-[10px] px-2 py-1 rounded-full border bg-black/5 text-gray-500 border-transparent hover:border-black/10 transition-colors"
          >
            {t.title}
          </button>
        ))}
        {unselectedFiltered.length === 0 && depSearch.trim() && (
          <span className="text-[10px] text-gray-400">No matches</span>
        )}
      </div>
    </div>
  );
}

function ResourceList({ resources, onAdd, onDelete, onPreview }: { resources: Resource[], onAdd: (r: Resource) => void, onDelete: (id: string) => void, onPreview: (r: Resource) => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'link' | 'file'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      title: linkTitle.trim() || getUrlDomain(linkUrl),
      content: '',
      type: 'link',
      url: linkUrl.trim(),
      createdAt: new Date().toISOString()
    });
    setLinkUrl('');
    setLinkTitle('');
    setShowAddForm(false);
  };

  const handleFileUpload = (file: globalThis.File) => {
    const url = URL.createObjectURL(file);
    onAdd({
      id: crypto.randomUUID(),
      title: file.name,
      content: '',
      type: 'file',
      url,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      createdAt: new Date().toISOString()
    });
    setShowAddForm(false);
  };

  const getResourceIcon = (res: Resource) => {
    if (res.type === 'link') {
      const ytId = res.url ? getYouTubeId(res.url) : null;
      if (ytId) return <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500"><ExternalLink size={16} /></div>;
      return <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent"><LinkIcon size={16} /></div>;
    }
    if (res.type === 'file') {
      if (res.fileType?.startsWith('image/')) return <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-500"><Image size={16} /></div>;
      if (res.fileType === 'application/pdf') return <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500"><FileText size={16} /></div>;
      if (res.fileType?.includes('spreadsheet') || res.fileType?.includes('excel')) return <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><FileSpreadsheet size={16} /></div>;
      if (res.fileType?.includes('word') || res.fileType?.includes('document')) return <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500"><FileType size={16} /></div>;
      return <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500"><File size={16} /></div>;
    }
    return <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent"><FileText size={16} /></div>;
  };

  return (
    <div className="space-y-3">
      {resources.map(res => {
        const ytId = res.type === 'link' && res.url ? getYouTubeId(res.url) : null;
        return (
          <div key={res.id} className="glass rounded-xl overflow-hidden group">
            {ytId && (
              <div className="w-full aspect-video bg-black/5">
                <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-3 flex items-center gap-3">
              {getResourceIcon(res)}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPreview(res)}>
                <h5 className="text-xs font-semibold truncate">{res.title}</h5>
                <p className="text-[10px] text-gray-400 truncate">
                  {res.type === 'link' ? getUrlDomain(res.url || '') : res.type === 'file' ? `${((res.fileSize || 0) / 1024).toFixed(1)} KB` : 'Note'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {res.type === 'file' && res.url && (
                  <a href={res.url} download={res.fileName} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600"><Download size={14} /></a>
                )}
                {res.type === 'link' && res.url && (
                  <a href={res.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600"><ExternalLink size={14} /></a>
                )}
                <button onClick={() => onDelete(res.id)} className="p-1.5 rounded-lg hover:bg-black/5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        );
      })}

      {showAddForm ? (
        <div className="glass p-4 rounded-xl space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setAddType('link')} className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors", addType === 'link' ? "bg-accent text-white" : "bg-black/5 text-gray-500")}>URL / Link</button>
            <button onClick={() => setAddType('file')} className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors", addType === 'file' ? "bg-accent text-white" : "bg-black/5 text-gray-500")}>File Upload</button>
          </div>
          {addType === 'link' ? (
            <div className="space-y-2">
              <input type="url" placeholder="https://..." className="w-full bg-black/5 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent outline-none" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} autoFocus />
              <input type="text" placeholder="Title (optional)" className="w-full bg-black/5 border-none rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent outline-none" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddLink()} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-gray-500">Cancel</button>
                <button onClick={handleAddLink} className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium">Add Link</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center justify-center gap-2 p-6 border border-dashed border-black/10 rounded-xl text-xs text-gray-400 hover:text-accent hover:border-accent/30 transition-all cursor-pointer">
                <Upload size={16} />
                Choose a file to upload
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              </label>
              <button onClick={() => setShowAddForm(false)} className="w-full px-3 py-1.5 text-xs text-gray-500 text-center">Cancel</button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)} className="w-full py-3 border border-dashed border-black/10 rounded-xl text-xs font-medium text-gray-400 hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center gap-2">
          <Plus size={14} />
          Add Resource
        </button>
      )}
    </div>
  );
}

function FilePreviewModal({ resource, onClose }: { resource: Resource, onClose: () => void }) {
  const isImage = resource.fileType?.startsWith('image/');
  const isPdf = resource.fileType === 'application/pdf';
  const isYouTube = resource.type === 'link' && resource.url ? getYouTubeId(resource.url) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-black/5">
          <h3 className="text-sm font-bold truncate">{resource.title}</h3>
          <div className="flex items-center gap-2">
            {resource.type === 'file' && resource.url && (
              <a href={resource.url} download={resource.fileName} className="p-1.5 rounded-lg hover:bg-black/5 text-gray-500"><Download size={16} /></a>
            )}
            {resource.type === 'link' && resource.url && (
              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-black/5 text-gray-500"><ExternalLink size={16} /></a>
            )}
            <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isYouTube ? (
            <div className="w-full aspect-video">
              <iframe src={`https://www.youtube.com/embed/${isYouTube}`} className="w-full h-full rounded-xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : isImage && resource.url ? (
            <img src={resource.url} alt={resource.title} className="max-w-full mx-auto rounded-xl" />
          ) : isPdf && resource.url ? (
            <iframe src={resource.url} className="w-full h-[70vh] rounded-xl" />
          ) : resource.type === 'link' && resource.url ? (
            <div className="text-center py-12 space-y-4">
              <ExternalLink size={48} className="mx-auto text-gray-300" />
              <p className="text-sm text-gray-500">{resource.url}</p>
              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium">Open Link <ExternalLink size={14} /></a>
            </div>
          ) : resource.type === 'file' ? (
            <div className="text-center py-12 space-y-4">
              <File size={48} className="mx-auto text-gray-300" />
              <p className="text-sm text-gray-500">{resource.fileName || resource.title}</p>
              <p className="text-xs text-gray-400">Preview not available for this file type</p>
              {resource.url && (
                <a href={resource.url} download={resource.fileName} className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium"><Download size={14} /> Download</a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{resource.content}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EditPhaseModal({ phase, appSettings, allPhases, onClose, onSave }: { phase: Phase, appSettings: AppSettings, allPhases?: Phase[], onClose: () => void, onSave: (p: Phase) => void }) {
  const [edited, setEdited] = useState<Phase>({ ...phase });
  const [newLabel, setNewLabel] = useState('');

  const addLabel = () => {
    const labels = edited.labels || [];
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setEdited({ ...edited, labels: [...labels, newLabel.trim()] });
      setNewLabel('');
    }
  };

  const removeLabel = (label: string) => {
    const labels = edited.labels || [];
    setEdited({ ...edited, labels: labels.filter(l => l !== label) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Edit Phase</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Title</label>
            <input 
              type="text" 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={edited.title}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Description</label>
            <textarea 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none h-24 resize-none"
              value={edited.description || ''}
              onChange={(e) => setEdited({ ...edited, description: e.target.value })}
              placeholder="Add an optional description..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
            <select
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={edited.status}
              onChange={(e) => setEdited({ ...edited, status: e.target.value as string })}
            >
              {appSettings.phaseStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Start Date</label>
              <input
                type="date"
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.startDate?.split('T')[0] || ''}
                onChange={(e) => setEdited({ ...edited, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">End Date</label>
              <input
                type="date"
                className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={edited.endDate?.split('T')[0] || ''}
                onChange={(e) => setEdited({ ...edited, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Labels</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(edited.labels || []).map(label => (
                <span key={label} className="bg-accent/10 text-accent px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  {label}
                  <button onClick={() => removeLabel(label)}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                placeholder="New label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
              />
              <button onClick={addLabel} className="p-2 bg-accent text-white rounded-xl"><Plus size={18} /></button>
            </div>
          </div>
          {allPhases && allPhases.length > 1 && (
            <DependencySelector
              label="Dependencies"
              items={allPhases.filter(p => p.id !== phase.id)}
              selected={edited.dependsOn || []}
              onChange={(deps) => setEdited({ ...edited, dependsOn: deps })}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={() => onSave(edited)} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">Save Changes</button>
        </div>
      </motion.div>
    </div>
  );
}

function EditAreaModal({ area, areaGroups, onClose, onSave, onDelete }: { area: Area, areaGroups: AreaGroup[], onClose: () => void, onSave: (a: Area) => void, onDelete: (id: string) => void }) {
  const [edited, setEdited] = useState<Area>({ ...area });
  const [newLabel, setNewLabel] = useState('');

  const addLabel = () => {
    const labels = edited.labels || [];
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setEdited({ ...edited, labels: [...labels, newLabel.trim()] });
      setNewLabel('');
    }
  };

  const removeLabel = (label: string) => {
    const labels = edited.labels || [];
    setEdited({ ...edited, labels: labels.filter(l => l !== label) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Edit Area</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Title</label>
            <input 
              type="text" 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={edited.title}
              onChange={(e) => setEdited({ ...edited, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Description</label>
            <textarea 
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none h-24 resize-none"
              value={edited.description || ''}
              onChange={(e) => setEdited({ ...edited, description: e.target.value })}
              placeholder="Add an optional description..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Group</label>
            <select
              className="w-full bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
              value={edited.groupId || ''}
              onChange={(e) => setEdited({ ...edited, groupId: e.target.value || undefined })}
            >
              <option value="">No Group</option>
              {areaGroups.map(group => (
                <option key={group.id} value={group.id}>{group.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Color</label>
            <div className="flex items-center gap-2">
              {['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'].map(c => (
                <button
                  key={c}
                  onClick={() => setEdited({ ...edited, color: c })}
                  className={cn("w-7 h-7 rounded-full transition-all", edited.color === c ? "ring-2 ring-offset-2 ring-black/20 scale-110" : "hover:scale-110")}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                onClick={() => setEdited({ ...edited, color: undefined })}
                className={cn("w-7 h-7 rounded-full bg-black/5 flex items-center justify-center text-gray-400 text-[10px] font-bold transition-all", !edited.color ? "ring-2 ring-offset-2 ring-black/20 scale-110" : "hover:scale-110")}
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-gray-400">Hex:</span>
              <input
                type="text"
                className="w-28 bg-black/5 border-none rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-accent outline-none"
                placeholder="#000000"
                value={edited.color || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === '#') {
                    setEdited({ ...edited, color: val || undefined });
                  } else if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setEdited({ ...edited, color: val });
                  }
                }}
              />
              {edited.color && /^#[0-9A-Fa-f]{6}$/.test(edited.color) && (
                <div className="w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: edited.color }} />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Active</label>
              <p className="text-[10px] text-gray-400 mt-0.5">Inactive areas are hidden from Global Inbox and Kanban Board</p>
            </div>
            <button
              onClick={() => setEdited({ ...edited, inactive: !edited.inactive })}
              className={cn("w-10 h-6 rounded-full transition-colors flex items-center px-1", !edited.inactive ? "bg-accent justify-end" : "bg-black/10 justify-start")}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </button>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Labels</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(edited.labels || []).map(label => (
                <span key={label} className="bg-accent/10 text-accent px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  {label}
                  <button onClick={() => removeLabel(label)}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-black/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                placeholder="New label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
              />
              <button onClick={addLabel} className="p-2 bg-accent text-white rounded-xl"><Plus size={18} /></button>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-8">
          <button onClick={() => onDelete(area.id)} className="flex items-center gap-2 text-red-500 hover:text-red-600 text-sm font-medium">
            <Trash2 size={16} />
            Delete Area
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={() => onSave(edited)} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">Save Changes</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function EditEventModal({ event, project, onClose, onSave }: {
  event: ProjectEvent | null;
  project: Project;
  onClose: () => void;
  onSave: (event: ProjectEvent) => void;
}) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [date, setDate] = useState(event?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(event?.time || '');
  const [linkedPhaseIds, setLinkedPhaseIds] = useState<string[]>(event?.linkedPhaseIds || []);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>(event?.linkedTaskIds || []);

  const allTasks = [...project.tasks, ...project.phases.flatMap(ph => ph.tasks)];

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: event?.id || Math.random().toString(36).substring(2, 11),
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      time: time || undefined,
      linkedPhaseIds: linkedPhaseIds.length > 0 ? linkedPhaseIds : undefined,
      linkedTaskIds: linkedTaskIds.length > 0 ? linkedTaskIds : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold mb-6">{event ? 'Edit Event' : 'New Event'}</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="Event title..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              rows={2}
              placeholder="Brief description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Time (optional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          {project.phases.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Linked Phases</label>
              <div className="flex flex-wrap gap-2">
                {project.phases.map(phase => (
                  <button
                    key={phase.id}
                    onClick={() => setLinkedPhaseIds(prev =>
                      prev.includes(phase.id) ? prev.filter(id => id !== phase.id) : [...prev, phase.id]
                    )}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      linkedPhaseIds.includes(phase.id)
                        ? "bg-purple-50 text-purple-600 border-purple-200"
                        : "bg-black/5 text-gray-500 border-transparent hover:border-black/10"
                    )}
                  >
                    <Layers size={10} className="inline mr-1" />
                    {phase.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allTasks.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Linked Tasks</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {allTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => setLinkedTaskIds(prev =>
                      prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                    )}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      linkedTaskIds.includes(task.id)
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-black/5 text-gray-500 border-transparent hover:border-black/10"
                    )}
                  >
                    <CheckCircle2 size={10} className="inline mr-1" />
                    {task.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">{event ? 'Save Changes' : 'Create Event'}</button>
        </div>
      </motion.div>
    </div>
  );
}
