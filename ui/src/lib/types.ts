export type AttentionItemType =
  | "commitment"
  | "meeting_prep"
  | "unread_thread"
  | "task"
  | "news";

export interface AttentionItem {
  id: string;
  rank: number;
  item_type: AttentionItemType;
  reference_id?: string;
  headline: string;
  why_now: string;
  action_hint?: string;
  brief_date: string;
}

export interface MorningBrief {
  id: string;
  brief_date: string;
  items: AttentionItem[];
  narrative_text: string;
  audio_path?: string;
}

export interface ConnectorStatus {
  connector_id: string;
  status: "connected" | "error" | "syncing";
  error?: string;
}
