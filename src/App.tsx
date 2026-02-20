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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLifeOS } from './hooks/useLifeOS';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import { Area, Project, Phase, Task, Status, Priority, Energy, Resource, Attachment, LifeOSData, AreaGroup } from './types';
import { format } from 'date-fns';

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
    type: 'inbox' | 'area' | 'project' | 'phase' | 'kanban' | 'settings' | 'completed';
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

  // Kanban View State
  const [kanbanGroup, setKanbanGroup] = useState<'status' | 'area' | 'project' | 'priority' | 'energy' | 'label'>('status');
  const [kanbanFilter, setKanbanFilter] = useState<{ status?: string, label?: string, priority?: string, energy?: string }>({});

  // Area View State
  const [areaProjectFilter, setAreaProjectFilter] = useState<string>('');

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
  const handleAddTask = (title: string, target: 'inbox' | 'area' | 'project' | 'phase', id?: string) => {
    const newTask: Task = {
      id: generateId(),
      title: title || 'New Task',
      description: '',
      status: 'Backlog',
      priority: 'P2',
      contextTags: [],
      energy: 'Low',
      labels: [],
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
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                    activeView.type === 'area' && activeView.id === area.id ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5"
                  )}
                >
                  <Briefcase size={18} />
                  {area.title}
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
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                activeView.type === 'area' && activeView.id === area.id ? "bg-accent/10 text-accent" : "text-gray-600 hover:bg-black/5"
              )}
            >
              <Briefcase size={18} />
              {area.title}
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
                  <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-black/5">
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
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                      <Filter size={14} />
                      Filter:
                      <select 
                        className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                        value={inboxFilter.status || ''}
                        onChange={(e) => setInboxFilter({ ...inboxFilter, status: e.target.value || undefined })}
                      >
                        <option value="">All Status</option>
                        <option value="Backlog">Backlog</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
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
                  </div>
                  <InboxView
                    data={data}
                    sort={inboxSort}
                    group={inboxGroup}
                    filter={inboxFilter}
                    searchQuery={searchQuery}
                    onToggle={toggleTaskStatus}
                    onEdit={setEditingTask}
                    onDelete={deleteTask}
                    onUpload={handleFileUpload}
                  />
                </div>
              )}

              {activeView.type === 'kanban' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-black/5 w-fit">
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
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                      <Filter size={14} />
                      Filter:
                      {kanbanGroup !== 'status' && (
                        <select
                          className="bg-transparent text-gray-900 focus:outline-none cursor-pointer"
                          value={kanbanFilter.status || ''}
                          onChange={(e) => setKanbanFilter({ ...kanbanFilter, status: e.target.value || undefined })}
                        >
                          <option value="">All Status</option>
                          <option value="Backlog">Backlog</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
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
                  </div>
                  <KanbanView
                    data={data}
                    group={kanbanGroup}
                    filter={kanbanFilter}
                    searchQuery={searchQuery}
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

              {activeView.type === 'area' && currentArea && (
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
                            <option value="Backlog">Backlog</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
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
                      {currentArea.projects.filter(p => (!areaProjectFilter || p.status === areaProjectFilter) && (!searchQuery || matchesSearch(p.title, searchQuery) || matchesSearch(p.description, searchQuery) || p.labels.some(l => matchesSearch(l, searchQuery)))).map(project => (
                        <ProjectCard 
                          key={project.id} 
                          project={project} 
                          onClick={() => setActiveView({ type: 'project', id: project.id, parentId: currentArea.id })} 
                          onEdit={setEditingProject}
                          onDelete={deleteProject}
                        />
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
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText size={20} className="text-accent" />
                      Resource Library
                    </h3>
                    <ResourceList resources={currentArea.resources} />
                  </div>
                </div>
              )}

              {activeView.type === 'project' && currentProject && (
                <div className="space-y-8">
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
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200" />
                      ))}
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
                        />
                      </div>

                      {currentProject.phases.map(phase => (
                        <div key={phase.id} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
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
                          <TaskList
                            tasks={phase.tasks.filter(t => t.status !== 'Done').filter(t => taskMatchesSearch(t, searchQuery))}
                            onToggle={toggleTaskStatus}
                            onEdit={setEditingTask}
                            onDelete={deleteTask}
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
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText size={20} className="text-accent" />
                        Project Resources
                      </h3>
                      <ResourceList resources={currentProject.resources} />
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
            onConfirm={(val, type, id) => handleAddTask(val, type || isAddingTask.target, id || isAddingTask.id)}
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
            onClose={() => setEditingTask(null)} 
            onSave={updateTask} 
            onMove={moveTask}
          />
        )}
        {editingProject && (
          <EditProjectModal 
            project={editingProject} 
            areas={data.areas}
            onClose={() => setEditingProject(null)} 
            onSave={updateProject} 
            onMove={moveProject}
          />
        )}
        {editingPhase && (
          <EditPhaseModal 
            phase={editingPhase} 
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
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function CreationModal({ title, placeholder, onClose, onConfirm, data, initialTarget }: { title: string, placeholder: string, onClose: () => void, onConfirm: (val: string, targetType?: 'inbox' | 'area' | 'project' | 'phase', targetId?: string) => void, data?: LifeOSData, initialTarget?: { type: 'inbox' | 'area' | 'project' | 'phase', id?: string } }) {
  const [val, setVal] = useState('');
  const [target, setTarget] = useState<{ type: 'inbox' | 'area' | 'project' | 'phase', id?: string }>(initialTarget || { type: 'inbox' });

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
          onKeyDown={(e) => e.key === 'Enter' && onConfirm(val, target.type, target.id)}
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

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={() => onConfirm(val, target.type, target.id)} className="px-6 py-2 bg-accent text-white rounded-full text-sm font-medium">Create</button>
        </div>
      </motion.div>
    </div>
  );
}

function EditTaskModal({ task, data, onClose, onSave, onMove }: { task: Task, data: LifeOSData, onClose: () => void, onSave: (t: Task) => void, onMove: (id: string, type: 'inbox' | 'area' | 'project' | 'phase', targetId?: string) => void }) {
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
                onChange={(e) => setEdited({ ...edited, status: e.target.value as Status })}
              >
                <option value="Backlog">Backlog</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
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

function EditProjectModal({ project, areas, onClose, onSave, onMove }: { project: Project, areas: Area[], onClose: () => void, onSave: (p: Project) => void, onMove: (id: string, targetAreaId: string) => void }) {
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
                onChange={(e) => setEdited({ ...edited, status: e.target.value as Status })}
              >
                <option value="Backlog">Backlog</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
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

function KanbanView({ data, group, filter, searchQuery, onToggle, onEdit, onDelete, onUpload }: { data: any, group: 'status' | 'area' | 'project' | 'priority' | 'energy' | 'label', filter?: { status?: string, label?: string, priority?: string, energy?: string }, searchQuery?: string, onToggle: any, onEdit: any, onDelete: any, onUpload: any }) {
  const allTasks = useMemo(() => {
    let tasks: (Task & { phaseName?: string, projectName?: string, areaName?: string, projectId?: string, phaseId?: string, areaId?: string, effectiveLabels: string[] })[] = [
      ...data.inbox.map((t: Task) => ({ ...t, effectiveLabels: t.labels || [] }))
    ];
    data.areas.forEach((area: Area) => {
      (area.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(area.labels || [])])) }));
      area.projects.forEach(project => {
        (project.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, projectName: project.title, projectId: project.id, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(project.labels || [])])) }));
        project.phases.forEach(phase => {
          phase.tasks.forEach(task => {
            tasks.push({
              ...task,
              areaName: area.title,
              areaId: area.id,
              phaseName: phase.title,
              projectName: project.title,
              projectId: project.id,
              phaseId: phase.id,
              effectiveLabels: Array.from(new Set([...(task.labels || []), ...(phase.labels || []), ...(project.labels || [])]))
            });
          });
        });
      });
    });

    if (!filter?.status) tasks = tasks.filter(t => t.status !== 'Done');
    else tasks = tasks.filter(t => t.status === filter.status);
    if (filter?.priority) tasks = tasks.filter(t => t.priority === filter.priority);
    if (filter?.energy) tasks = tasks.filter(t => t.energy === filter.energy);
    if (filter?.label) tasks = tasks.filter(t => t.effectiveLabels.includes(filter.label!));

    if (searchQuery) tasks = tasks.filter(t => taskMatchesSearch(t, searchQuery));

    return tasks;
  }, [data, filter, searchQuery]);

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
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconButton icon={Edit2} className="p-1" onClick={(e) => { e.stopPropagation(); onEdit(task); }} />
                          <IconButton icon={Trash2} className="p-1 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} />
                        </div>
                      </div>
                      {(task.areaName || task.projectName || task.phaseName) && (
                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-3 flex items-center gap-1">
                          <Layers size={10} />
                          {task.areaName || 'Inbox'}
                          {task.projectName && ` > ${task.projectName}`}
                          {task.phaseName && ` > ${task.phaseName}`}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn(
                          task.priority === 'P1' ? "bg-red-50 text-red-500" :
                          task.priority === 'P2' ? "bg-orange-50 text-orange-500" :
                          "bg-blue-50 text-blue-500"
                        )}>
                          {task.priority}
                        </Badge>
                        {task.deadline && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            <Clock size={10} />
                            {format(new Date(task.deadline), 'MMM d')}
                          </div>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
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

function InboxView({ data, sort, group, filter, searchQuery, onToggle, onEdit, onDelete, onUpload }: { data: any, sort: string, group: string, filter: any, searchQuery?: string, onToggle: any, onEdit: any, onDelete: any, onUpload: any }) {
  const allTasks = useMemo(() => {
    let tasks: (Task & { phaseName?: string, projectName?: string, areaName?: string, projectId?: string, phaseId?: string, areaId?: string, effectiveLabels: string[] })[] = [
      ...data.inbox.map((t: Task) => ({ ...t, effectiveLabels: t.labels || [] }))
    ];
    data.areas.forEach((area: Area) => {
      (area.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(area.labels || [])])) }));
      area.projects.forEach(project => {
        (project.tasks || []).forEach(t => tasks.push({ ...t, areaName: area.title, areaId: area.id, projectName: project.title, projectId: project.id, effectiveLabels: Array.from(new Set([...(t.labels || []), ...(project.labels || [])])) }));
        project.phases.forEach(phase => {
          phase.tasks.forEach(task => {
            tasks.push({ 
              ...task, 
              areaName: area.title,
              areaId: area.id,
              phaseName: phase.title, 
              projectName: project.title, 
              projectId: project.id, 
              phaseId: phase.id,
              effectiveLabels: Array.from(new Set([...(task.labels || []), ...(phase.labels || []), ...(project.labels || [])]))
            });
          });
        });
      });
    });

    // Filter out Done tasks unless explicitly filtered
    if (!filter.status) tasks = tasks.filter(t => t.status !== 'Done');
    else tasks = tasks.filter(t => t.status === filter.status);

    if (filter.label) tasks = tasks.filter(t => t.effectiveLabels.includes(filter.label));

    if (searchQuery) tasks = tasks.filter(t => taskMatchesSearch(t, searchQuery));

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
  }, [data, sort, filter, searchQuery]);

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
          <TaskList tasks={tasks} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
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

