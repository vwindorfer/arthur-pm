export type Priority = 'P1' | 'P2' | 'P3';
export type Energy = 'High' | 'Low';

export interface Resource {
  id: string;
  title: string;
  content: string;
  type: 'link' | 'note' | 'file';
  url?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: Priority;
  contextTags: string[];
  energy: Energy;
  deadline?: string;
  labels: string[];
  attachments?: Attachment[];
  dependsOn?: string[];
  createdAt: string;
}

export interface Phase {
  id: string;
  title: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  tasks: Task[];
  labels: string[];
  attachments?: Attachment[];
  dependsOn?: string[];
}

export interface ProjectEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  linkedPhaseIds?: string[];
  linkedTaskIds?: string[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  tasks: Task[];
  phases: Phase[];
  resources: Resource[];
  labels: string[];
  attachments?: Attachment[];
  dependsOn?: string[];
  showTimeline?: boolean;
  showProgress?: boolean;
  events?: ProjectEvent[];
}

export interface AreaGroup {
  id: string;
  title: string;
}

export interface Area {
  id: string;
  title: string;
  description?: string;
  icon: string;
  color?: string;
  inactive?: boolean;
  tasks: Task[];
  projects: Project[];
  resources: Resource[];
  labels: string[];
  groupId?: string;
}

export interface DisplaySettings {
  showPriority: boolean;
  showEnergy: boolean;
  showDeadline: boolean;
  showLabels: boolean;
  showAttachments: boolean;
  showDescription: boolean;
}

export interface AppSettings {
  taskStatuses: string[];
  projectStatuses: string[];
  phaseStatuses: string[];
  display: DisplaySettings;
}

export interface LifeOSData {
  areaGroups: AreaGroup[];
  areas: Area[];
  inbox: Task[];
  settings?: AppSettings;
}
