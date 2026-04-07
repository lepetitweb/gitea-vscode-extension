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

export interface GiteaPullRequest {
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
