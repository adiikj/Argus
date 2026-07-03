export { createEsClient } from './es-client.js';
export {
  ensureEventsIndex,
  indexEvent,
  getEventById,
  searchEvents,
  EVENTS_INDEX,
  type EventSearchParams,
} from './events-index.js';
