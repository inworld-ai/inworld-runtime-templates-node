import { CustomNode, GraphTypes, ProcessContext } from '@inworld/runtime/graph';
import { ResponseFormat } from '@inworld/runtime/primitives/llm';

// Type definitions
interface ChatRequest {
  messages: Array<{ role: string; content: string; toolCallId: string }>;
}

interface ChatRequestList {
  requests: ChatRequest[];
}

interface ChatResponse {
  content: string;
  topic: string;
}

interface ChatResponseList {
  responses: ChatResponse[];
}

/**
 * Parallel LLM Node - processes multiple LLM requests in parallel.
 * Takes a list of chat requests and executes them concurrently.
 */
export class LTMParallelLLMCustomNode extends CustomNode {
  private llmComponentId: string;

  constructor(llmComponentId: string = 'llm_component') {
    super();
    this.llmComponentId = llmComponentId;
  }

  async process(
    context: ProcessContext,
    ...inputs: any[]
  ): Promise<ChatResponseList> {
    const input = inputs[0];
    const requestList = (input?.value || input) as ChatRequestList;
    const llm = await context.getLLMInterface(this.llmComponentId);

    if (!llm) {
      throw new Error(`LLM component '${this.llmComponentId}' not found`);
    }

    console.log(
      `\n[ParallelLLM] Processing ${requestList.requests.length} summarization tasks...`,
    );

    // Process all requests in parallel
    const promises = requestList.requests.map(async (req, _index) => {
      const request = new GraphTypes.LLMChatRequest({
        messages: req.messages,
      });
      const contentStream = await llm.generateContent(
        request,
        ResponseFormat.Text,
      );

      let result = '';
      for await (const chunk of contentStream) {
        if (chunk.content) {
          result += chunk.content;
        }
      }

      return {
        content: result,
        topic: '', // Topic will be matched by index
      };
    });

    const responses = await Promise.all(promises);
    console.log(`[ParallelLLM] Completed ${responses.length} summarizations`);

    return { responses };
  }
}
