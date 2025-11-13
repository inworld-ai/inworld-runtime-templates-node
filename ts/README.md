# Inworld Runtime Templates

Welcome to the Inworld Runtime templates! These examples demonstrate how to build AI applications using the Inworld Runtime SDK, from simple LLM calls to complete voice agent applications.

## 🗂️ What's Inside

The templates are organized by feature domain:

### 🚀 [quickstart/](quickstart/)
**Start here!** Minimal examples perfect for beginners.
- `hello_llm.ts` - Your first LLM call
- `hello_streaming.ts` - Streaming responses

### 💬 [conversational_ai/](conversational_ai/)
Chat, voice, character systems, and long-term memory.
- **[basics/](conversational_ai/basics/)** - Simple LLM chat and voice
- **[advanced/](conversational_ai/advanced/)** - Character generation and custom components
- **[memory/](conversational_ai/memory/)** - Long-term memory integration

### 📚 [knowledge/](knowledge/)
RAG, search, and intent matching.
- Knowledge retrieval
- Intent matching and routing
- Semantic search

### 🛡️ [safety/](safety/)
Content moderation and filtering.
- Keyword matching
- Text classification
- Safety pipelines

### 🔧 [tools/](tools/)
Function calling and MCP integration.
- MCP tool calling
- Custom tool nodes
- Tool subgraphs

### 🔀 [routing/](routing/)
Intelligent routing and conditional logic.
- LLM output-based routing
- Model selection
- Fallback patterns
- Context-aware prompts

### 🌊 [streaming/](streaming/)
Real-time streaming for text and audio.
- LLM streaming with abort control
- Text and audio stream processing
- Stream slicers and joiners

### ✂️ [text_processing/](text_processing/)
Text transformation and template rendering.
- Text chunking
- Jinja template rendering
- Custom transformations
- Subgraph patterns

### 📊 [observability/](observability/)
Telemetry, metrics, and monitoring.
- **[basics/](observability/basics/)** - Basic telemetry setup
- **[advanced/](observability/advanced/)** - Custom OTEL integrations
- **[metrics/](observability/metrics/)** - Metrics collection patterns

### 🔬 [primitives/](primitives/)
Low-level SDK primitives for direct usage.
- Basic embedder (text embeddings)
- Basic NER (named entity recognition)
- Basic VAD (voice activity detection)
- Basic Jinja templates

### 🛠️ [utilities/](utilities/)
Utility nodes and helpers for advanced graph patterns.
- Proxy node for graph composition
- Helper utilities

### 🔧 [shared/](shared/)
Shared utilities and helpers used across templates.
- CLI helpers
- Shared constants
- Shared prompt templates

### 🚀 [voice_agent/](voice_agent/)
A complete full-stack voice agent application with Node server and React client.

## 📋 Prerequisites

- **Node.js 18+** (check with `node -v`)
- **Yarn** (recommended) or npm
- **Inworld API key** - Set as environment variable:
  ```bash
  export INWORLD_API_KEY="your_key_here"
  ```

## 🏃 Quick Start

### Running Examples in Development Mode

```bash
# 1. Build the runtime from source (from repository root)
cd /path/to/inworld-framework-nodejs
yarn install && yarn build

# 2. Create a link to the local package
yarn link

# 3. Navigate to templates
cd templates/ts

# 4. Install dependencies
yarn install

# 5. Link to the local runtime package
yarn link "@inworld/runtime"

# 6. Run any example
yarn node-llm-chat "Tell me about AI"
yarn node-intent "What house are you in?"
yarn node-stt path/to/audio.wav
```

### Running Examples in Production Mode

```bash
# 1. Navigate to templates directory
cd templates/ts

# 2. Install dependencies (will install @inworld/runtime from package)
yarn install

# 3. Run examples
yarn node-llm-chat "Hello, world!"
```

## 📚 Example Commands

### Conversational AI

```bash
# LLM chat with tools and streaming
yarn node-llm-chat "Tell me the weather in Vancouver and evaluate 2 + 2" \
  --provider=openai --modelName=gpt-4o-mini --tools --toolChoice=auto

# Speech to text
yarn node-stt path/to/audio.wav

# Text to speech
yarn node-tts "Hello world" --output=output.wav

# Long-term memory
yarn long-term-memory
```

### Knowledge & RAG

```bash
# Intent matching
yarn node-intent "What house are you in?"

# Knowledge retrieval
yarn node-knowledge "Tell me about Hogwarts"

# Intent routing
yarn conditional-edges-after-intent
```

### Safety

```bash
# Keyword matching
yarn node-keyword-matcher "Check this text for issues"

# Text classification
yarn node-text-classifier "Analyze this content"

# Safety pipeline
yarn safety-subgraph "Run full safety checks"
```

### Tools & MCP

```bash
# List MCP tools
yarn node-mcp-list-tools

# Call MCP tool
yarn node-mcp-call-tool --tool=calculator --args='{"expression": "2+2"}'

# MCP subgraph
yarn node-mcp-subgraph
```

### Routing

```bash
# LLM output routing
yarn conditional-edges-after-llm "Route this message"

# Function-based routing
yarn custom-conditional-edges-after-llm "Use function calling"

# Model selection
yarn model-selector-conditional
```

### Streaming

```bash
# LLM streaming
yarn node-custom-llm-stream "Stream this response"

# Streaming with abort control
yarn node-custom-llm-stream-with-abort-controller

# Text stream processing
yarn simple-reverse-stream "Reverse this text"
```

