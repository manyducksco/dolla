// import { $debug, $teardown, $watch, Readable, state, toReadable, Writable } from "../core";

// type UploadStatus = "idle" | "uploading" | "stalled" | "success" | "error";

// interface UploadOptions {
//   chunkSize?: number;
//   headers?: Record<string, string>;
//   maxRetries?: number; // New: Number of times to retry a failed chunk
//   retryDelay?: number; // New: Delay in ms between retries
// }

// interface UploadTask {
//   fileName: string;
//   progress: Readable<number>; // Or Writable if the UI needs to reset it
//   status: Writable<UploadStatus>;
//   error: Readable<string | null>;
//   isRetrying: Writable<boolean>;
//   abort: () => void;
//   pause: () => void;
//   resume: () => void;
// }

// interface UploadHook {
//   uploads: Readable<UploadTask[]>;
//   add: (file: File) => UploadTask;
// }

// export function $upload(url: string, options: UploadOptions = {}): UploadHook {
//   const uploads = state<UploadTask[]>([]);
//   const isOnline = $online(); // TODO: Take pingURL? Or just take the isOnline Readable as an argument?
//   const debug = $debug();

//   // Options defaults
//   const CHUNK_SIZE = options.chunkSize ?? 5 * 1024 * 1024; // 5MB
//   const MAX_RETRIES = options.maxRetries ?? 5;

//   const add = (file: File): UploadTask => {
//     const _progress = state(0);
//     const _status = state<UploadStatus>("idle");
//     const _error = state<string | null>(null);
//     const _retrying = state(false);

//     let currentXHR: XMLHttpRequest | null = null;
//     let currentChunkIndex = 0;
//     let userPaused = false;

//     /**
//      * Internal: Sequential Chunk Runner
//      */
//     const run = async () => {
//       const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
//       _status.write("uploading");

//       for (let i = currentChunkIndex; i < totalChunks; i++) {
//         // Stop if network drops, user pauses, or task is killed
//         if (!isOnline.read() || userPaused || _status.read() === "idle") {
//           if (!userPaused && !isOnline.read()) _status.write("stalled");
//           return;
//         }

//         currentChunkIndex = i;
//         const chunk = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));

//         // Chunk Retry Loop
//         let attempt = 0;
//         let success = false;

//         while (attempt <= MAX_RETRIES && !success) {
//           try {
//             await uploadChunk(chunk, i, totalChunks);
//             success = true;
//             _retrying.write(false);
//           } catch (err: any) {
//             if (err.isFatal) {
//               _status.write("error");
//               _error.write(err.message);
//               return;
//             }

//             attempt++;
//             if (attempt > MAX_RETRIES) {
//               _status.write("error");
//               _error.write("Exceeded maximum retries.");
//               return;
//             }

//             _retrying.write(true);
//             const delay = Math.pow(2, attempt) * 1000; // Exponential: 2s, 4s, 8s...
//             debug.warn(`Chunk ${i} failed. Retry ${attempt} in ${delay}ms`);
//             await new Promise((r) => setTimeout(r, delay));
//           }
//         }

//         _progress.write(Math.round(((i + 1) / totalChunks) * 100));
//       }

//       _status.write("success");
//     };

//     /**
//      * Internal: The physical XHR request
//      */
//     const uploadChunk = (blob: Blob, index: number, total: number) => {
//       return new Promise<void>((resolve, reject) => {
//         const xhr = new XMLHttpRequest();
//         currentXHR = xhr;

//         xhr.open("POST", url);
//         xhr.setRequestHeader("X-Chunk-Index", index.toString());
//         xhr.setRequestHeader("X-Chunk-Total", total.toString());
//         xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

//         xhr.onload = () => {
//           if (xhr.status >= 200 && xhr.status < 300) resolve();
//           else {
//             const err = new Error(`Server Error: ${xhr.status}`);
//             if (xhr.status >= 400 && xhr.status < 500) (err as any).isFatal = true;
//             reject(err);
//           }
//         };
//         xhr.onerror = () => reject(new Error("Network Failure"));

//         const formData = new FormData();
//         formData.append("chunk", blob);
//         xhr.send(formData);
//       });
//     };

//     const task: UploadTask = {
//       fileName: file.name,
//       progress: _progress,
//       status: _status,
//       error: _error,
//       isRetrying: _retrying,
//       abort() {
//         _status.write("idle");
//         currentXHR?.abort();
//       },
//       pause() {
//         userPaused = true;
//         this.abort();
//       },
//       resume() {
//         if (isOnline.read()) {
//           userPaused = false;
//           run();
//         }
//       },
//     };

//     uploads.update((list) => [...list, task]);
//     if (isOnline.read()) run();

//     return task;
//   };

//   /**
//    * Orchestration: Handle Network Drops/Gains
//    */
//   $watch(() => {
//     const online = isOnline.track();
//     const list = uploads.read();

//     if (online) {
//       debug.info("App Online: Resuming applicable uploads.");
//       list.forEach((t) => {
//         if (t.status.read() === "stalled") t.resume();
//       });
//     } else {
//       debug.warn("App Offline: Stalling active uploads.");
//       list.forEach((t) => {
//         if (t.status.read() === "uploading") t.status.write("stalled");
//       });
//     }
//   });

//   $teardown(() => {
//     uploads.read().forEach((t) => t.abort());
//   });

//   return { uploads, add };
// }
