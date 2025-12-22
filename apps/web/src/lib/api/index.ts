// API Client exports
export { ApiError, apiRequest, getMastraApiUrl } from './client';

// Gmail API
export {
  checkGmailConnection,
  initiateGmailConnection,
  redirectToGmailAuth,
} from './gmail';

// Calendar API
export {
  checkCalendarConnection,
  initiateCalendarConnection,
  redirectToCalendarAuth,
} from './calendar';

// Settings API
export { getUserSettings, updateUserSettings } from './settings';

// Agent API
export { generateAgentResponse, type AgentName } from './agent';
