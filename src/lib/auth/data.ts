export type ChildProfile = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
};

export type DashboardActiveChild = {
  id: string;
  display_name: string;
  total_points: number;
};

export type DashboardGenreWithQuestionCount = {
  id: string;
  name: string;
  icon_key: string;
  description: string | null;
  color_hint: string | null;
  parent_id: string | null;
  question_count: number;
};

export type ParentManagedChild = {
  id: string;
  display_name: string;
  total_points: number;
  avatar_url: string | null;
  created_at: string;
  last_studied_at: string | null;
  session_count: number;
};

export type ParentGenre = {
  id: string;
  name: string;
  parent_id: string | null;
};

export type ParentSessionSummary = {
  id: string;
  child_id: string;
  genre_id: string | null;
  mode: string;
  total_questions: number;
  correct_count: number;
  earned_points: number;
  started_at: string;
  completed_at: string | null;
  genre_name: string | null;
  parent_genre_id: string | null;
  color_hint: string | null;
};

export type ParentSessionHistoryItem = {
  session_id: string;
  child_id: string;
  question_id: string;
  is_correct: boolean;
  selected_index: number;
  answered_at: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export type ParentManagementSnapshot = {
  children: ParentManagedChild[];
  sessions: ParentSessionSummary[];
  historyItems: ParentSessionHistoryItem[];
  parentGenres: ParentGenre[];
  leafGenres: ParentGenre[];
};

export type StudyStatus = 'unattempted' | 'studied_not_perfect' | 'perfect_cleared';
