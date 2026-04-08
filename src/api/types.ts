/**
 * Types TypeScript pour l'API Gitea
 */

export interface GiteaUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
  avatar_url: string;
  html_url: string;
}

export interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  url: string;
  owner: GiteaUser;
  default_branch: string;
}

export type NotificationSubjectType = 'Issue' | 'PullRequest' | 'Commit' | 'Release';

export enum PullRequestState {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged'
}

export enum ReviewState {
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  COMMENTED = 'COMMENTED',
  DISMISSED = 'DISMISSED',
  PENDING = 'PENDING'
}

export interface GiteaPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: PullRequestState;
  html_url: string;
  diff_url: string;
  patch_url: string;
  user: GiteaUser;
  assignee?: GiteaUser;
  assignees?: GiteaUser[];
  base: {
    label: string;
    ref: string;
    sha: string;
    repo: GiteaRepository;
  };
  head: {
    label: string;
    ref: string;
    sha: string;
    repo: GiteaRepository;
  };
  mergeable?: boolean;
  merged?: boolean;
  merged_at?: string;
  merged_by?: GiteaUser;
  comments?: number;
  review_comments?: number;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface GiteaPullRequestReview {
  id: number;
  user: GiteaUser;
  body: string;
  state: ReviewState;
  commit_id: string;
  html_url: string;
  pull_request_url: string;
  submitted_at: string;
}

export interface GiteaPullRequestComment {
  id: number;
  user: GiteaUser;
  body: string;
  path?: string;
  position?: number;
  original_position?: number;
  commit_id?: string;
  original_commit_id?: string;
  html_url: string;
  pull_request_url: string;
  created_at: string;
  updated_at: string;
}

export interface GiteaIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: GiteaUser;
  created_at: string;
  updated_at: string;
}

export interface GiteaNotificationSubject {
  title: string;
  type: NotificationSubjectType;
  url: string;
  html_url: string;
  state?: string;
  latest_comment_author?: GiteaUser;
  user?: GiteaUser;
}

export interface GiteaNotification {
  id: number;
  repository: GiteaRepository;
  subject: GiteaNotificationSubject;
  unread: boolean;
  updated_at: string;
  url: string;
  pinned: boolean;
}

export interface NotificationQueryOptions {
  all?: boolean;
  status_type?: 'unread' | 'read' | 'all';
  page?: number;
  limit?: number;
  since?: string;
  before?: string;
}
