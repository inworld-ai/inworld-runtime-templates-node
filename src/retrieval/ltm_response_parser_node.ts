import { CustomNode, ProcessContext } from '@inworld/runtime/graph';

// Type definitions
interface MemoryRecord {
  text: string;
  embedding: number[];
  topics: string[];
}

interface MemorySnapshot {
  flashMemory: MemoryRecord[];
  longTermMemory: MemoryRecord[];
}

interface MemoryUpdaterRequest {
  memorySnapshot: MemorySnapshot;
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

interface ChatResponse {
  content: string;
  topic: string;
}

interface ChatResponseList {
  responses: ChatResponse[];
}

interface LTMResponseParserConfig {
  embedderComponentId: string;
}

/**
 * Response Parser Node - parses LLM responses, generates embeddings, and merges memories.
 * Takes LLM summarization responses and creates final memory snapshot.
 */
export class LTMResponseParserCustomNode extends CustomNode {
  private embedderComponentId: string;

  constructor(config: LTMResponseParserConfig) {
    super();
    this.embedderComponentId = config.embedderComponentId;
  }

  async process(
    context: ProcessContext,
    ...inputs: any[]
  ): Promise<MemorySnapshot> {
    // This node receives 3 inputs: original request, tasks, and responses
    const originalRequest = (inputs[0]?.value ||
      inputs[0]) as MemoryUpdaterRequest;
    const tasks = (inputs[1]?.value || inputs[1]) as LTMTasks;
    const responses = (inputs[2]?.value || inputs[2]) as ChatResponseList;

    // Collect new memory records
    const newMemoryRecords = await this.collectNewRecords(tasks, responses);

    // Generate embeddings for new memory records
    await this.generateEmbeddings(context, newMemoryRecords);

    // Merge with existing long-term memories
    const mergedRecords = this.mergeMemoryRecords(
      newMemoryRecords,
      originalRequest.memorySnapshot.longTermMemory,
    );

    return {
      flashMemory: tasks.newFlashMemory,
      longTermMemory: mergedRecords,
    };
  }

  private async collectNewRecords(
    tasks: LTMTasks,
    responses: ChatResponseList,
  ): Promise<MemoryRecord[]> {
    const newMemoryRecordsByTopic = new Map<string, MemoryRecord>();

    // Add simple concatenations first
    for (const record of tasks.newLongTermMemory) {
      if (record.text && record.topics.length > 0) {
        newMemoryRecordsByTopic.set(record.topics[0], record);
      }
    }

    // Add LLM-summarized records
    if (tasks.summarizationTasks.length !== responses.responses.length) {
      throw new Error('Mismatch between summarization tasks and responses');
    }

    for (let i = 0; i < tasks.summarizationTasks.length; i++) {
      const task = tasks.summarizationTasks[i];
      const response = responses.responses[i];

      if (response.content) {
        newMemoryRecordsByTopic.set(task.topic, {
          text: response.content,
          embedding: [],
          topics: [task.topic],
        });
      }
    }

    return Array.from(newMemoryRecordsByTopic.values());
  }

  private async generateEmbeddings(
    context: ProcessContext,
    records: MemoryRecord[],
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }

    // Get the embedder interface from the context
    const embedder = context.getEmbedderInterface(this.embedderComponentId);

    // Extract texts to embed
    const textsToEmbed = records.map((record) => record.text);

    // Generate embeddings in batch
    const embeddings = await embedder.embedBatch(textsToEmbed);

    // Assign embeddings to records
    for (let i = 0; i < records.length; i++) {
      // Convert Float32Array to regular number array
      records[i].embedding = Array.from(embeddings[i]);
    }
  }

  private mergeMemoryRecords(
    newRecords: MemoryRecord[],
    oldRecords: MemoryRecord[],
  ): MemoryRecord[] {
    const mergedByTopic = new Map<string, MemoryRecord>();

    // Add old records
    for (const record of oldRecords) {
      if (record.topics.length > 0) {
        mergedByTopic.set(record.topics[0], record);
      }
    }

    // New records override old ones for the same topic
    for (const record of newRecords) {
      if (record.topics.length > 0) {
        mergedByTopic.set(record.topics[0], record);
      }
    }

    return Array.from(mergedByTopic.values());
  }
}
