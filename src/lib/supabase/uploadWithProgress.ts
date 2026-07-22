import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * supabase-js's storage `upload()` runs on `fetch`, which has no upload-progress event in
 * browsers — only XHR does. This posts to the same Storage REST endpoint (with the same
 * multipart body / headers storage-js sends) over XHR so real byte progress can be reported.
 */
export function uploadFileWithProgress(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");

      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, true);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token ?? anonKey}`);
      xhr.setRequestHeader("x-upsert", "true");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed for ${file.name}: ${xhr.statusText || `HTTP ${xhr.status}`}`));
        }
      };
      xhr.onerror = () => reject(new Error(`Upload failed for ${file.name}: network error`));

      xhr.send(body);
    })().catch(reject);
  });
}