function SettingsView({ data, updateData, deleteArea }: { data: any, updateData: any, deleteArea: any }) {
  return (
    <div className="max-w-2xl space-y-8">
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
          <p className="text-sm text-gray-500">Your data is stored locally in your browser. You can export it or reset the application.</p>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'lifeos-data.json';
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

function TaskList({ tasks, onToggle, onEdit, onDelete }: { tasks: Task[], onToggle: (id: string) => void, onEdit: (t: Task) => void, onDelete: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {tasks.map((task: any) => (
        <div 
          key={task.id} 
          className="group glass p-4 rounded-xl flex items-center gap-4 hover:border-accent/30 transition-all cursor-pointer"
          onClick={() => onEdit(task)}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className={cn(
              "transition-colors",
              task.status === 'Done' ? "text-accent" : "text-gray-300 group-hover:text-gray-400"
            )}
          >
            {task.status === 'Done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
          <div className="flex-1">
            <h5 className={cn(
              "text-sm font-medium transition-all",
              task.status === 'Done' && "text-gray-400 line-through"
            )}>
              {task.title}
            </h5>
            {(task.areaName || task.projectName || task.phaseName) && (
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5 flex items-center gap-1">
                <Layers size={10} />
                {task.areaName || 'Inbox'}
                {task.projectName && ` > ${task.projectName}`}
                {task.phaseName && ` > ${task.phaseName}`}
              </div>
            )}
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <Badge className={cn(
                task.priority === 'P1' ? "bg-red-50 text-red-500" :
                task.priority === 'P2' ? "bg-orange-50 text-orange-500" :
                "bg-blue-50 text-blue-500"
              )}>
                {task.priority}
              </Badge>
              {task.labels && task.labels.length > 0 && (
                <div className="flex items-center gap-1">
                  {task.labels.map(label => (
                    <Badge key={label} className="bg-accent/5 text-accent border border-accent/10">{label}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                <Zap size={10} className={task.energy === 'High' ? "text-yellow-500" : "text-blue-400"} />
                {task.energy} Energy
              </div>
              {task.deadline && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  <Clock size={10} />
                  {format(new Date(task.deadline), 'MMM d')}
                </div>
              )}
              {task.attachments && task.attachments.length > 0 && (
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

      <div className="space-y-3">
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
      </div>

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

function ResourceList({ resources }: { resources: Resource[] }) {
  return (
    <div className="space-y-3">
      {resources.map(res => (
        <div key={res.id} className="glass p-3 rounded-xl flex items-center gap-3 hover:bg-white transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center text-accent">
            {res.type === 'link' ? <LinkIcon size={16} /> : <FileText size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-semibold truncate">{res.title}</h5>
            <p className="text-[10px] text-gray-400 truncate">{res.url || 'Note'}</p>
          </div>
        </div>
      ))}
      <button className="w-full py-3 border border-dashed border-black/10 rounded-xl text-xs font-medium text-gray-400 hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center gap-2">
        <Plus size={14} />
        Add Resource
      </button>
    </div>
  );
}

function EditPhaseModal({ phase, onClose, onSave }: { phase: Phase, onClose: () => void, onSave: (p: Phase) => void }) {
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
              onChange={(e) => setEdited({ ...edited, status: e.target.value as Status })}
            >
              <option value="Backlog">Backlog</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
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
