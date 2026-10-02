import { handleRequest } from './handleRequest';
import type { WorkerRequest } from './protocol';

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { response, transfer } = handleRequest(event.data);
  self.postMessage(response, { transfer });
});
