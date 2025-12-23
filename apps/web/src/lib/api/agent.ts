import type {
  AgentGenerateRequest,
  AgentGenerateResponse,
  AgentMessage,
} from '@email-assistant/types';
import { apiRequest, getMastraApiUrl } from './client';
import { API_TIMEOUTS } from '../config/timeouts';

export type AgentName =
  | 'emailManagerAgent'
  | 'emailClassifierAgent'
  | 'emailComposerAgent';

export async function generateAgentResponse(
  agentName: AgentName,
  userId: string,
  messages: AgentMessage[]
): Promise<AgentGenerateResponse> {
  const apiUrl = getMastraApiUrl();

  // Inject userId into messages so the LLM can pass it to tools
  const messagesWithContext: AgentMessage[] = [
    {
      role: 'system',
      content: `Authenticated user context: userId="${userId}". Use this userId for ALL tool calls that require a userId parameter. Do not ask the user for their userId.`,
    },
    ...messages,
  ];

  const request: AgentGenerateRequest = { userId, messages: messagesWithContext };

  return apiRequest<AgentGenerateResponse>(
    `${apiUrl}/agents/${agentName}/generate`,
    {
      method: 'POST',
      body: JSON.stringify(request),
      timeout: API_TIMEOUTS.AGENT,
    }
  );
}

