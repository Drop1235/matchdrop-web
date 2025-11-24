// Supabase設定ファイル（OP画面用）
// 統合プロジェクトのURLに固定し、anon key はユーザーが差し込む前提にする。
// NOTE: op-web は純粋な静的配信のため、process.env は基本的に使われず
//       下のハードコード値がそのままブラウザに届きます。

// 統合SupabaseプロジェクトのURL（例: https://vjuycodmbcjuvrcgmdmt.supabase.co）
export const SUPABASE_URL = 'https://vjuycodmbcjuvrcgmdmt.supabase.co';

// 統合Supabaseプロジェクトの anon key をここに貼り付けてください。
// （Supabaseダッシュボードの Project Settings → API → anon public）
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdXljb2RtYmNqdXZyY2dtZG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzIwODYsImV4cCI6MjA3OTQ0ODA4Nn0.a-HK8sTCB_M2EfOI9Ydr3sLMu2UbfXBwa6Y8EROaJX4';
