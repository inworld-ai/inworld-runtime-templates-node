import { CustomNode, ProcessContext } from '@inworld/runtime/graph';

// Type definitions
interface MemoryRecord {
  text: string;
  embedding: number[];
  topics: string[];
}

interface LTMSummarizationTask {
  topic: string;
  flashMemory: MemoryRecord[];
  longTermMemory?: MemoryRecord;
}

interface LTMTasks {
  newFlashMemory: MemoryRecord[];
  newLongTermMemory: MemoryRecord[];
  summarizationTasks: LTMSummarizationTask[];
}

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
}

interface ChatRequestList {
  requests: ChatRequest[];
}

interface LTMPromptBuilderConfig {
  promptTemplate: string;
}

/**
 * Prompt Builder Node - generates LLM chat requests for each summarization task.
 * Uses a template to create prompts that ask the LLM to summarize flash memories.
 */
export class LTMPromptBuilderCustomNode extends CustomNode {
  private promptTemplate: string;

  constructor(config: LTMPromptBuilderConfig) {
    super();
    this.promptTemplate = config.promptTemplate;
  }

  async process(
    _context: ProcessContext,
    ...inputs: any[]
  ): Promise<ChatRequestList> {
    const input = inputs[0];
    const tasks = (input?.value || input) as LTMTasks;
    const requests = [];

    for (const task of tasks.summarizationTasks) {
      const flashMemoryList = task.flashMemory.map((r) => r.text).join('\n');
      const longTermMemoryItem = task.longTermMemory?.text || '';

      // Simple template replacement (similar to C++ Jinja2 style)
      let prompt = this.promptTemplate;
      prompt = prompt.replace(/\{\{topic\}\}/g, task.topic);
      prompt = prompt.replace(/\{\{flashMemoryList\}\}/g, flashMemoryList);

      // Handle conditional sections
      if (longTermMemoryItem) {
        prompt = prompt.replace(
          /\{\{#if longTermMemoryItem\}\}([\s\S]*?)\{\{\/if\}\}/g,
          '$1',
        );
        prompt = prompt.replace(
          /\{\{longTermMemoryItem\}\}/g,
          longTermMemoryItem,
        );
      } else {
        prompt = prompt.replace(
          /\{\{#if longTermMemoryItem\}\}[\s\S]*?\{\{\/if\}\}/g,
          '',
        );
      }

      requests.push({
        messages: [
          {
            role: 'user',
            content: prompt.trim(),
          },
        ],
      });
    }

    return { requests };
  }
}
