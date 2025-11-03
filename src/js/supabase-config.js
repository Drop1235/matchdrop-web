// Supabase設定ファイル
// 必ず環境変数または安全な方法で値を管理してください。
export const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || 'https://gdfdunsoluxuiuzfrexs.supabase.co';
export const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZmR1bnNvbHV4dWl1emZyZXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTUxODksImV4cCI6MjA3NTgzMTE4OX0.RTWFEoqqMVdfZU8H8Xcsjm-PT7XWFXm1hJG7HqBJOBs';
