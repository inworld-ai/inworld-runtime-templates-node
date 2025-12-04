# Inworld Runtime Templates

Templates for building AI applications with the Inworld Runtime SDK. From simple LLM calls to complete voice agents, these templates demonstrate best practices and advanced patterns for conversational AI, RAG, voice processing, safety, and more.

## Prerequisites

- Node.js (v18 or higher)
- npm or Yarn
- An Inworld AI account and API key

## Get Started

### Step 1: Clone the Repository

```bash
git clone https://github.com/inworld-ai/inworld-runtime-templates-node.git
cd inworld-runtime-nodejs-templates
```

### Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```bash
INWORLD_API_KEY=your_api_key_here
```

Get your API key from the [Inworld Portal](https://platform.inworld.ai/).

Alternatively, export the key as an environment variable:

```bash
export INWORLD_API_KEY="your_api_key_here"
```

#### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INWORLD_ADDON_POOL_SIZE` | `64` | Thread pool size for native addon. Increase for high-concurrency workloads. |

```bash
# For running multiple concurrent graphs or load testing
export INWORLD_ADDON_POOL_SIZE=128
```

### Step 4: Run the Templates

Run any template using the scripts defined in `package.json`:

```bash
# Basic LLM chat
npm run node-llm-chat "Tell me about AI"

# Speech to text
npm run node-stt path/to/audio.wav

# Intent matching
npm run node-intent "What house are you in?"
```

## Repo Structure

```
inworld-runtime-nodejs-templates/
├── src/                    # All template source files
│   ├── llm/                # LLM operations, routing, and tools
│   │   ├── routing/        # Intelligent routing and conditional logic
│   │   └── tools/          # Function calling and MCP integration
│   ├── voice/              # Voice processing (STT, TTS)
│   ├── advanced/           # Advanced examples and patterns
│   ├── retrieval/          # RAG, search, intent matching, and memory
│   ├── safety/             # Content moderation and filtering
│   ├── streaming/          # Real-time streaming for text and audio
│   ├── text_processing/    # Text transformation and template rendering
│   ├── observability/      # Telemetry, metrics, and monitoring
│   ├── primitives/         # Low-level SDK primitives for direct usage
│   ├── utilities/          # Utility nodes and helpers
│   └── shared/             # Shared utilities and helpers
├── package.json            # Dependencies and scripts
├── README.md               # Documentation
└── LICENSE                 # MIT License
```

## Templates Overview

### LLM Templates (`src/llm/`)
- **Basic Chat & Completion**: Simple LLM interactions
- **Routing**: Intelligent routing and conditional logic
- **Tools**: Function calling and MCP (Model Context Protocol) integration
- **Component Registry**: Advanced component management patterns

### Voice Templates (`src/voice/`)
- **Speech-to-Text (STT)**: Convert audio to text
- **Text-to-Speech (TTS)**: Generate audio from text with streaming support

### Retrieval Templates (`src/retrieval/`)
- **RAG**: Knowledge retrieval and question answering
- **Intent Matching**: Classify user intents and route accordingly
- **Long-term Memory**: Persistent conversation memory

### Safety Templates (`src/safety/`)
- **Content Moderation**: Keyword matching and text classification
- **Safety Pipelines**: Complete content filtering workflows

### Streaming Templates (`src/streaming/`)
- **LLM Streaming**: Real-time text generation with abort controls
- **Audio Streaming**: Process audio streams in real-time

### Primitives (`src/primitives/`)
Low-level SDK components for direct usage:
- **Embedder**: Generate text embeddings
- **NER**: Named entity recognition
- **VAD**: Voice activity detection
- **Jinja Templates**: Template rendering

## Learning Path

### New to Inworld Runtime?
1. Start with `src/llm/llm_chat.ts` - Basic LLM chat
2. Try `src/voice/speech_to_text.ts` - Voice processing
3. Explore `src/streaming/` - Real-time patterns

### Building a Chatbot?
1. `src/llm/llm_chat.ts` - Basic LLM chat
2. `src/llm/tools/mcp_call_tool.ts` - Add function calling
3. `src/llm/routing/llm_output_routing.ts` - Add routing logic
4. `src/safety/safety_pipeline.ts` - Add content moderation

### Building a Voice Agent?
1. `src/voice/speech_to_text.ts` - STT
2. `src/voice/text_to_speech.ts` - TTS

### Adding RAG?
1. `src/retrieval/knowledge_retrieval.ts` - Basic RAG
2. `src/retrieval/intent_matching.ts` - Intent matching
3. `src/retrieval/knowledge_routing.ts` - Route based on context

## Troubleshooting

**Missing API Key**
```bash
export INWORLD_API_KEY="your_key_here"
# Or create a .env file
```

**Module Not Found**
```bash
npm install
# or
yarn install
```

**Audio Issues**

Grant microphone permissions in your browser for voice examples.

**Bug Reports**: [GitHub Issues](https://github.com/inworld-ai/inworld-runtime-templates-node/issues)

**General Questions**: For general inquiries and support, please email us at support@inworld.ai

## Contributing

We welcome contributions! Found a bug or want to add a template? Open an issue or PR, and we will review it.

For detailed guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
