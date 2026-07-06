export interface XhsVideoResult {
  input_url: string;
  resolved_url: string;
  is_valid_url: boolean;
  is_video: boolean;
  note_id: string | null;
  title: string | null;
  publish_time: string | null;
  publish_timestamp: number | null;
  tags: string[];
  error?: string | null;
}

export interface BatchParseResult {
  total: number;
  success_count: number;
  failed_count: number;
  results: XhsVideoResult[];
}