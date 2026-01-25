export interface LLMModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

export interface LLMModelsResponse {
  object: 'list';
  data: LLMModel[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'content_filter';
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ScreeningAnswerRequest {
  question: string;
  questionType: 'text' | 'number' | 'select' | 'multiselect' | 'radio' | 'checkbox';
  options?: string[];
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
}

export interface ScreeningAnswerResponse {
  answer: string;
  confidence: number;
  reasoning?: string;
}
