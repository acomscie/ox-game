import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ekbfbmlpjiqevoudlngg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYmZibWxwamlxZXZvdWRsbmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Nzc4NzUsImV4cCI6MjA5NzI1Mzg3NX0.QCgHMaD7YU724S6ef1zgRQAFZfU6s4gxq969ZOcNcAc";

export const supabase = createClient(supabaseUrl, supabaseKey);
