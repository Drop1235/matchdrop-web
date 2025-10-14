// Supabase設定ファイル
// 必ず環境変数または安全な方法で値を管理してください。
export const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || 'https://kdusywgpzlmuglsntpzg.supabase.co';
export const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkdXN5d2dwemxtdWdsc250cHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NTYzODcsImV4cCI6MjA2NzQzMjM4N30.Zo3AvZ-1EHCmLrCWm-soQNR1R1GTZCOtyOv3VJp_An0';
