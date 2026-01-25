import type {
  LLMModel,
  LLMModelsResponse,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  LLMConfig,
} from '@jobslave/shared';

export class LMStudioClient {
  private baseUrl: string;
  private defaultModel: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: Partial<LLMConfig> = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:1234';
    this.defaultModel = config.model || '';
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 1024;
  }

  updateConfig(config: Partial<LLMConfig>): void {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.model) this.defaultModel = config.model;
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
  }

  async getModels(): Promise<LLMModel[]> {
    const response = await fetch(`${this.baseUrl}/v1/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data: LLMModelsResponse = await response.json();
    return data.data;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getModels();
      return true;
    } catch {
      return false;
    }
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: Partial<ChatCompletionRequest> = {}
  ): Promise<ChatCompletionResponse> {
    const model = options.model || this.defaultModel;
    if (!model) {
      throw new Error('No model specified. Please select a model in settings.');
    }

    const request: ChatCompletionRequest = {
      model,
      messages,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.max_tokens ?? this.maxTokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat completion failed: ${error}`);
    }

    return response.json();
  }

  async generateText(prompt: string, options: Partial<ChatCompletionRequest> = {}): Promise<string> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    const response = await this.chatCompletion(messages, options);
    return response.choices[0]?.message?.content || '';
  }

  async generateWithSystemPrompt(
    systemPrompt: string,
    userMessage: string,
    options: Partial<ChatCompletionRequest> = {}
  ): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    const response = await this.chatCompletion(messages, options);
    return response.choices[0]?.message?.content || '';
  }

  // Embeddings endpoint (for future use)
  async createEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0]?.embedding || [];
  }
}
