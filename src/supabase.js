import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ekbfbmlpjiqevoudlngg.supabase.co";
const supabaseKey = "sb_publishable_lTEyXiG_OeF6DhpYren58Q_D8wNLfcI";

export const supabase = createClient(supabaseUrl, supabaseKey);