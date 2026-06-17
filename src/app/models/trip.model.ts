export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  activities: Activity[];
  expenses: Expense[];
  budget?: number;
  imageUrl?: string;
  coverGradient?: string;
  lat?: number;
  lng?: number;
}

export interface Activity {
  id: string;
  title: string;
  date: Date;
  time?: string;
  location?: string;
  description?: string;
  completed: boolean;
  category?: 'attraction' | 'food' | 'transport' | 'accommodation' | 'other';
  sortOrder?: number;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: 'transport' | 'food' | 'accommodation' | 'ticket' | 'shopping' | 'other';
  date: Date;
  notes?: string;
}
