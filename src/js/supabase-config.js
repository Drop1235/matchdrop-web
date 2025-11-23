// Supabase設定ファイル
// 必ず環境変数または安全な方法で値を管理してください。
export const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || 'https://adbsyyzwhcqpekgcdqpg.supabase.co';
export const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkYnN5eXp3aGNxcGVrZ2NkcXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3OTcxNDAsImV4cCI6MjA3NzM3MzE0MH0.0qJniV9lZwQcNMLlIErOxtw3LxnPZ5CfaNEUcMbUdYs';
