// API Client exports
export { ApiError, apiRequest, getMastraApiUrl, getMastraBaseUrl } from './client';

// Gmail API
export {
  checkGmailConnection,
  initiateGmailConnection,
  openGmailAuthPopup,
} from './gmail';

// Calendar API
export {
  checkCalendarConnection,
  initiateCalendarConnection,
  openCalendarAuthPopup,
} from './calendar';

// Settings API
export { getUserSettings, updateUserSettings } from './settings';

// Brief API
export { getBrief } from './brief';

// Agent API
export { generateAgentResponse, type AgentName } from './agent';
