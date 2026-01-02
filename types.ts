
export enum TaskPriority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2'
}

export interface Task {
  id: string;
  priority: TaskPriority;
  title: string;
  description: string;
  dod: string;
}

export interface SchemaTable {
  name: string;
  columns: {
    name: string;
    type: string;
    constraints?: string;
    description: string;
  }[];
}