### Text Processing

```bash
# Text chunking
yarn node-text-chunking-and-aggregator "Long text to chunk..."

# Template rendering
yarn node-custom-jinja --template=path/to/template.jinja

# Custom transformations
yarn node-custom-advanced
```

### Primitives

```bash
# Text embeddings
yarn basic-embedder

# Named entity recognition
yarn basic-ner

# Voice activity detection
yarn basic-vad path/to/audio.wav

# Jinja template rendering
yarn basic-jinja-template
```

## 🎯 Learning Path

### New to Inworld Runtime?
1. Start with [quickstart/README.md](quickstart/README.md)
2. Explore [conversational_ai/README.md](conversational_ai/README.md) for chat examples
3. Try [streaming/README.md](streaming/README.md) for real-time patterns

### Building a Chatbot?
1. [conversational_ai/llm_chat.ts](conversational_ai/llm_chat.ts) - Basic LLM chat
2. [tools/mcp_call_tool.ts](tools/mcp_call_tool.ts) - Add function calling
3. [routing/llm_output_routing.ts](routing/llm_output_routing.ts) - Add routing logic
4. [safety/safety_pipeline.ts](safety/safety_pipeline.ts) - Add content moderation

### Building a Voice Agent?
1. [conversational_ai/speech_to_text.ts](conversational_ai/speech_to_text.ts) - STT
2. [conversational_ai/text_to_speech.ts](conversational_ai/text_to_speech.ts) - TTS
3. [voice_agent/README.md](voice_agent/README.md) - Full application

### Adding RAG?
1. [knowledge/knowledge_retrieval.ts](knowledge/knowledge_retrieval.ts) - Basic RAG
2. [knowledge/intent_matching.ts](knowledge/intent_matching.ts) - Intent matching
3. [knowledge/knowledge_routing.ts](knowledge/knowledge_routing.ts) - Route based on context

### Working with Primitives?
Low-level SDK components for direct usage:
1. [primitives/basic_embedder.ts](primitives/basic_embedder.ts) - Generate text embeddings
2. [primitives/basic_ner.ts](primitives/basic_ner.ts) - Extract named entities
3. [primitives/basic_vad.ts](primitives/basic_vad.ts) - Detect voice activity
4. [primitives/basic_jinja_template.ts](primitives/basic_jinja_template.ts) - Render templates

## 🧪 Running Tests

From the repository root:

```bash
# Run all template tests
yarn templates:run

# Run specific test
yarn test __tests__/templates/graphs/node_llm_chat.spec.ts
```

## 📖 Available Scripts

All script names are listed in [package.json](package.json). Each script corresponds to a template file:

- `yarn <script-name> <args>` - Run any template
- See each domain folder's README for specific examples

## 🐛 Troubleshooting

### Missing API Key
```bash
export INWORLD_API_KEY="your_key_here"
# Or create a .env file in templates/ts/
```

### Port Conflicts
The voice agent client will automatically pick the next available port if 3000 is taken.

### Audio Issues
Grant microphone permissions in your browser for voice agent examples.

### Module Not Found
Make sure you've run `yarn install` in the templates/ts directory and linked the runtime package if in development mode.

## 🔗 Related Resources

- **Main Documentation**: See [../../README.md](../../README.md)
- **Internal Development**: See [../../README_INTERNAL.md](../../README_INTERNAL.md)
- **Voice Agent Setup**: See [voice_agent/README.md](voice_agent/README.md)

## 📝 Template Structure

```
templates/ts/
├── quickstart/              # Beginner examples
├── conversational_ai/       # Chat, voice, characters
│   ├── basics/             # Simple LLM & voice
│   ├── advanced/           # Character gen, custom components
│   └── memory/             # Long-term memory
├── knowledge/              # RAG and search
├── safety/                 # Content moderation
├── tools/                  # Function calling & MCP
├── routing/                # Conditional logic
├── streaming/              # Real-time processing
├── text_processing/        # Text transforms
├── observability/          # Telemetry & metrics
│   ├── basics/             # Basic telemetry
│   ├── advanced/           # Custom OTEL
│   └── metrics/            # Metrics patterns
├── primitives/             # Low-level SDK primitives
│   ├── basic_embedder.ts  # Text embeddings
│   ├── basic_ner.ts       # Named entity recognition
│   ├── basic_vad.ts       # Voice activity detection
│   └── basic_jinja_template.ts  # Template rendering
├── utilities/              # Utility nodes & helpers
│   └── proxy_node.ts      # Proxy node for graph composition
├── shared/                 # Shared utilities & helpers
│   ├── constants.ts       # Shared constants
│   ├── helpers/           # CLI utilities
│   └── prompts/           # Shared prompt templates
├── voice_agent/            # Complete app
├── models/                 # Model assets
├── package.json            # Scripts and dependencies
└── README.md               # This file
```

## 💡 Tips

1. **Start Simple**: Begin with quickstart examples before diving into complex patterns
2. **Check READMEs**: Each domain folder has a detailed README with examples
3. **Use Type Checking**: Run `yarn type-check` from repository root
4. **Explore Tests**: Look at `__tests__/templates/` for usage examples
5. **Mix and Match**: Combine patterns from different domains

## 🤝 Contributing

Found a bug or want to add a template? See the main repository contribution guidelines.

---

**Happy building!** 🚀

For questions or support, visit [inworld.ai](https://www.inworld.ai)
