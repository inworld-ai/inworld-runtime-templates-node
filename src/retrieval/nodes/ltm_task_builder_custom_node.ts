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

interface LTMTaskBuilderConfig {
  maxNumberOfFlashMemory: number;
  maxTopicSummaryLenToAppend: number;
}

/**
 * Task Builder Node - decides which flash memories to summarize and which to keep.
 * Groups memories by topic and determines if LLM summarization is needed.
 */
export class LTMTaskBuilderCustomNode extends CustomNode {
  private config: LTMTaskBuilderConfig;

  constructor(
    config: LTMTaskBuilderConfig = {
      maxNumberOfFlashMemory: 5,
      maxTopicSummaryLenToAppend: 500,
    },
  ) {
    super();
    this.config = config;
  }

  async process(_context: ProcessContext, ...inputs: any[]): Promise<LTMTasks> {
    const input = inputs[0];
    const request = (input?.value || input) as MemoryUpdaterRequest;
    const flashMemoryRecords = request.memorySnapshot.flashMemory;
    const longTermMemoryRecords = request.memorySnapshot.longTermMemory;

    // Split flash memories: keep recent N, summarize the rest
    const { flashToSummarize, newFlashMemory } = this.splitFlashMemory(
      flashMemoryRecords,
      this.config.maxNumberOfFlashMemory,
    );

    // Group flash memories by topic
    const flashMemoryByTopics = this.groupByTopics(flashToSummarize);

    // Group long-term memories by topic
    const longTermMemoryByTopics = this.groupLTMByTopics(longTermMemoryRecords);

    // Build tasks
    const summarizationTasks: LTMSummarizationTask[] = [];
    const newLongTermMemory: MemoryRecord[] = [];

    for (const [topic, flashMemories] of Object.entries(flashMemoryByTopics)) {
      const existingLTM = longTermMemoryByTopics.get(topic);

      // Check if we can just concatenate instead of using LLM
      const combinedRecord = this.trySimpleCombine(
        topic,
        flashMemories,
        existingLTM,
      );

      if (combinedRecord) {
        newLongTermMemory.push(combinedRecord);
      } else {
        // Need LLM summarization
        summarizationTasks.push({
          topic,
          flashMemory: flashMemories,
          longTermMemory: existingLTM,
        });
      }
    }

    return {
      newFlashMemory,
      newLongTermMemory,
      summarizationTasks,
    };
  }

  private splitFlashMemory(
    flashMemoryRecords: MemoryRecord[],
    maxNumberOfFlashMemory: number,
  ): { flashToSummarize: MemoryRecord[]; newFlashMemory: MemoryRecord[] } {
    if (flashMemoryRecords.length <= maxNumberOfFlashMemory) {
      return {
        flashToSummarize: [],
        newFlashMemory: flashMemoryRecords,
      };
    }

    const flashMemoryToProcess =
      flashMemoryRecords.length - maxNumberOfFlashMemory;

    return {
      flashToSummarize: flashMemoryRecords.slice(0, flashMemoryToProcess),
      newFlashMemory: flashMemoryRecords.slice(flashMemoryToProcess),
    };
  }

  private groupByTopics(records: MemoryRecord[]): {
    [topic: string]: MemoryRecord[];
  } {
    const grouped: { [topic: string]: MemoryRecord[] } = {};

    for (const record of records) {
      for (const topic of record.topics) {
        if (!grouped[topic]) {
          grouped[topic] = [];
        }
        grouped[topic].push(record);
      }
    }

    return grouped;
  }

  private groupLTMByTopics(records: MemoryRecord[]): Map<string, MemoryRecord> {
    const grouped = new Map<string, MemoryRecord>();

    for (const record of records) {
      if (record.topics.length > 0) {
        const topic = record.topics[0];
        grouped.set(topic, record);
      }
    }

    return grouped;
  }

  private trySimpleCombine(
    topic: string,
    flashMemories: MemoryRecord[],
    existingLTM?: MemoryRecord,
  ): MemoryRecord | null {
    let combinedText = flashMemories.map((r) => r.text).join('\n');

    if (existingLTM) {
      combinedText += '\n' + existingLTM.text;
    }

    // If short enough, just combine without LLM
    if (combinedText.length <= this.config.maxTopicSummaryLenToAppend) {
      return {
        text: combinedText,
        embedding: [],
        topics: [topic],
      };
    }

    return null;
  }
}
