export type Status = 'Backlog' | 'In Progress' | 'Done';
export type Priority = 'P1' | 'P2' | 'P3';
export type Energy = 'High' | 'Low';

export interface Resource {
  id: string;
  title: string;
  content: string;
  type: 'link' | 'note';
  url?: string;
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
  status: Status;
  priority: Priority;
  contextTags: string[];
  energy: Energy;
  deadline?: string;
  labels: string[];
  attachments?: Attachment[];
  createdAt: string;
}

export interface Phase {
  id: string;
  title: string;
  description?: string;
  status: Status;
  startDate?: string;
  endDate?: string;
  tasks: Task[];
  labels: string[];
  attachments?: Attachment[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: Status;
  startDate: string;
  endDate: string;
  tasks: Task[];
  phases: Phase[];
  resources: Resource[];
  labels: string[];
  attachments?: Attachment[];
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
  tasks: Task[];
  projects: Project[];
  resources: Resource[];
  labels: string[];
  groupId?: string;
}

export interface LifeOSData {
  areaGroups: AreaGroup[];
  areas: Area[];
  inbox: Task[];
}
